/**
 * 文件传输任务 Store
 *
 * 职责：管理上传任务的全局状态（进度、状态机、会话分组），
 * 协调 uploadExecutor 分片上传与后端 SSE 实时推送，
 * 提供单文件/文件夹批量上传、暂停/恢复/取消/重试等操作。
 * SSE 不可用时降级为轮询 syncTasks。
 */
import { sseService } from '@/services/sse.service'
import { uploadExecutor } from '@/services/upload-executor'
import type {
  TransferTask,
  TaskStatus,
  ProgressUpdate,
  FileTransferTaskVO,
  SSEMessage,
} from '@/types/transfer'
import { toast } from 'sonner'
import { create } from 'zustand'
import {
  getTransferFiles,
  pauseUpload,
  resumeUpload,
  cancelUpload,
  initUpload,
  clearCompletedTasks as clearCompletedTasksApi,
} from '@/api/transfer'
import { createFolder } from '@/api/file'
import { UPLOAD_LIMITS, formatFileSize, shouldFilterFile } from '@/config/upload-limits'
import { pool } from '@/utils/async-pool'
import { progressCalculator } from '@/utils/progress-calculator'
import { stateMachine } from '@/utils/transfer-state-machine'
import i18n from '@/i18n'
import { useUserStore } from './user'

/** 传输任务 Store 的状态结构与操作方法 */
interface TransferStore {
  /** 所有传输任务，key 为 taskId */
  tasks: Map<string, TransferTask>
  /** SSE 是否已连接 */
  sseConnected: boolean
  /** 当前上传会话 ID（一次拖拽/选择对应一个 session） */
  currentSessionId: string | null
  /** 会话 ID → 该会话内 taskId 列表的映射 */
  sessionTasks: Map<string, string[]>
  /** taskId → 原始 File 对象，供暂停恢复、重试使用（无法持久化） */
  fileCache: Map<string, File>
  /** 已触发完成副作用（toast、刷新文件列表）的 taskId 集合，防重复 */
  completedActionsTriggered: Set<string>
  /** 已弹出失败 toast 的 taskId 集合，防重复 */
  errorNotificationTriggered: Set<string>

  /** 获取全部任务列表（数组形式） */
  getTaskList: () => TransferTask[]
  /** 获取进行中的任务（idle ~ merging、paused） */
  getUploadingTasks: () => TransferTask[]
  /** 获取已结束的任务（completed / failed / cancelled） */
  getCompletedTasks: () => TransferTask[]
  /** 获取当前会话内的任务列表 */
  getCurrentSessionTasks: () => TransferTask[]

  /** 更新 SSE 连接状态 */
  setSseConnected: (connected: boolean) => void
  /** 通过状态机将任务切换到新状态，成功时可能触发完成副作用 */
  transitionTo: (taskId: string, newStatus: TaskStatus) => boolean
  /** 更新任务上传进度（经 progressCalculator 节流与平滑） */
  updateProgress: (taskId: string, data: ProgressUpdate) => void
  /** 将任务标记为失败并弹出错误提示（每个 taskId 仅提示一次） */
  setTaskError: (taskId: string, errorMessage: string) => void
  /** 处理 SSE 推送消息（progress / status / complete / error） */
  handleSSEMessage: (message: SSEMessage) => void
  /** 从后端拉取全量任务列表并替换本地 tasks */
  fetchTasks: () => Promise<void>
  /** 与后端增量同步任务状态，合并本地与服务端数据 */
  syncTasks: () => Promise<void>
  /** 创建新的上传会话并设为当前 session，返回 sessionId */
  startUploadSession: () => string
  /** 创建单个文件上传任务并启动 uploadExecutor */
  createTask: (
    file: File,
    parentId?: string,
    sessionId?: string
  ) => Promise<string>
  /** 解析文件夹结构、创建目录并批量创建上传任务 */
  createTasksWithDirectory: (
    files: File[],
    parentId?: string
  ) => Promise<void>
  /** 暂停指定任务（前端 worker + 后端 API） */
  pauseTask: (taskId: string) => Promise<void>
  /** 恢复指定任务（后端 API + uploadExecutor.resume） */
  resumeTask: (taskId: string) => Promise<void>
  /** 取消指定任务并清理缓存 */
  cancelTask: (taskId: string) => Promise<void>
  /** 重试失败任务（复用 taskId 断点续传） */
  retryTask: (taskId: string) => Promise<void>
  /** 清空已完成/失败/取消的任务（本地 + 后端） */
  clearCompletedTasks: () => Promise<void>
  /** 初始化 SSE 连接、拉取任务、注册轮询与页面离开警告 */
  initSSE: (userId: string) => Promise<void>
  /** 断开 SSE 并停止轮询 */
  disconnectSSE: () => void
  /** 获取任务的展示用进度、速度、剩余时间（来自 progressCalculator） */
  getDisplayData: (taskId: string) => {
    progress: number
    speed: number
    remainingTime: number
  }

  /** 任务完成时的副作用：toast、派发 file-upload-complete、清理计算器与缓存 */
  triggerCompletedActions: (task: TransferTask) => void
  /** 页面首次加载时自动取消刷新前未完成的任务（仅执行一次） */
  checkUnfinishedTasks: () => Promise<void>
  /** 若有活跃任务且未在轮询，则启动轮询 */
  checkAndStartPolling: () => void
  /** 启动定时 syncTasks 轮询（SSE 降级方案） */
  startPolling: () => void
  /** 停止轮询定时器 */
  stopPolling: () => void
  /** 注册 beforeunload 警告，防止用户误关页面上传中断 */
  setupBeforeUnloadWarning: () => void
}

/** SSE 消息订阅的取消函数 */
let sseMessageUnsubscribe: (() => void) | null = null
/** SSE 连接状态订阅的取消函数 */
let sseConnectionUnsubscribe: (() => void) | null = null
/** uploadExecutor 回调是否已注册（全局仅注册一次） */
let callbacksInitialized = false
/** 是否已执行过页面刷新后的未完成 task 清理 */
let hasCheckedUnfinishedTasks = false
/** 轮询定时器 ID，null 表示未在轮询 */
let pollingTimerId: number | null = null
/** beforeunload 监听是否已注册 */
let beforeUnloadWarningSetup = false
/** SSE 降级轮询间隔（毫秒） */
const POLLING_INTERVAL = 3000

/** 批量创建上传任务时的并发上限，避免海量 initUpload + MD5 同时启动拖死页面 */
const BATCH_CREATE_TASK_CONCURRENCY = 8

/**
 * 将后端 FileTransferTaskVO 转为前端 TransferTask
 * @param vo 后端返回的任务视图对象
 */
function convertVOToTask(vo: FileTransferTaskVO): TransferTask {
  const now = Date.now()
  const progress = vo.progress ?? 0
  const formattedProgress = Math.round(progress)

  return {
    taskId: vo.taskId,
    fileName: vo.fileName,
    fileSize: vo.fileSize,
    status: vo.status as TaskStatus,
    progress: formattedProgress,
    uploadedBytes: vo.uploadedSize ?? 0,
    speed: vo.speed ?? 0,
    remainingTime: vo.remainTime ?? 0,
    errorMessage: vo.errorMsg,
    createdAt: vo.startTime ? new Date(vo.startTime).getTime() : now,
    updatedAt: now,
    parentId: vo.parentId,
    totalChunks: vo.totalChunks,
    uploadedChunks: vo.uploadedChunks,
    chunkSize: vo.chunkSize,
  }
}

/** 文件传输任务 Store Hook */
export const useTransferStore = create<TransferStore>((set, get) => ({
  tasks: new Map(),
  sseConnected: false,
  currentSessionId: null,
  sessionTasks: new Map(),
  fileCache: new Map(),
  completedActionsTriggered: new Set(),
  errorNotificationTriggered: new Set(),

  /** @see TransferStore.getTaskList */
  getTaskList: () => Array.from(get().tasks.values()),

  /** @see TransferStore.getUploadingTasks */
  getUploadingTasks: () =>
    get()
      .getTaskList()
      .filter((task) =>
        [
          'idle',
          'initialized',
          'checking',
          'uploading',
          'paused',
          'merging',
        ].includes(task.status)
      ),

  /** @see TransferStore.getCompletedTasks */
  getCompletedTasks: () =>
    get()
      .getTaskList()
      .filter((task) =>
        ['completed', 'failed', 'cancelled'].includes(task.status)
      ),

  /** @see TransferStore.getCurrentSessionTasks */
  getCurrentSessionTasks: () => {
    const { currentSessionId, sessionTasks, tasks } = get()
    if (!currentSessionId) return []
    const taskIds = sessionTasks.get(currentSessionId) || []
    return taskIds
      .map((id) => tasks.get(id))
      .filter((task): task is TransferTask => task !== undefined)
  },

  /** @see TransferStore.setSseConnected */
  setSseConnected: (connected) => set({ sseConnected: connected }),

  /** @see TransferStore.transitionTo */
  transitionTo: (taskId, newStatus) => {
    const { tasks, completedActionsTriggered } = get()
    const task = tasks.get(taskId)
    if (!task) return false

    // 状态未变但重复收到 completed 时，仍补触发完成副作用
    if (task.status === newStatus) {
      if (newStatus === 'completed' && !completedActionsTriggered.has(taskId)) {
        get().triggerCompletedActions(task)
      }
      return true
    }

    const updatedTask = stateMachine.transition(task, newStatus)
    if (updatedTask) {
      const newTasks = new Map(tasks)
      newTasks.set(taskId, updatedTask)
      set({ tasks: newTasks })

      if (newStatus === 'completed' && !completedActionsTriggered.has(taskId)) {
        get().triggerCompletedActions(updatedTask)
      }

      get().checkAndStartPolling()
      return true
    }

    return false
  },

  /** @see TransferStore.triggerCompletedActions */
  triggerCompletedActions: (task: TransferTask) => {
    const { completedActionsTriggered, fileCache } = get()
    completedActionsTriggered.add(task.taskId)

    toast.success(
      i18n.t('files:uploadPanel.toastFileComplete', { name: task.fileName })
    )

    window.dispatchEvent(
      new CustomEvent('file-upload-complete', {
        detail: { parentId: task.parentId },
      })
    )

    progressCalculator.clear(task.taskId)
    fileCache.delete(task.taskId)

    if (uploadExecutor.getTaskContext(task.taskId)) {
      uploadExecutor.cancel(task.taskId)
    }
  },

  /** @see TransferStore.setTaskError */
  setTaskError: (taskId, errorMessage) => {
    const { tasks, errorNotificationTriggered } = get()
    const task = tasks.get(taskId)
    if (task) {
      get().transitionTo(taskId, 'failed')
      const updatedTask = tasks.get(taskId)
      if (updatedTask) {
        const newTasks = new Map(tasks)
        newTasks.set(taskId, { ...updatedTask, errorMessage })
        set({ tasks: newTasks })
      }

      if (!errorNotificationTriggered.has(taskId)) {
        errorNotificationTriggered.add(taskId)
        toast.error(
          i18n.t('files:uploadPanel.toastFileFailed', {
            name: task.fileName,
            message: errorMessage,
          })
        )
      }
    }
  },

  /** @see TransferStore.updateProgress */
  updateProgress: (taskId, data) => {
    const { tasks } = get()
    const task = tasks.get(taskId)
    if (!task) return

    // progressCalculator 内部节流，避免高频 SSE 导致 UI 抖动
    const shouldUpdate = progressCalculator.update(
      taskId,
      data.uploadedBytes,
      data.totalBytes
    )

    if (shouldUpdate) {
      const displayData = progressCalculator.getDisplayData(taskId)

      const updatedTask: TransferTask = {
        ...task,
        uploadedBytes: data.uploadedBytes,
        progress: displayData.progress,
        speed: displayData.speed,
        remainingTime: displayData.remainingTime,
        updatedAt: Date.now(),
      }

      if (data.uploadedChunks !== undefined) {
        updatedTask.uploadedChunks = data.uploadedChunks
      }
      if (data.totalChunks !== undefined) {
        updatedTask.totalChunks = data.totalChunks
      }

      const newTasks = new Map(tasks)
      newTasks.set(taskId, updatedTask)
      set({ tasks: newTasks })
    }
  },

  /**
   * @see TransferStore.handleSSEMessage
   * merging → completed 的状态流转由服务端推送驱动
   */
  handleSSEMessage: (message) => {
    const { type, taskId, data } = message

    switch (type) {
      case 'progress': {
        const progressData = data as any
        get().updateProgress(taskId, {
          uploadedBytes: progressData.uploadedBytes,
          totalBytes: progressData.totalBytes,
          uploadedChunks: progressData.uploadedChunks,
          totalChunks: progressData.totalChunks,
        })
        break
      }

      case 'status': {
        const statusData = data as any
        if (statusData.status) {
          get().transitionTo(taskId, statusData.status)
        }
        break
      }

      case 'complete': {
        get().transitionTo(taskId, 'completed')
        break
      }

      case 'error': {
        const errorData = data as any
        get().setTaskError(taskId, errorData.message || '上传失败')
        break
      }

      default:
        break
    }
  },

  /** @see TransferStore.fetchTasks */
  fetchTasks: async () => {
    try {
      const taskVOs = await getTransferFiles()

      const newTasks = new Map<string, TransferTask>()
      progressCalculator.clearAll()

      // 确保 taskVOs 是数组
      const tasks = Array.isArray(taskVOs) ? taskVOs : []

      tasks.forEach((vo) => {
        const task = convertVOToTask(vo)
        newTasks.set(task.taskId, task)
      })

      set({ tasks: newTasks })

      await get().checkUnfinishedTasks()
    } catch (error) {
      console.error('获取传输任务列表失败:', error)
      // 静默失败，不抛出错误
    }
  },

  /** @see TransferStore.checkUnfinishedTasks */
  checkUnfinishedTasks: async () => {
    if (hasCheckedUnfinishedTasks) return
    hasCheckedUnfinishedTasks = true

    const { tasks } = get()
    const unfinishedTasks = Array.from(tasks.values()).filter(
      (task) =>
        task.status === 'idle' ||
        task.status === 'initialized' ||
        task.status === 'uploading' ||
        task.status === 'checking' ||
        task.status === 'paused' ||
        task.status === 'merging'
    )

    if (unfinishedTasks.length === 0) return

    const results = await Promise.allSettled(
      unfinishedTasks.map(async (task) => {
        try {
          await cancelUpload(task.taskId)
          get().transitionTo(task.taskId, 'cancelled')
          return { success: true, taskId: task.taskId }
        } catch (error: any) {
          // 如果任务不存在，也算成功（因为目标已达成）
          if (
            error?.message?.includes('任务不存在') ||
            error?.response?.data?.message?.includes('任务不存在')
          ) {
            get().transitionTo(task.taskId, 'cancelled')
            return { success: true, taskId: task.taskId }
          }
          console.error('取消任务失败:', task.taskId, error)
          return { success: false, taskId: task.taskId, error }
        }
      })
    )

    const successCount = results.filter(
      (r) => r.status === 'fulfilled' && r.value.success
    ).length
    const failCount = results.length - successCount

    if (successCount > 0) {
      toast.info(`已自动取消 ${successCount} 个未完成的上传任务`, {
        description:
          failCount > 0
            ? `${failCount} 个任务取消失败`
            : '页面刷新会中断上传，建议等待上传完成后再刷新',
      })
    }
  },

  /** @see TransferStore.syncTasks */
  syncTasks: async () => {
    try {
      const taskVOs = await getTransferFiles()
      const { tasks } = get()

      const newTasks = new Map(tasks)

      // 确保 taskVOs 是数组
      const taskList = Array.isArray(taskVOs) ? taskVOs : []

      taskList.forEach((vo) => {
        const existingTask = newTasks.get(vo.taskId)
        const newTask = convertVOToTask(vo)

        if (!existingTask) {
          newTasks.set(vo.taskId, newTask)
        } else {
          // 状态优先级：数值越大表示越「终态」，避免 SSE 与轮询互相覆盖
          const statePriority: Record<TaskStatus, number> = {
            idle: 0,
            initialized: 1,
            checking: 2,
            paused: 3,
            uploading: 4,
            merging: 5,
            cancelled: 6,
            failed: 7,
            completed: 8,
          }

          const existingPriority = statePriority[existingTask.status] || 0
          const newPriority = statePriority[newTask.status] || 0

          if (
            newPriority > existingPriority ||
            newTask.status === 'completed' ||
            newTask.status === 'failed' ||
            newTask.status === 'cancelled'
          ) {
            // 服务端状态更「新」或是终态，整体覆盖
            newTasks.set(vo.taskId, newTask)
          } else {
            // 保留本地状态，仅合并进度相关字段
            newTasks.set(vo.taskId, {
              ...existingTask,
              uploadedBytes: newTask.uploadedBytes,
              uploadedChunks: newTask.uploadedChunks,
              totalChunks: newTask.totalChunks,
            })
          }
        }
      })

      // 后端已不存在的任务从本地移除
      const backendTaskIds = new Set(taskList.map((vo) => vo.taskId))
      newTasks.forEach((_, taskId) => {
        if (!backendTaskIds.has(taskId)) {
          newTasks.delete(taskId)
          progressCalculator.clear(taskId)
        }
      })

      set({ tasks: newTasks })
    } catch (error) {
      console.error('同步传输任务失败:', error)
      // 静默失败，不抛出错误
    }
  },

  /** @see TransferStore.startUploadSession */
  startUploadSession: () => {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const { sessionTasks } = get()
    const newSessionTasks = new Map(sessionTasks)
    newSessionTasks.set(sessionId, [])
    set({ currentSessionId: sessionId, sessionTasks: newSessionTasks })
    return sessionId
  },

  /**
   * @see TransferStore.createTask
   *
   * 流程：读取用户传输设置 → 注册 uploadExecutor 回调 → 调用 initUpload 创建服务端任务
   * → 写入 store 与 fileCache → 启动 uploadExecutor.start 开始分片上传
   */
  createTask: async (file, parentId, sessionId) => {
    // 从用户 store 获取分片大小、并发数等传输设置
    const userStore = useUserStore.getState()
    if (!userStore.transferSetting) {
      await userStore.loadTransferSetting()
    }

    const settings = userStore.transferSetting!
    const chunkSize = settings.chunkSize
    const concurrency = settings.concurrentUploadQuantity

    // 首次创建任务时注册 uploadExecutor 回调，将执行器事件同步到 store 状态机
    if (!callbacksInitialized) {
      callbacksInitialized = true
      uploadExecutor.setCallbacks({
        onTransition: (taskId, status) => {
          get().transitionTo(taskId, status as TaskStatus)
        },
        onProgress: (taskId, data) => {
          get().updateProgress(taskId, data)
        },
        onError: (taskId, errorMessage) => {
          get().setTaskError(taskId, errorMessage)
        },
      })
    }

    const totalChunks = Math.ceil(file.size / chunkSize)

    // 调用后端 init 接口，创建 FileTransferTask 并获取 taskId
    const taskId = await initUpload({
      fileName: file.name,
      fileSize: file.size,
      parentId,
      totalChunks,
      chunkSize,
      mimeType: file.type || 'application/octet-stream',
    })

    const now = Date.now()

    const task: TransferTask = {
      taskId,
      fileName: file.name,
      fileSize: file.size,
      status: 'idle',
      progress: 0,
      uploadedBytes: 0,
      speed: 0,
      remainingTime: 0,
      createdAt: now,
      updatedAt: now,
      parentId,
      mimeType: file.type || 'application/octet-stream',
      totalChunks,
      uploadedChunks: 0,
      chunkSize,
    }

    const { tasks, fileCache, sessionTasks, currentSessionId } = get()
    const newTasks = new Map(tasks)
    newTasks.set(taskId, task)

    // 缓存 File 对象，供暂停恢复、重试时使用（浏览器 File 无法持久化）
    const newFileCache = new Map(fileCache)
    newFileCache.set(taskId, file)

    const targetSessionId = sessionId || currentSessionId
    const newSessionTasks = new Map(sessionTasks)
    if (targetSessionId) {
      const sessionTaskList = newSessionTasks.get(targetSessionId) || []
      sessionTaskList.push(taskId)
      newSessionTasks.set(targetSessionId, sessionTaskList)
    }

    set({
      tasks: newTasks,
      fileCache: newFileCache,
      sessionTasks: newSessionTasks,
    })

    get().transitionTo(taskId, 'initialized')

    // 异步启动分片上传，不阻塞 createTask 返回
    uploadExecutor.start(taskId, file, concurrency, chunkSize).catch(() => {
      // Silent
    })

    return taskId
  },

  /**
   * @see TransferStore.createTasksWithDirectory
   *
   * 流程：校验上传限制 → 解析 webkitRelativePath 目录树 → 按层级 createFolder
   * → 限流并发 createTask
   */
  createTasksWithDirectory: async (files, parentId) => {
    interface FileWithPath {
      webkitRelativePath?: string
    }

    const filesWithPath = files as (File & FileWithPath)[]

    // ========== 限制检查 ==========

    const totalSize = filesWithPath.reduce((sum, file) => sum + file.size, 0)

    // 1. 文件数量（文件夹内文件个数上限）
    if (filesWithPath.length > UPLOAD_LIMITS.MAX_FILES) {
      toast.error(
        `单次最多上传 ${UPLOAD_LIMITS.MAX_FILES.toLocaleString()} 个文件，当前选择了 ${filesWithPath.length.toLocaleString()} 个`,
        {
          description: `单次总大小仍不能超过 ${formatFileSize(UPLOAD_LIMITS.MAX_TOTAL_SIZE)}，可适当分批`,
        },
      )
      throw new Error('文件数量超限')
    }

    // 2. 总大小
    if (totalSize > UPLOAD_LIMITS.MAX_TOTAL_SIZE) {
      const currentSize = formatFileSize(totalSize)
      const maxSize = formatFileSize(UPLOAD_LIMITS.MAX_TOTAL_SIZE)
      toast.error(`单次上传总大小不能超过 ${maxSize}，当前为 ${currentSize}`, {
        description: '建议分批上传或使用客户端',
      })
      throw new Error('总大小超限')
    }

    // 3. 目录深度检查
    let maxDepth = 0
    let deepestPath = ''
    filesWithPath.forEach((file) => {
      const path = file.webkitRelativePath || file.name
      const depth = path.split('/').length - 1
      if (depth > maxDepth) {
        maxDepth = depth
        deepestPath = path
      }
    })
    if (maxDepth > UPLOAD_LIMITS.MAX_DEPTH) {
      toast.error(`目录层级不能超过 ${UPLOAD_LIMITS.MAX_DEPTH} 层，当前为 ${maxDepth} 层`, {
        description: `最深路径: ${deepestPath}`
      })
      throw new Error('目录深度超限')
    }

    // 4. 文件名长度检查
    const invalidFiles = filesWithPath.filter((file) => {
      const path = file.webkitRelativePath || file.name
      return file.name.length > UPLOAD_LIMITS.MAX_FILENAME_LENGTH || 
             path.length > UPLOAD_LIMITS.MAX_PATH_LENGTH
    })
    if (invalidFiles.length > 0) {
      const example = invalidFiles[0].name
      toast.error('存在文件名或路径过长的文件', {
        description: `如: ${example.substring(0, 50)}...`
      })
      throw new Error('文件名或路径过长')
    }

    // 5. 自动过滤系统文件
    const filteredFiles = filesWithPath.filter((file) => {
      const path = file.webkitRelativePath || file.name
      return !shouldFilterFile(path)
    })

    if (filteredFiles.length < filesWithPath.length) {
      const filteredCount = filesWithPath.length - filteredFiles.length
      toast.info(`已自动过滤 ${filteredCount} 个系统文件`)
    }

    if (filteredFiles.length === 0) {
      toast.warning('没有可上传的文件')
      return
    }

    // ========== 解析目录结构 ==========
    
    const dirMap = new Map<string, string>() // path -> folderId
    const filesByDir = new Map<string, File[]>() // dirPath -> files

    // 收集所有目录路径
    const allDirs = new Set<string>()
    filteredFiles.forEach((file) => {
      const relativePath = file.webkitRelativePath || file.name
      const pathParts = relativePath.split('/')
      
      // 如果有多级目录
      if (pathParts.length > 1) {
        let currentPath = ''
        // 遍历除了文件名之外的所有部分
        for (let i = 0; i < pathParts.length - 1; i++) {
          currentPath += (i > 0 ? '/' : '') + pathParts[i]
          allDirs.add(currentPath)
        }
        
        // 记录文件所属目录
        const dirPath = pathParts.slice(0, -1).join('/')
        if (!filesByDir.has(dirPath)) {
          filesByDir.set(dirPath, [])
        }
        filesByDir.get(dirPath)!.push(file)
      } else {
        // 根目录文件
        if (!filesByDir.has('')) {
          filesByDir.set('', [])
        }
        filesByDir.get('')!.push(file)
      }
    })

    // 按层级排序目录（确保父目录先创建）
    const sortedDirs = Array.from(allDirs).sort((a, b) => {
      const aDepth = a.split('/').length
      const bDepth = b.split('/').length
      return aDepth - bDepth
    })

    // 显示上传信息
    toast.info(`准备上传 ${filteredFiles.length} 个文件，共 ${sortedDirs.length} 个文件夹`, {
      description: `总大小: ${formatFileSize(totalSize)}`
    })

    // ========== 递归创建目录 ==========
    
    try {
      for (const dirPath of sortedDirs) {
        const pathParts = dirPath.split('/')
        const folderName = pathParts[pathParts.length - 1]
        const parentPath = pathParts.slice(0, -1).join('/')
        
        // 获取父目录 ID
        const parentFolderId = parentPath ? dirMap.get(parentPath) : parentId

        try {
          // 调用创建文件夹 API
          const result = await createFolder({
            folderName,
            parentId: parentFolderId,
          })
          
          // 保存文件夹 ID
          if (result?.id) {
            dirMap.set(dirPath, result.id)
          } else {
            throw new Error('创建文件夹成功但未返回 ID')
          }
        } catch (error) {
          console.error(`创建文件夹失败: ${dirPath}`, error)
          toast.error(`创建文件夹失败: ${folderName}`)
          throw error
        }
      }

      // ========== 上传所有文件（限流创建任务，避免主线程与连接打满）==========

      type UploadEntry = { file: File; parentId?: string }
      const uploadEntries: UploadEntry[] = []

      filesByDir.forEach((dirFiles, dirPath) => {
        const targetParentId = dirPath ? dirMap.get(dirPath) : parentId
        dirFiles.forEach((file) => {
          uploadEntries.push({ file, parentId: targetParentId })
        })
      })

      await pool(
        BATCH_CREATE_TASK_CONCURRENCY,
        uploadEntries,
        ({ file, parentId: pid }) => get().createTask(file, pid),
      )
      
      toast.success(`已添加 ${filteredFiles.length} 个文件到上传队列`)
    } catch (error) {
      console.error('上传目录失败:', error)
      throw error
    }
  },

  /** @see TransferStore.pauseTask */
  pauseTask: async (taskId) => {
    const { tasks } = get()
    const task = tasks.get(taskId)
    if (!task) throw new Error(`Task not found: ${taskId}`)

    // 设置 isPaused 标志，worker 在下一循环退出
    uploadExecutor.pause(taskId)

    if (!get().transitionTo(taskId, 'paused')) {
      throw new Error(`Cannot pause task in status: ${task.status}`)
    }

    try {
      await pauseUpload(taskId)
    } catch (error) {
      // 后端暂停失败则回滚前端状态
      get().transitionTo(taskId, task.status)
      throw error
    }
  },

  /** @see TransferStore.resumeTask */
  resumeTask: async (taskId) => {
    const { tasks } = get()
    const task = tasks.get(taskId)
    if (!task) throw new Error(`Task not found: ${taskId}`)

    if (!get().transitionTo(taskId, 'uploading')) {
      throw new Error(`Cannot resume task in status: ${task.status}`)
    }

    try {
      await resumeUpload(taskId)
      uploadExecutor.resume(taskId).catch(() => {
        // Silent
      })
    } catch (error) {
      get().transitionTo(taskId, task.status)
      throw error
    }
  },

  /** @see TransferStore.cancelTask */
  cancelTask: async (taskId) => {
    const { tasks } = get()
    const task = tasks.get(taskId)
    if (!task) throw new Error(`Task not found: ${taskId}`)

    uploadExecutor.cancel(taskId)

    if (!get().transitionTo(taskId, 'cancelled')) {
      throw new Error(`Cannot cancel task in status: ${task.status}`)
    }

    try {
      await cancelUpload(taskId)
      progressCalculator.clear(taskId)
      const { fileCache } = get()
      const newFileCache = new Map(fileCache)
      newFileCache.delete(taskId)
      set({ fileCache: newFileCache })
    } catch (error) {
      get().transitionTo(taskId, task.status)
      throw error
    }
  },

  /** @see TransferStore.retryTask */
  retryTask: async (taskId) => {
    const {
      tasks,
      fileCache,
      completedActionsTriggered,
      errorNotificationTriggered,
    } = get()
    const task = tasks.get(taskId)
    if (!task) throw new Error(`Task not found: ${taskId}`)

    if (task.status !== 'failed') {
      throw new Error(`Cannot retry task in status: ${task.status}`)
    }

    const file = fileCache.get(taskId)
    if (!file) {
      throw new Error('File not found in cache, cannot retry')
    }

    progressCalculator.reset(taskId)
    completedActionsTriggered.delete(taskId)
    errorNotificationTriggered.delete(taskId)

    if (!get().transitionTo(taskId, 'initialized')) {
      throw new Error('Failed to transition task to initialized state')
    }

    const updatedTask = tasks.get(taskId)
    if (updatedTask) {
      const newTasks = new Map(tasks)
      newTasks.set(taskId, {
        ...updatedTask,
        progress: 0,
        uploadedBytes: 0,
        uploadedChunks: 0,
        speed: 0,
        remainingTime: 0,
        errorMessage: undefined,
      })
      set({ tasks: newTasks })
    }

    const userStore = useUserStore.getState()
    const currentConcurrency =
      userStore.transferSetting?.concurrentUploadQuantity || 3
    const currentChunkSize =
      userStore.transferSetting?.chunkSize || 5 * 1024 * 1024
    uploadExecutor
      .start(taskId, file, currentConcurrency, currentChunkSize)
      .catch(() => {
        // Silent
      })
  },

  /** @see TransferStore.clearCompletedTasks */
  clearCompletedTasks: async () => {
    try {
      await clearCompletedTasksApi()

      const { tasks } = get()
      const newTasks = new Map(tasks)

      // 删除所有已完成、失败和取消的任务
      Array.from(newTasks.values()).forEach((task) => {
        if (['completed', 'failed', 'cancelled'].includes(task.status)) {
          newTasks.delete(task.taskId)
          progressCalculator.clear(task.taskId)
        }
      })

      set({ tasks: newTasks })
    } catch (error) {
      console.error('清空已完成任务失败:', error)
      throw error
    }
  },

  /** @see TransferStore.initSSE */
  initSSE: async (userId: string) => {
    // 建立 SSE；失败时 checkAndStartPolling 可降级为轮询
    try {
      await get().fetchTasks()

      sseService.setReconnectSyncCallback(async () => {
        await get().syncTasks()
      })

      if (sseMessageUnsubscribe) {
        sseMessageUnsubscribe()
      }
      sseMessageUnsubscribe = sseService.onMessage(get().handleSSEMessage)

      if (sseConnectionUnsubscribe) {
        sseConnectionUnsubscribe()
      }
      sseConnectionUnsubscribe = sseService.onConnectionChange((connected) => {
        get().setSseConnected(connected)
      })

      sseService.connect(userId)

      get().checkAndStartPolling()
      get().setupBeforeUnloadWarning()
    } catch (error) {
      console.error('初始化 SSE 失败:', error)
    }
  },

  /** @see TransferStore.disconnectSSE */
  disconnectSSE: () => {
    if (sseMessageUnsubscribe) {
      sseMessageUnsubscribe()
      sseMessageUnsubscribe = null
    }

    if (sseConnectionUnsubscribe) {
      sseConnectionUnsubscribe()
      sseConnectionUnsubscribe = null
    }

    sseService.disconnect()
    get().setSseConnected(false)
    get().stopPolling()
  },

  /** @see TransferStore.checkAndStartPolling */
  checkAndStartPolling: () => {
    const { tasks } = get()
    const hasActiveTasks = Array.from(tasks.values()).some(
      (task) =>
        task.status === 'uploading' ||
        task.status === 'checking' ||
        task.status === 'merging'
    )

    if (hasActiveTasks && pollingTimerId === null) {
      get().startPolling()
    }
  },

  /** @see TransferStore.startPolling */
  startPolling: () => {
    if (pollingTimerId !== null) return

    pollingTimerId = window.setInterval(async () => {
      const { tasks } = get()
      const activeTasks = Array.from(tasks.values()).filter(
        (task) =>
          task.status === 'uploading' ||
          task.status === 'checking' ||
          task.status === 'merging'
      )

      if (activeTasks.length === 0) {
        get().stopPolling()
        return
      }

      try {
        await get().syncTasks()
      } catch {
        // Silent
      }
    }, POLLING_INTERVAL)
  },

  /** @see TransferStore.stopPolling */
  stopPolling: () => {
    if (pollingTimerId !== null) {
      window.clearInterval(pollingTimerId)
      pollingTimerId = null
    }
  },

  /** @see TransferStore.setupBeforeUnloadWarning */
  setupBeforeUnloadWarning: () => {
    if (beforeUnloadWarningSetup) return
    beforeUnloadWarningSetup = true

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      const { tasks } = get()
      const hasUploadingTasks = Array.from(tasks.values()).some(
        (task) =>
          task.status === 'idle' ||
          task.status === 'initialized' ||
          task.status === 'uploading' ||
          task.status === 'checking' ||
          task.status === 'merging' ||
          task.status === 'paused'
      )

      if (hasUploadingTasks) {
        event.preventDefault()
        event.returnValue = '有文件正在上传，离开页面将取消所有上传任务'
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
  },

  /** @see TransferStore.getDisplayData */
  getDisplayData: (taskId) => {
    return progressCalculator.getDisplayData(taskId)
  },
}))
