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
 * 分页获取我的分享列表
 */
export function getMySharePage(params?: SharePageQuery) {
  return request.get<PageRecord<ShareItem>>('/apis/share/pages', { params })
}

/**
 * 创建分享
 */
export function shareFiles(params: ShareCreateParams) {
  return request.post<ShareCreateResponse>('/apis/share/create', params)
}

/**
 * 取消分享（支持单个和批量）
 */
export function cancelShares(ids: string[]) {
  return request.delete('/apis/share/cancels', { data: ids })
}

/**
 * 清空当前用户全部分享
 */
export function clearAllShares() {
  return request.delete<unknown>('/apis/share/clears')
}

/**
 * 查看分享详情
 */
export function getShareDetail(shareId: string) {
  return request.get<ShareThin>(`/apis/share/${shareId}/info`)
}

/**
 * 验证分享码
 */
export function validateShareCode(params: ShareValidParams) {
  return request.post<boolean>('/apis/share/verify/code', params)
}

type RequestOpts = AxiosRequestConfig & { showErrorMessage?: boolean }

/**
 * 分享页当前目录面包屑（刷新/直达链接时用于与 URL 同步）。
 * 旧后端无此接口时会 404，须静默失败，避免全局 toast「资源未找到」。
 */
export function getShareBreadcrumb(shareId: string, parentId: string) {
  return request.get<ShareBreadcrumbItem[]>(`/apis/share/${shareId}/path`, {
    params: { parentId },
    showErrorMessage: false,
  } as RequestOpts)
}

/**
 * 获取分享文件列表
 */
export function getShareItemList(shareId: string, parentId?: string) {
  return request.get<FileItem[]>(`/apis/share/${shareId}/items`, {
    params: parentId ? { parentId } : undefined,
  })
}

/**
 * 获取分享详细信息（用于查看详情）
 */
export function getShareDetailById(shareId: string) {
  return request.get<ShareItem>(`/apis/share/${shareId}`)
}

/**
 * 获取分享访问记录列表
 */
export function getShareAccessRecords(shareId: string) {
  return request.get<ShareAccessRecord[]>(
    `/apis/share/${shareId}/access/records`
  )
}

/**
 * 下载分享文件
 */
export function downloadShareFile(shareId: string, fileId: string) {
  return service.get(`/apis/share/${shareId}/download/${fileId}`, {
    responseType: 'blob',
  })
}

/** 解析分享下载响应；后端错误时可能返回 JSON 而非 ZIP，避免保存损坏/空压缩包 */
export async function parseShareDownloadResponse(
  res: AxiosResponse<Blob>
): Promise<Blob> {
  const contentType = String(
    res.headers['content-type'] || res.data?.type || ''
  ).toLowerCase()
  const blob = res.data

  if (contentType.includes('application/json') || blob.type.includes('application/json')) {
    const text = await blob.text()
    try {
      const json = JSON.parse(text) as { code?: number; msg?: string }
      if (json.code != null && json.code !== 200) {
        throw new Error(json.msg || 'Download failed')
      }
    } catch (e) {
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

/** 从 axios 错误中提取 blob 型 JSON 错误信息 */
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
