/**
 * 大文件分片上传执行器
 *
 * 职责：管理单个/多个上传任务的生命周期，包括 MD5 校验、秒传检测、
 * 断点续传、并发分片上传、失败重试、暂停/恢复/取消等。
 * 合并分片由服务端在所有分片上传完成后自动触发。
 */
import { checkUpload, uploadChunk, getUploadedChunks } from '@/api/transfer'
import { calculateFileMD5, calculateBlobMD5 } from '@/utils/md5'

/** 单个分片的上传结果 */
export interface ChunkUploadResult {
  /** 分片索引（从 0 开始） */
  chunkIndex: number
  /** 是否上传成功 */
  success: boolean
  /** 失败时的错误信息 */
  error?: string
}

/** 上传任务的运行时上下文，保存在内存中供并发 worker 共享 */
interface UploadTaskContext {
  /** 服务端分配的任务 ID */
  taskId: string
  /** 待上传的原始 File 对象 */
  file: File
  /** 总分片数 */
  totalChunks: number
  /** 每个分片的字节大小 */
  chunkSize: number
  /** 已成功上传的分片索引集合（用于断点续传与进度计算） */
  uploadedChunks: Set<number>
  /** 是否已暂停 */
  isPaused: boolean
  /** 是否已取消 */
  isCancelled: boolean
  /** 正在进行中的分片上传对应的 AbortController，用于取消时中断请求 */
  activeUploads: Map<number, AbortController>
  /** 各分片已重试次数，key 为分片索引 */
  retryCount: Map<number, number>
  /** 并发上传 worker 数量 */
  concurrency: number
}

/** 进度回调数据 */
export interface ProgressUpdateData {
  /** 已上传字节数 */
  uploadedBytes: number
  /** 文件总字节数 */
  totalBytes: number
  /** 已上传分片数 */
  uploadedChunks: number
  /** 总分片数 */
  totalChunks: number
}

/** 上传执行器向外部（transfer store）注册的回调 */
export interface UploadExecutorCallbacks {
  /** 任务状态变更（checking / uploading / merging / completed 等） */
  onTransition: (taskId: string, status: string) => void
  /** 上传进度更新 */
  onProgress: (taskId: string, data: ProgressUpdateData) => void
  /** 上传失败 */
  onError: (taskId: string, errorMessage: string) => void
}

/**
 * 判断是否为网络类错误
 * 网络错误时自动转为 paused 状态，便于用户稍后恢复，而非直接标记失败
 */
function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('abort') ||
      message.includes('connection') ||
      message.includes('fetch')
    )
  }
  return false
}

/** 延迟指定毫秒，用于重试退避 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * 上传执行器（单例）
 * 通过 worker 池并发上传分片，支持暂停/恢复/取消
 */
class UploadExecutor {
  /** 单例实例 */
  private static instance: UploadExecutor | null = null

  /** 默认分片大小：5MB */
  public readonly CHUNK_SIZE = 5 * 1024 * 1024

  /** 默认并发数：同时上传 3 个分片 */
  public readonly DEFAULT_CONCURRENCY = 3

  /** 单个分片最大重试次数 */
  public readonly MAX_RETRY_COUNT = 3

  /** 重试基础延迟（毫秒），实际延迟 = 基础延迟 × 2^(重试次数-1) 指数退避 */
  private readonly RETRY_BASE_DELAY = 1000

  /** 所有活跃任务的上下文，key 为 taskId */
  private taskContexts = new Map<string, UploadTaskContext>()

  /** 全局默认并发数，可被 start() 参数或 setConcurrency 覆盖 */
  private concurrency = this.DEFAULT_CONCURRENCY

  /** 状态/进度/错误回调，由 transfer store 注册 */
  private callbacks: UploadExecutorCallbacks | null = null

  /** 获取单例 */
  public static getInstance(): UploadExecutor {
    if (!UploadExecutor.instance) {
      UploadExecutor.instance = new UploadExecutor()
    }
    return UploadExecutor.instance
  }

  /** 注册回调（通常只在 store 初始化时调用一次） */
  public setCallbacks(callbacks: UploadExecutorCallbacks): void {
    this.callbacks = callbacks
  }

  /** 设置全局默认并发数，最小为 1 */
  public setConcurrency(concurrency: number): void {
    this.concurrency = Math.max(1, concurrency)
  }

  /** 获取当前全局默认并发数 */
  public getConcurrency(): number {
    return this.concurrency
  }

  /** 根据文件大小和分片大小计算总分片数（向上取整） */
  public calculateChunkCount(fileSize: number, chunkSize: number): number {
    return Math.ceil(fileSize / chunkSize)
  }

  /**
   * 启动上传任务（主入口）
   *
   * 流程：创建上下文 → 计算 MD5 → 秒传检测 → 拉取已传分片 → 并发上传 → 通知 merging
   */
  public async start(
    taskId: string,
    file: File,
    concurrency?: number,
    chunkSize?: number
  ): Promise<void> {
    // 使用传入参数或默认值
    const taskChunkSize = chunkSize ?? this.CHUNK_SIZE
    const totalChunks = this.calculateChunkCount(file.size, taskChunkSize)
    const taskConcurrency = concurrency ?? this.concurrency

    // 初始化任务上下文并注册到内存 Map
    const context: UploadTaskContext = {
      taskId,
      file,
      totalChunks,
      chunkSize: taskChunkSize,
      uploadedChunks: new Set(),
      isPaused: false,
      isCancelled: false,
      activeUploads: new Map(),
      retryCount: new Map(),
      concurrency: taskConcurrency,
    }

    this.taskContexts.set(taskId, context)

    try {
      // 1. 进入 checking 状态，开始计算文件 MD5（大文件用快速指纹）
      this.notifyTransition(taskId, 'checking')

      const fileMd5 = await calculateFileMD5(file)

      // MD5 计算期间用户可能已暂停/取消
      if (context.isCancelled || context.isPaused) {
        return
      }

      // 2. 调用后端校验接口：秒传检测 + 初始化 multipart upload
      const checkResult = await checkUpload({
        taskId,
        fileMd5,
        fileName: file.name,
      })

      // 3. 秒传命中：文件已存在，直接完成
      if (checkResult.isQuickUpload) {
        this.notifyTransition(taskId, 'completed')
        this.cleanup(taskId)
        return
      }

      // 4. 断点续传：从后端拉取已上传的分片索引
      const uploadedChunks = await getUploadedChunks(taskId)
      const uploadedChunksList = uploadedChunks || []
      uploadedChunksList.forEach((index) => context.uploadedChunks.add(index))

      // 同步初始进度（续传场景下可能已有部分分片）
      this.notifyProgress(taskId, context)

      // 5. 进入 uploading 状态，开始并发上传剩余分片
      this.notifyTransition(taskId, 'uploading')

      await this.uploadChunks(context)

      // 上传过程中被暂停或取消，不再推进状态
      if (context.isCancelled) {
        return
      }

      if (context.isPaused) {
        return
      }

      // 6. 全部分片上传完成，通知 merging（实际合并由服务端自动触发）
      if (context.uploadedChunks.size === totalChunks) {
        this.notifyTransition(taskId, 'merging')
      }
    } catch (error) {
      // 网络错误 → 自动暂停；其他错误 → 标记失败
      if (isNetworkError(error)) {
        this.notifyTransition(taskId, 'paused')
      } else {
        const errorMessage = error instanceof Error ? error.message : '上传失败'
        this.notifyError(taskId, errorMessage)
      }
    }
  }

  /**
   * 暂停任务（仅设置标志位，正在进行的 worker 会在下一循环退出）
   * 不会 abort 当前请求，需配合 store 调用后端 pauseUpload
   */
  public pause(taskId: string): void {
    const context = this.taskContexts.get(taskId)
    if (!context) return
    context.isPaused = true
  }

  /**
   * 恢复上传
   * 重新从后端同步已传分片，然后继续上传剩余分片
   */
  public async resume(taskId: string): Promise<void> {
    const context = this.taskContexts.get(taskId)
    if (!context) return

    context.isPaused = false

    try {
      // 以服务端为准重新同步已传分片（防止前后端状态不一致）
      const backendUploadedChunks = await getUploadedChunks(taskId)
      const uploadedChunksList = backendUploadedChunks || []

      context.uploadedChunks.clear()
      uploadedChunksList.forEach((index) => context.uploadedChunks.add(index))

      this.notifyProgress(taskId, context)

      await this.uploadChunks(context)

      if (context.isCancelled || context.isPaused) {
        return
      }

      if (context.uploadedChunks.size === context.totalChunks) {
        this.notifyTransition(taskId, 'merging')
      } else {
        // 恢复后分片仍不完整，视为失败
        throw new Error(
          `分片不完整：已上传 ${context.uploadedChunks.size}/${context.totalChunks}`
        )
      }
    } catch (error) {
      if (isNetworkError(error)) {
        this.notifyTransition(taskId, 'paused')
      } else {
        const errorMessage = error instanceof Error ? error.message : '上传失败'
        this.notifyError(taskId, errorMessage)
      }
    }
  }

  /**
   * 取消任务
   * 设置取消标志、abort 所有进行中的请求、清理上下文
   */
  public cancel(taskId: string): void {
    const context = this.taskContexts.get(taskId)
    if (!context) return

    context.isCancelled = true
    context.isPaused = false

    // 中断所有正在进行的分片上传请求
    context.activeUploads.forEach((controller) => {
      controller.abort()
    })
    context.activeUploads.clear()

    this.cleanup(taskId)
  }

  /** 判断任务是否仍在运行（未暂停且未取消） */
  public isRunning(taskId: string): boolean {
    const context = this.taskContexts.get(taskId)
    return context !== undefined && !context.isPaused && !context.isCancelled
  }

  /** 获取任务上下文（供外部查询） */
  public getTaskContext(taskId: string): UploadTaskContext | undefined {
    return this.taskContexts.get(taskId)
  }

  /** 取消所有任务并清空上下文（页面卸载等场景） */
  public clearAll(): void {
    this.taskContexts.forEach((context) => {
      context.activeUploads.forEach((controller) => {
        controller.abort()
      })
    })
    this.taskContexts.clear()
  }

  /** 通知外部任务状态变更 */
  private notifyTransition(taskId: string, status: string): void {
    if (this.callbacks?.onTransition) {
      this.callbacks.onTransition(taskId, status)
    }
  }

  /**
   * 计算并通知上传进度
   * 已上传字节数 = 各已传分片的实际大小之和（最后一片可能不足 chunkSize）
   */
  private notifyProgress(taskId: string, context: UploadTaskContext): void {
    if (!this.callbacks?.onProgress) return

    const { file, totalChunks, uploadedChunks, chunkSize } = context

    let uploadedBytes = 0
    uploadedChunks.forEach((chunkIndex) => {
      const start = chunkIndex * chunkSize
      const end = Math.min(start + chunkSize, file.size)
      uploadedBytes += end - start
    })

    this.callbacks.onProgress(taskId, {
      uploadedBytes,
      totalBytes: file.size,
      uploadedChunks: uploadedChunks.size,
      totalChunks,
    })
  }

  /** 通知外部上传失败 */
  private notifyError(taskId: string, errorMessage: string): void {
    if (this.callbacks?.onError) {
      this.callbacks.onError(taskId, errorMessage)
    }
  }

  /**
   * 并发上传所有未传分片
   *
   * 采用 worker 池模式：启动 N 个 worker，每个 worker 从共享队列取分片索引上传。
   * N = min(concurrency, 待上传分片数)
   */
  private async uploadChunks(context: UploadTaskContext): Promise<void> {
    const { taskId, totalChunks, uploadedChunks, concurrency } = context

    // 收集尚未上传的分片索引
    const chunksToUpload: number[] = []
    for (let i = 0; i < totalChunks; i += 1) {
      if (!uploadedChunks.has(i)) {
        chunksToUpload.push(i)
      }
    }

    // 全部已传，无需上传
    if (chunksToUpload.length === 0) return

    // 共享游标：各 worker 通过 localIndex 原子递增取任务（JS 单线程，无竞态）
    let currentIndex = 0

    /** 单个 worker：循环取分片并上传，直到队列耗尽或任务被暂停/取消 */
    const uploadWorker = async (): Promise<void> => {
      while (currentIndex < chunksToUpload.length) {
        if (context.isPaused || context.isCancelled) {
          break
        }

        const localIndex = currentIndex
        currentIndex += 1

        const chunkIndex = chunksToUpload[localIndex]

        const result = await this.uploadChunkWithRetry(
          context,
          context.file,
          chunkIndex
        )

        if (result.success) {
          uploadedChunks.add(chunkIndex)
          this.notifyProgress(taskId, context)
        } else if (!context.isCancelled && !context.isPaused) {
          // 非用户主动中断的失败，抛出错误终止所有 worker
          throw new Error(result.error || `分片 ${chunkIndex} 上传失败`)
        }
      }
    }

    // 启动 worker 池
    const workerCount = Math.min(concurrency, chunksToUpload.length)
    const workers = Array.from({ length: workerCount }, () => uploadWorker())

    await Promise.all(workers)
  }

  /**
   * 上传单个分片（含重试）
   *
   * 流程：File.slice 切片 → 计算分片 MD5 → 调用 uploadChunk API → 失败则指数退避重试
   */
  private async uploadChunkWithRetry(
    context: UploadTaskContext,
    file: File,
    chunkIndex: number
  ): Promise<ChunkUploadResult> {
    const { taskId, chunkSize } = context
    let retryCount = context.retryCount.get(chunkIndex) || 0

    while (retryCount <= this.MAX_RETRY_COUNT) {
      if (context.isPaused || context.isCancelled) {
        return { chunkIndex, success: false, error: '任务已暂停或取消' }
      }

      try {
        // 创建 AbortController 以便取消时中断（当前 uploadChunk API 未传入 signal，预留扩展）
        const abortController = new AbortController()
        context.activeUploads.set(chunkIndex, abortController)

        // 按索引计算字节范围并切片
        const start = chunkIndex * chunkSize
        const end = Math.min(start + chunkSize, file.size)
        const chunkBlob = file.slice(start, end)

        // 计算分片 MD5，供服务端校验完整性
        const chunkMd5 = await calculateBlobMD5(chunkBlob)

        if (context.isCancelled) {
          context.activeUploads.delete(chunkIndex)
          return { chunkIndex, success: false, error: '任务已取消' }
        }

        // 上传分片到服务端
        await uploadChunk(chunkBlob, taskId, chunkIndex, chunkMd5)

        context.activeUploads.delete(chunkIndex)
        context.retryCount.delete(chunkIndex)

        return { chunkIndex, success: true }
      } catch (error) {
        context.activeUploads.delete(chunkIndex)

        if (context.isCancelled) {
          return { chunkIndex, success: false, error: '任务已取消' }
        }

        retryCount += 1
        context.retryCount.set(chunkIndex, retryCount)

        if (retryCount <= this.MAX_RETRY_COUNT) {
          // 指数退避：1s → 2s → 4s
          const delay = this.RETRY_BASE_DELAY * 2 ** (retryCount - 1)
          await sleep(delay)
        } else {
          const errorMessage =
            error instanceof Error ? error.message : '上传失败'
          return {
            chunkIndex,
            success: false,
            error: `分片 ${chunkIndex} 上传失败（已重试 ${this.MAX_RETRY_COUNT} 次）: ${errorMessage}`,
          }
        }
      }
    }

    return {
      chunkIndex,
      success: false,
      error: `分片 ${chunkIndex} 上传失败`,
    }
  }

  /** 从内存中移除任务上下文 */
  private cleanup(taskId: string): void {
    this.taskContexts.delete(taskId)
  }
}

/** 导出单例，供 transfer store 调用 */
export const uploadExecutor = UploadExecutor.getInstance()
