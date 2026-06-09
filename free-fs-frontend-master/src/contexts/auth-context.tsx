/**
 * 全局认证上下文
 *
 * 职责：管理登录态、用户信息、工作空间初始化与激活，
 * 并在登录/激活工作空间后加载存储平台配置与传输设置。
 */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react'
import type { UserInfo } from '@/types/user'
import { mergeUserInfo } from '@/utils/merge-user-info'
import { getActiveStoragePlatforms } from '@/api/storage'
import { workspaceApi } from '@/api/workspace'
import { useWorkspaceStore } from '@/store/workspace'
import {
  setToken as saveToken,
  clearToken as removeToken,
  getToken,
} from '@/utils/auth'

/** AuthContext 对外暴露的值与方法 */
interface AuthContextType {
  /** 是否已登录 */
  isAuthenticated: boolean
  /** 当前用户基本信息 */
  user: UserInfo | null
  /** accessToken */
  token: string | null
  /** 是否需要引导用户创建工作空间（列表为空时） */
  needsWorkspaceSetup: boolean
  /** 登录：保存 token、用户信息并加载工作空间列表 */
  login: (
    token: string,
    userInfo: UserInfo,
    remember?: boolean
  ) => Promise<void>
  /** 登出：清除 token、用户与工作空间状态 */
  logout: () => void
  /** 局部更新用户信息（同步到 user store） */
  updateUser: (patch: Partial<UserInfo>) => void
  /** 加载工作空间列表（不激活），返回是否有可用空间 */
  loadWorkspaces: () => Promise<boolean>
  /** 激活指定工作空间：设置 ID、加载角色权限、存储配置、传输设置 */
  activateWorkspace: (workspaceId: string) => Promise<void>
  /** 初始化认证信息是否仍在进行 */
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

/** 认证 Provider，包裹应用根组件 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<UserInfo | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [needsWorkspaceSetup, setNeedsWorkspaceSetup] = useState(false)

  const wsStore = useWorkspaceStore

  /** 拉取当前工作空间下启用的存储平台，写入 localStorage 供请求头使用 */
  const loadStoragePlatform = async () => {
    try {
      const activePlatforms = await getActiveStoragePlatforms()
      const enabledPlatform = activePlatforms?.find((p) => p.isEnabled)
      if (enabledPlatform) {
        localStorage.setItem(
          'current-storage-platform',
          JSON.stringify({
            settingId: enabledPlatform.settingId,
            platformName: enabledPlatform.platformName,
          })
        )
      } else {
        localStorage.removeItem('current-storage-platform')
      }
    } catch (error) {
      localStorage.removeItem('current-storage-platform')
      console.error('获取存储平台配置失败:', error)
    }
  }

  /** 从 API 加载工作空间列表到 store */
  const loadWorkspaces = useCallback(async (): Promise<boolean> => {
    try {
      const workspaces = await workspaceApi.list()
      wsStore.getState().setWorkspaces(workspaces)

      if (workspaces.length === 0) {
        setNeedsWorkspaceSetup(true)
        return false
      }

      setNeedsWorkspaceSetup(false)
      return true
    } catch (error) {
      console.error('加载工作空间列表失败:', error)
      return false
    }
  }, [])

  /** 切换并激活工作空间，并行加载存储平台与用户传输设置 */
  const activateWorkspace = useCallback(async (workspaceId: string) => {
    wsStore.getState().setCurrentWorkspaceId(workspaceId)
    localStorage.removeItem('current-storage-platform')

    const detail = await workspaceApi.getCurrent()
    wsStore.getState().setCurrentRole({
      roleCode: detail.roleCode,
      roleName: detail.roleName,
      permissions: detail.permissions,
    })

    await Promise.all([
      loadStoragePlatform(),
      import('@/store/user')
        .then(({ useUserStore }) => useUserStore.getState().loadTransferSetting())
        .catch(() => {}),
    ])
  }, [])

  /** 应用启动时：若有 token 则恢复登录态并加载工作空间 */
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = getToken()

        if (storedToken) {
          const { useUserStore } = await import('@/store/user')
          const userStore = useUserStore.getState()

          let userInfo: UserInfo | null = null

          try {
            const { userApi } = await import('@/api/user')
            userInfo = await userApi.getUserInfo()
            userStore.setUserInfo(userInfo)
          } catch {
            // API 失败时尝试从 persist 的 user store 恢复
            if (userStore.id) {
              userInfo = {
                id: userStore.id,
                username: userStore.username,
                nickname: userStore.nickname,
                email: userStore.email,
                avatar: userStore.avatar,
                status: userStore.status,
                createdAt: userStore.createdAt,
                updatedAt: userStore.updatedAt,
                lastLoginAt: userStore.lastLoginAt,
                isSetPassword: userStore.isSetPassword,
              }
            }
          }

          if (userInfo) {
            setToken(storedToken)
            setUser(userInfo)
            setIsAuthenticated(true)
            await loadWorkspaces()
          }
        }
      } catch (error) {
        console.error('初始化认证信息失败:', error)
        removeToken()
      } finally {
        setIsLoading(false)
      }
    }

    initAuth()
  }, [loadWorkspaces])

  /** 登录成功后的状态写入与后续初始化 */
  const login = useCallback(
    async (accessToken: string, userInfo: UserInfo, remember = false) => {
      try {
        saveToken(accessToken, remember)
        setToken(accessToken)
        setUser(userInfo)
        setIsAuthenticated(true)

        const { useUserStore } = await import('@/store/user')
        const userStore = useUserStore.getState()
        userStore.setUserInfo(userInfo)

        await loadWorkspaces()
      } catch (error) {
        console.error('登录失败:', error)
        throw error
      }
    },
    [loadWorkspaces]
  )

  /** 登出并清理所有本地认证相关状态 */
  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    setIsAuthenticated(false)
    setNeedsWorkspaceSetup(false)

    removeToken()
    localStorage.removeItem('current-storage-platform')

    import('@/store/user').then(({ useUserStore }) => {
      useUserStore.getState().clearUserInfo()
    })

    wsStore.getState().clear()
  }, [])

  /** 合并 patch 更新用户并同步 user store */
  const updateUser = useCallback((patch: Partial<UserInfo>) => {
    setUser((prev) => {
      if (!prev) {
        return patch as UserInfo
      }
      const merged = mergeUserInfo(prev, patch)
      import('@/store/user').then(({ useUserStore }) => {
        useUserStore.getState().setUserInfo(merged)
      })
      return merged
    })
  }, [])

  const value = useMemo<AuthContextType>(
    () => ({
      isAuthenticated,
      user,
      token,
      needsWorkspaceSetup,
      login,
      logout,
      updateUser,
      loadWorkspaces,
      activateWorkspace,
      isLoading,
    }),
    [
      isAuthenticated,
      user,
      token,
      needsWorkspaceSetup,
      login,
      logout,
      updateUser,
      loadWorkspaces,
      activateWorkspace,
      isLoading,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** 获取认证上下文，必须在 AuthProvider 内使用 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
