/**
 * HTTP 请求封装模块
 *
 * 基于 axios 创建统一请求实例，负责：
 * - 请求/响应拦截（Token、工作空间头、存储平台头、语言头）
 * - 后端 `{ code, msg, data }` 响应格式解析
 * - 401/403 等错误统一 toast 提示与登录跳转
 * - 导出 `request` 便捷方法（自动解包 `data` 字段）
 */
import axios, {
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'
import { toast } from 'sonner'
import i18n, { getRequestLangHeader } from '@/i18n'
import { getToken, clearToken } from '@/utils/auth'
import { getCurrentWorkspaceId } from '@/store/workspace'

/** 与后端统一包装 `{ code, msg, data }` 一致 */
export interface HttpResponse<T = unknown> {
  code: number
  msg: string
  data: T
}

/** 防止 401 并发触发多次整页跳转 */
let isRedirectingToLogin = false

/**
 * 判断当前请求是否应跳过 401 整页跳转
 * 登录/注册接口返回 401 时（如密码错误）不应踢回登录页
 * @param url 请求 URL
 * @returns 为 true 时跳过跳转，仅 toast 提示
 */
function shouldSkipUnauthorizedRedirect(url: string | undefined): boolean {
  if (!url) return false
  return (
    url.includes('/apis/auth/login') ||
    url.includes('/apis/auth/register') ||
    url.includes('/apis/user/register')
  )
}

/**
 * 401 未授权时清本地状态并整页跳转登录
 * 携带 redirect 参数，便于登录成功后返回原页面
 */
export function redirectToLoginDueToUnauthorized() {
  if (isRedirectingToLogin) return
  isRedirectingToLogin = true

  // 清除本地认证与缓存数据
  clearToken()
  localStorage.removeItem('userInfo')
  sessionStorage.removeItem('userInfo')
  localStorage.removeItem('current-storage-platform')
  localStorage.removeItem('user-storage')
  localStorage.removeItem('workspace-storage')

  // 异步重置 Pinia/Zustand 全局状态
  import('@/store/workspace').then(({ useWorkspaceStore }) => {
    useWorkspaceStore.getState().clear()
  })
  import('@/store/user').then(({ useUserStore }) => {
    useUserStore.getState().clearUserInfo()
  })

  const path =
    window.location.pathname + window.location.search + window.location.hash
  const loginBase = '/login'
  // 已在登录页则不再追加 redirect，避免循环
  if (path === loginBase || path.startsWith(`${loginBase}?`)) {
    window.location.href = loginBase
    return
  }
  window.location.href = `${loginBase}?redirect=${encodeURIComponent(path)}`
}

/** axios 实例：统一 baseURL 与超时 */
const service = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10000,
})

/**
 * 判断是否为公开分享页 API
 * 此类接口不应携带当前登录用户的工作空间/存储平台头，避免干扰访客浏览
 * @param url 请求 URL
 */
const isPublicShareApi = (url?: string): boolean => {
  if (!url) return false
  if (url.includes('/apis/share/verify/code')) return true
  return /\/apis\/share\/[^/?]+\/(items|info|path|download\/)/.test(url)
}

/**
 * 从 localStorage 读取当前选中的存储平台配置 ID
 * @returns settingId 或 null
 */
const getCurrentStoragePlatformId = (): string | null => {
  const storageInfo = localStorage.getItem('current-storage-platform')
  if (storageInfo) {
    try {
      const platform = JSON.parse(storageInfo)
      return platform?.settingId || null
    } catch (error) {
      return null
    }
  }
  return null
}

/** 请求拦截器：注入 Token、作用域请求头、语言头 */
service.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 携带 Bearer Token（若已登录）
    const token = getToken()
    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
    }

    const skipScopedHeaders = isPublicShareApi(config.url)

    if (!skipScopedHeaders) {
      // 注入当前存储平台配置 ID
      const platformId = getCurrentStoragePlatformId()
      if (platformId) {
        config.headers = config.headers || {}
        config.headers['X-Storage-Platform-Config-Id'] = platformId
      }

      // 注入当前工作空间 ID
      const workspaceId = getCurrentWorkspaceId()
      if (workspaceId) {
        config.headers = config.headers || {}
        config.headers['X-Workspace-Id'] = workspaceId
      }
    }

    // URL 中携带 X-Workspace-Id 查询参数时，提取到请求头（用于下载等场景）
    if (config.url?.includes('X-Workspace-Id')) {
      try {
        const url = new URL(config.url, config.baseURL)
        const urlWorkspaceId = url.searchParams.get('X-Workspace-Id')
        if (urlWorkspaceId) {
          config.headers = config.headers || {}
          config.headers['X-Workspace-Id'] = urlWorkspaceId
          // 从 URL 中移除该参数，避免重复传递
          url.searchParams.delete('X-Workspace-Id')
          config.url = url.toString().replace(url.origin, '')
        }
      } catch {
        // URL 解析失败，忽略
      }
    }

    // 注入国际化语言头，供后端返回对应语言的错误信息
    config.headers = config.headers || {}
    config.headers.lang = getRequestLangHeader()

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

/** 响应拦截器：解析业务 code、统一错误提示、401 跳转 */
service.interceptors.response.use(
  (response: AxiosResponse<HttpResponse>) => {
    const { data: res, config } = response

    // blob 响应（如下载）直接返回，不做 code 校验
    if (config.responseType === 'blob') {
      return response
    }

    // 业务成功（code === 200）
    if (res.code === 200) {
      return response
    }

    // 可通过 config.showErrorMessage = false 静默失败
    const showError = (config as any).showErrorMessage !== false

    if (res.code === 401) {
      if (!shouldSkipUnauthorizedRedirect(response.config?.url)) {
        redirectToLoginDueToUnauthorized()
      } else if (showError) {
        toast.error(res.msg || i18n.t('common:api.loginFailed'))
      }
    } else if (res.code === 403) {
      if (showError) {
        toast.error(res.msg || i18n.t('common:api.noPermission'))
      }
    } else if (showError) {
      toast.error(res.msg || i18n.t('common:api.operationFailed'))
    }

    const error: any = new Error(res.msg || 'Error')
    error.code = res.code
    error.response = response
    /** 已在上方 toast 或 401 跳转时，避免业务层再弹一层 */
    error.handled =
      res.code === 401 || res.code === 403 || showError
    return Promise.reject(error)
  },
  (error) => {
    // HTTP 层错误（网络异常、4xx/5xx 状态码等）
    const config = error.config || {}
    const showError = (config as any).showErrorMessage !== false

    if (showError && !error.isErrorShown) {
      let errorMessage = i18n.t('common:api.networkFailed')
      let skipToast = false

      if (error.response) {
        const { status } = error.response
        switch (status) {
          case 400:
            errorMessage =
              error.response.data?.msg || i18n.t('common:api.badRequest')
            break
          case 401:
            if (!shouldSkipUnauthorizedRedirect(error.config?.url)) {
              redirectToLoginDueToUnauthorized()
              skipToast = true
            } else {
              errorMessage =
                error.response.data?.msg || i18n.t('common:api.wrongCredentials')
            }
            break
          case 403:
            errorMessage =
              error.response.data?.msg || i18n.t('common:api.noPermission')
            break
          case 404:
            errorMessage =
              error.response.data?.msg || i18n.t('common:api.notFound')
            break
          case 500:
            errorMessage =
              error.response.data?.msg || i18n.t('common:api.serverError')
            break
          default:
            errorMessage =
              error.response.data?.msg ||
              i18n.t('common:api.requestFailed', { status })
        }
      } else if (error.message.includes('timeout')) {
        errorMessage = i18n.t('common:api.timeout')
      } else if (error.message.includes('Network Error')) {
        errorMessage = i18n.t('common:api.networkError')
      }

      if (!skipToast) {
        toast.error(errorMessage)
      }
      error.handled = true
    }

    return Promise.reject(error)
  }
)

/**
 * 统一请求方法封装
 * 自动解包后端 `HttpResponse.data`，业务层直接拿到 payload
 */
export const request = {
  /**
   * GET 请求
   * @param url 接口路径
   * @param config axios 配置（可传 showErrorMessage: false 静默失败）
   * @returns 解包后的 data 字段
   */
  get<T = any>(url: string, config?: AxiosRequestConfig) {
    return service
      .get<T, AxiosResponse<HttpResponse<T>>>(url, config)
      .then((response) => response.data.data)
  },

  /**
   * POST 请求
   * @param url 接口路径
   * @param data 请求体
   * @param config axios 配置
   * @returns 解包后的 data 字段
   */
  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig) {
    return service
      .post<T, AxiosResponse<HttpResponse<T>>>(url, data, config)
      .then((response) => response.data.data)
  },

  /**
   * PUT 请求
   * @param url 接口路径
   * @param data 请求体
   * @param config axios 配置
   * @returns 解包后的 data 字段
   */
  put<T = any>(url: string, data?: any, config?: AxiosRequestConfig) {
    return service
      .put<T, AxiosResponse<HttpResponse<T>>>(url, data, config)
      .then((response) => response.data.data)
  },

  /**
   * DELETE 请求
   * @param url 接口路径
   * @param config axios 配置（删除体可通过 config.data 传递）
   * @returns 解包后的 data 字段
   */
  delete<T = any>(url: string, config?: AxiosRequestConfig) {
    return service
      .delete<T, AxiosResponse<HttpResponse<T>>>(url, config)
      .then((response) => response.data.data)
  },
}

/** 导出原始 axios 实例，供 blob 下载等需完整响应的场景使用 */
export default service
