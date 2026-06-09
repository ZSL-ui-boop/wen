/**
 * 文件分享 API 模块
 *
 * 封装分享创建/取消、分享页浏览、验证码校验、下载及响应解析工具。
 */
import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import type { FileItem } from '@/types/file'
import type { PageRecord } from '@/types/page'
import type {
  ShareCreateParams,
  ShareCreateResponse,
  ShareItem,
  SharePageQuery,
  ShareThin,
  ShareValidParams,
  ShareAccessRecord,
  ShareBreadcrumbItem,
} from '@/types/share'
import { request } from './request'
import service from './request'

/**
 * 分页获取当前用户的分享列表
 * @param params 分页与筛选条件
 * @returns 分享分页数据
 */
export function getMySharePage(params?: SharePageQuery) {
  return request.get<PageRecord<ShareItem>>('/apis/share/pages', { params })
}

/**
 * 创建文件分享
 * @param params 分享文件、有效期、提取码等参数
 * @returns 分享链接与提取码
 */
export function shareFiles(params: ShareCreateParams) {
  return request.post<ShareCreateResponse>('/apis/share/create', params)
}

/**
 * 取消分享（支持单个和批量）
 * @param ids 分享记录 ID 列表
 */
export function cancelShares(ids: string[]) {
  return request.delete('/apis/share/cancels', { data: ids })
}

/**
 * 清空当前用户全部分享记录
 */
export function clearAllShares() {
  return request.delete<unknown>('/apis/share/clears')
}

/**
 * 查看分享详情（精简信息，用于分享页头部展示）
 * @param shareId 分享 ID
 * @returns 分享精简信息
 */
export function getShareDetail(shareId: string) {
  return request.get<ShareThin>(`/apis/share/${shareId}/info`)
}

/**
 * 验证分享提取码
 * @param params 分享 ID 与提取码
 * @returns 验证是否通过
 */
export function validateShareCode(params: ShareValidParams) {
  return request.post<boolean>('/apis/share/verify/code', params)
}

/** 扩展 axios 配置，支持静默失败 */
type RequestOpts = AxiosRequestConfig & { showErrorMessage?: boolean }

/**
 * 获取分享页当前目录面包屑
 * 刷新/直达链接时用于与 URL 同步；旧后端无此接口时会 404，须静默失败
 * @param shareId 分享 ID
 * @param parentId 当前目录 ID
 * @returns 面包屑路径节点列表
 */
export function getShareBreadcrumb(shareId: string, parentId: string) {
  return request.get<ShareBreadcrumbItem[]>(`/apis/share/${shareId}/path`, {
    params: { parentId },
    showErrorMessage: false,
  } as RequestOpts)
}

/**
 * 获取分享目录下的文件列表
 * @param shareId 分享 ID
 * @param parentId 父目录 ID，不传则查根目录
 * @returns 文件列表
 */
export function getShareItemList(shareId: string, parentId?: string) {
  return request.get<FileItem[]>(`/apis/share/${shareId}/items`, {
    params: parentId ? { parentId } : undefined,
  })
}

/**
 * 获取分享完整详情（用于「我的分享」详情页）
 * @param shareId 分享 ID
 * @returns 分享完整信息
 */
export function getShareDetailById(shareId: string) {
  return request.get<ShareItem>(`/apis/share/${shareId}`)
}

/**
 * 获取分享访问记录列表
 * @param shareId 分享 ID
 * @returns 访问记录数组
 */
export function getShareAccessRecords(shareId: string) {
  return request.get<ShareAccessRecord[]>(
    `/apis/share/${shareId}/access/records`
  )
}

/**
 * 下载分享文件（返回 blob 原始响应）
 * @param shareId 分享 ID
 * @param fileId 文件 ID
 * @returns axios 完整响应（含 blob 数据）
 */
export function downloadShareFile(shareId: string, fileId: string) {
  return service.get(`/apis/share/${shareId}/download/${fileId}`, {
    responseType: 'blob',
  })
}

/**
 * 解析分享下载响应
 * 后端错误时可能返回 JSON 而非 ZIP，需检测避免保存损坏/空压缩包
 * @param res axios blob 响应
 * @returns 有效的文件 Blob
 * @throws 空 blob 或业务错误时抛出异常
 */
export async function parseShareDownloadResponse(
  res: AxiosResponse<Blob>
): Promise<Blob> {
  const contentType = String(
    res.headers['content-type'] || res.data?.type || ''
  ).toLowerCase()
  const blob = res.data

  // 响应实际为 JSON 错误体时，解析并抛出业务错误
  if (contentType.includes('application/json') || blob.type.includes('application/json')) {
    const text = await blob.text()
    try {
      const json = JSON.parse(text) as { code?: number; msg?: string }
      if (json.code != null && json.code !== 200) {
        throw new Error(json.msg || 'Download failed')
      }
    } catch (e) {
      // JSON 解析失败则当作二进制流处理
      if (e instanceof SyntaxError) {
        return new Blob([text], { type: 'application/octet-stream' })
      }
      throw e
    }
  }

  if (!blob || blob.size === 0) {
    throw new Error('EMPTY_BLOB')
  }

  return blob
}

/**
 * 从 axios 错误中提取 blob 型 JSON 错误信息
 * @param err 下载失败时的异常对象
 * @returns 后端错误 msg，无法解析时返回 undefined
 */
export async function extractShareDownloadError(err: unknown): Promise<string | undefined> {
  const data = (err as { response?: { data?: unknown } })?.response?.data
  if (!(data instanceof Blob)) return undefined
  try {
    const text = await data.text()
    const json = JSON.parse(text) as { msg?: string }
    return json.msg
  } catch {
    return undefined
  }
}
