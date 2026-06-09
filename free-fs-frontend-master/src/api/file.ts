/**
 * 文件管理 API 模块
 *
 * 封装网盘文件/文件夹的 CRUD、回收站、收藏、预览等接口。
 */
import { AxiosProgressEvent } from 'axios'
import type {
  FileListParams,
  FileItem,
  FileRecycleItem,
  RecyclePageQuery,
} from '@/types/file'
import type { PageRecord } from '@/types/page'
import { request } from './request'

/**
 * 分页查询文件列表
 * @param params 分页、排序、父目录等查询条件
 * @returns 分页文件列表
 */
export function getFileList(params: FileListParams) {
  return request.get<PageRecord<FileItem>>('/apis/file/list', { params })
}

/**
 * 获取单个文件详情
 * @param fileId 文件 ID
 * @returns 文件元信息
 */
export function getFileDetail(fileId: string) {
  return request.get<FileItem>(`/apis/file/${fileId}`)
}

/**
 * 查询指定父目录下的子文件夹列表
 * @param parentId 父目录 ID，不传则查根目录
 * @returns 文件夹列表
 */
export function getFolders(parentId?: string | null) {
  return request.get<FileItem[]>('/apis/file/dirs', {
    params: parentId ? { parentId } : {},
  })
}

/**
 * 获取文件夹路径（面包屑导航）
 * @param folderId 当前文件夹 ID
 * @returns 从根到当前目录的路径节点列表
 */
export function getFolderPath(folderId: string) {
  return request.get<FileItem[]>(`/apis/file/directory/${folderId}/path`)
}

/**
 * 上传单个文件（小文件直传）
 * @param file 浏览器 File 对象
 * @param parentId 目标父目录 ID
 * @param onProgress 上传进度回调
 * @returns 上传结果
 */
export function uploadFile(
  file: File,
  parentId?: string,
  onProgress?: (progressEvent: AxiosProgressEvent) => void
) {
  const formData = new FormData()
  formData.append('file', file)
  if (parentId) {
    formData.append('parentId', parentId)
  }
  return request.post('/apis/file/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: onProgress,
  })
}

/**
 * 创建文件夹
 * @param data.folderName 文件夹名称
 * @param data.parentId 父目录 ID（可选）
 * @returns 新建文件夹信息
 */
export function createFolder(data: { folderName: string; parentId?: string }) {
  return request.post<FileItem>('/apis/file/directory', data)
}

/**
 * 删除文件（移入回收站，非物理删除）
 * @param fileIds 待删除文件 ID 列表
 */
export function deleteFiles(fileIds: string[]) {
  return request.delete('/apis/file', { data: fileIds })
}

/**
 * 重命名文件或文件夹
 * @param fileId 文件 ID
 * @param displayName 新显示名称
 */
export function renameFile(fileId: string, displayName: string) {
  return request.put(`/apis/file/${fileId}/rename`, { displayName })
}

/**
 * 批量移动文件到目标目录
 * @param dirId 目标目录 ID
 * @param fileIds 待移动文件 ID 列表
 */
export function moveFiles(dirId: string, fileIds: string[]) {
  return request.put('/apis/file/moves', { dirId, fileIds })
}

/**
 * 分页获取回收站文件列表
 * @param params 分页查询参数
 * @returns 回收站分页数据
 */
export function getRecyclePage(params?: RecyclePageQuery) {
  return request.get<PageRecord<FileRecycleItem>>('/apis/file/recycle/pages', {
    params,
  })
}

/**
 * 从回收站还原文件
 * @param fileIds 待还原文件 ID 列表
 */
export function restoreFiles(fileIds: string[]) {
  return request.put('/apis/file/recycles', fileIds)
}

/**
 * 彻底删除回收站中的文件（不可恢复）
 * @param fileIds 待删除文件 ID 列表
 */
export function permanentDeleteFiles(fileIds: string[]) {
  return request.delete('/apis/file/recycles', { data: fileIds })
}

/**
 * 清空回收站（删除所有回收站文件）
 */
export function clearRecycle() {
  return request.delete('/apis/file/recycles/clear')
}

/**
 * 收藏文件
 * @param fileIds 待收藏文件 ID 列表
 */
export function favoriteFile(fileIds: string[]) {
  return request.post('/apis/file/favorites', fileIds)
}

/**
 * 取消收藏文件
 * @param fileIds 待取消收藏的文件 ID 列表
 */
export function unfavoriteFile(fileIds: string[]) {
  return request.delete('/apis/file/favorites', { data: fileIds })
}

/**
 * 获取文件临时访问 URL（用于预览/外链）
 * @param fileId 文件 ID
 * @param expireSeconds URL 过期秒数，默认 180
 * @returns 带签名的访问 URL
 */
export function getFilePreviewUrl(fileId: string, expireSeconds = 180) {
  return request.get(`/apis/file/url/${fileId}`, { params: { expireSeconds } })
}

/**
 * 获取文件预览令牌（供预览服务鉴权）
 * @param fileId 文件 ID
 * @returns 预览令牌字符串
 */
export function getPreviewToken(fileId: string) {
  return request.post<string>(`/preview/token/${fileId}`)
}
