/**
 * 文件传输 API 模块
 *
 * 大文件分片上传流程对应接口：
 * initUpload → checkUpload → uploadChunk（循环）→ 服务端自动 merge
 * 断点续传通过 getUploadedChunks 查询已传分片实现。
 */
import type {
  FileTransferTaskVO,
  InitUploadCmd,
  CheckUploadCmd,
  CheckUploadResultVO,
} from '@/types/transfer'
import { request } from './request'

/**
 * 初始化上传任务
 * 服务端创建 FileTransferTask 记录，返回 taskId
 * @param params 文件名、大小、MD5、父目录等
 * @returns 上传任务 ID
 */
export function initUpload(params: InitUploadCmd) {
  return request.post<string>('/apis/transfer/init', params)
}

/**
 * 校验文件（秒传检测 + 初始化 multipart upload）
 * 传入 fileMd5，若服务端已有相同文件则返回 isQuickUpload=true 实现秒传
 * @param params 含 fileMd5、taskId 等校验参数
 * @returns 秒传结果及 multipart 信息
 */
export function checkUpload(params: CheckUploadCmd) {
  return request.post<CheckUploadResultVO>('/apis/transfer/check', params)
}

/**
 * 上传单个分片
 * 使用 multipart/form-data 提交分片二进制、taskId、chunkIndex、chunkMd5
 * @param file 分片 Blob
 * @param taskId 上传任务 ID
 * @param chunkIndex 分片序号（从 0 起）
 * @param chunkMd5 分片 MD5 校验值
 */
export function uploadChunk(
  file: Blob,
  taskId: string,
  chunkIndex: number,
  chunkMd5: string
) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('taskId', taskId)
  formData.append('chunkIndex', chunkIndex.toString())
  formData.append('chunkMd5', chunkMd5)

  return request.post('/apis/transfer/chunk', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    // 单分片超时 60 秒，大分片或弱网环境需要足够时间
    timeout: 60000,
  })
}

/**
 * 查询已上传的分片索引列表
 * 用于断点续传：前端跳过这些分片，只上传剩余部分
 * @param taskId 上传任务 ID
 * @returns 已上传分片序号数组
 */
export function getUploadedChunks(taskId: string) {
  return request.get<number[]>(`/apis/transfer/chunks/${taskId}`)
}

/**
 * 手动触发合并分片
 * 注：当前流程中合并由服务端在最后一个分片上传完成后自动触发，此接口为备用
 * @param taskId 上传任务 ID
 * @returns 合并后的文件 ID 或任务结果
 */
export function mergeChunks(taskId: string) {
  return request.post<string>(`/apis/transfer/merge/${taskId}`)
}

/**
 * 取消上传任务
 * 服务端清理 multipart upload 及缓存
 * @param taskId 上传任务 ID
 */
export function cancelUpload(taskId: string) {
  return request.delete(`/apis/transfer/cancel/${taskId}`)
}

/**
 * 获取当前用户所有传输任务列表
 * @returns 传输任务 VO 列表
 */
export function getTransferFiles() {
  return request.get<FileTransferTaskVO[]>('/apis/transfer/files')
}

/**
 * 暂停上传任务
 * 服务端标记 paused，拒绝新分片
 * @param taskId 上传任务 ID
 */
export function pauseUpload(taskId: string) {
  return request.post(`/apis/transfer/pause/${taskId}`)
}

/**
 * 恢复上传任务
 * 服务端标记 uploading，允许继续接收分片
 * @param taskId 上传任务 ID
 */
export function resumeUpload(taskId: string) {
  return request.post(`/apis/transfer/resume/${taskId}`)
}

/**
 * 清空所有已完成的传输任务记录
 */
export function clearCompletedTasks() {
  return request.delete('/apis/transfer/clears')
}
