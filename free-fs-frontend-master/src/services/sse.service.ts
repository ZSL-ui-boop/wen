/**
 * 服务端推送（SSE）服务
 *
 * 职责：通过 EventSource 连接后端 GET /apis/transfer/sse，
 * 接收上传任务的 progress / status / complete / error 事件，
 * 解析后分发给 transfer store。支持断线重连与重连后任务同步。
 */
import type {
  SSEMessage,
  SSEMessageType,
  SSEProgressData,
  SSEStatusData,
  SSECompleteData,
  SSEErrorData,
} from '@/types/transfer'

/** SSE 消息处理器：收到解析后的 SSEMessage 时调用 */
export type SSEMessageHandler = (message: SSEMessage) => void

/** 连接状态变更处理器：connected 为 true 表示已建立连接 */
export type SSEConnectionHandler = (connected: boolean) => void

/** SSE 服务可配置项 */
interface SSEServiceConfig {
  /** API 基础 URL（来自环境变量 VITE_API_BASE_URL） */
  baseUrl: string
  /** SSE 端点路径 */
  endpoint: string
  /** 重连成功后是否触发同步回调 */
  syncOnReconnect: boolean
}

/** 默认 SSE 连接配置 */
const DEFAULT_CONFIG: SSEServiceConfig = {
  baseUrl: import.meta.env.VITE_API_BASE_URL || '',
  endpoint: '/apis/transfer/sse',
  syncOnReconnect: true,
}

/**
 * 解析 progress 事件的 payload
 * @param data 原始 JSON 对象
 */
function parseProgressData(data: Record<string, unknown>): SSEProgressData {
  return {
    uploadedBytes: Number(data.uploadedBytes) || 0,
    totalBytes: Number(data.totalBytes) || 0,
    uploadedChunks: Number(data.uploadedChunks) || 0,
    totalChunks: Number(data.totalChunks) || 0,
  }
}

/**
 * 解析 status 事件的 payload
 * @param data 原始 JSON 对象
 */
function parseStatusData(data: Record<string, unknown>): SSEStatusData {
  return {
    status: (data.status as string) || 'idle',
    message: data.message as string | undefined,
  } as SSEStatusData
}

/**
 * 解析 complete 事件的 payload
 * @param data 原始 JSON 对象
 */
function parseCompleteData(data: Record<string, unknown>): SSECompleteData {
  return {
    fileId: (data.fileId as string) || '',
    fileName: (data.fileName as string) || '',
    fileSize: Number(data.fileSize) || 0,
  }
}

/**
 * 解析 error 事件的 payload
 * @param data 原始 JSON 对象
 */
function parseErrorData(data: Record<string, unknown>): SSEErrorData {
  return {
    code: (data.code as string) || 'UNKNOWN_ERROR',
    message: (data.message as string) || 'Unknown error occurred',
  }
}

/**
 * SSE 连接管理单例
 *
 * 使用 EventSource 订阅指定用户的传输事件流，
 * 支持多 handler 订阅、自动重连及重连后 sync 回调。
 */
class SSEService {
  private static instance: SSEService | null = null
  /** 当前 EventSource 实例 */
  private eventSource: EventSource | null = null
  /** 当前连接绑定的用户 ID */
  private currentUserId: string | null = null
  /** 已注册的消息处理器集合 */
  private messageHandlers: Set<SSEMessageHandler> = new Set()
  /** 已注册的连接状态处理器集合 */
  private connectionHandlers: Set<SSEConnectionHandler> = new Set()
  /** 运行时配置（合并 DEFAULT_CONFIG） */
  private config: SSEServiceConfig
  /** 当前是否处于已连接状态 */
  private connected = false
  /** 重连成功后执行的同步回调（由 transfer store 注入） */
  private onReconnectSync: (() => Promise<void>) | null = null
  /** 当前重连尝试次数 */
  private reconnectAttempts = 0
  /** 最大重连次数，超过后不再自动重连 */
  private readonly MAX_RECONNECT_ATTEMPTS = 5
  /** 重连基础延迟（毫秒），实际延迟 = 基础延迟 × 尝试次数 */
  private readonly RECONNECT_BASE_DELAY = 2000

  private constructor(config: Partial<SSEServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * 获取 SSEService 单例
   * @param config 首次创建时可传入部分配置覆盖默认值
   */
  public static getInstance(config?: Partial<SSEServiceConfig>): SSEService {
    if (!SSEService.instance) {
      SSEService.instance = new SSEService(config)
    }
    return SSEService.instance
  }

  /**
   * 建立 SSE 连接
   * 若已连接同一 userId 则跳过；切换用户时会先断开旧连接
   * @param userId 要订阅传输事件的用户 ID
   */
  public connect(userId: string): void {
    if (this.eventSource && this.currentUserId === userId) {
      return
    }

    if (this.eventSource) {
      this.disconnect()
    }

    this.currentUserId = userId

    const url = `${this.config.baseUrl}${this.config.endpoint}?userId=${encodeURIComponent(userId)}`

    try {
      this.eventSource = new EventSource(url)
      this.setupEventListeners()
    } catch (error) {
      console.error('SSE 连接失败:', error)
      this.setConnected(false)
    }
  }

  /** 关闭 SSE 连接并清理用户 ID */
  public disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
      this.currentUserId = null
      this.setConnected(false)
    }
  }

  /** 查询当前是否已连接 */
  public isConnected(): boolean {
    return this.connected
  }

  /**
   * 订阅 SSE 消息
   * @param handler 消息处理函数
   * @returns 取消订阅的函数
   */
  public onMessage(handler: SSEMessageHandler): () => void {
    this.messageHandlers.add(handler)
    return () => {
      this.messageHandlers.delete(handler)
    }
  }

  /**
   * 订阅连接状态变更
   * @param handler 连接状态处理函数
   * @returns 取消订阅的函数
   */
  public onConnectionChange(handler: SSEConnectionHandler): () => void {
    this.connectionHandlers.add(handler)
    return () => {
      this.connectionHandlers.delete(handler)
    }
  }

  /**
   * 设置重连成功后的同步回调
   * 通常由 transfer store 注入 syncTasks，以补齐断线期间的状态
   */
  public setReconnectSyncCallback(callback: () => Promise<void>): void {
    this.onReconnectSync = callback
  }

  /**
   * 更新连接状态并通知所有 connectionHandlers
   * 从断开到连接时会触发重连同步（若已配置 syncOnReconnect）
   */
  private setConnected(connected: boolean): void {
    const wasConnected = this.connected
    this.connected = connected

    this.connectionHandlers.forEach((handler) => {
      try {
        handler(connected)
      } catch {
        // Silent
      }
    })

    if (!wasConnected && connected && this.config.syncOnReconnect) {
      this.triggerReconnectSync()
    }
  }

  /** 执行重连同步回调，失败时静默忽略 */
  private async triggerReconnectSync(): Promise<void> {
    if (this.onReconnectSync) {
      try {
        await this.onReconnectSync()
      } catch {
        // Silent
      }
    }
  }

  /** 为 EventSource 绑定 open / error / 命名事件 / 通用 message 监听 */
  private setupEventListeners(): void {
    if (!this.eventSource) return

    this.eventSource.onopen = () => {
      this.reconnectAttempts = 0
      this.setConnected(true)
    }

    this.eventSource.onerror = (error) => {
      console.error('SSE 连接错误:', error)

      // 连接已关闭时尝试指数退避重连
      if (this.eventSource?.readyState === EventSource.CLOSED) {
        this.setConnected(false)

        if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
          this.reconnectAttempts += 1
          const delay = this.RECONNECT_BASE_DELAY * this.reconnectAttempts

          setTimeout(() => {
            if (this.currentUserId) {
              this.connect(this.currentUserId)
            }
          }, delay)
        }
      }
    }

    this.eventSource.addEventListener('progress', (event) => {
      this.handleEvent('progress', event)
    })

    this.eventSource.addEventListener('status', (event) => {
      this.handleEvent('status', event)
    })

    this.eventSource.addEventListener('complete', (event) => {
      this.handleEvent('complete', event)
    })

    // 服务端自定义 error 事件（MessageEvent），与 onerror 连接错误不同
    this.eventSource.addEventListener('error', (event) => {
      if (event instanceof MessageEvent) {
        this.handleEvent('error', event)
      }
    })

    // 兜底：处理未命名或通用格式的 message 事件
    this.eventSource.onmessage = (event) => {
      this.handleGenericMessage(event)
    }
  }

  /**
   * 处理命名 SSE 事件（progress / status / complete / error）
   * @param type 事件类型
   * @param event 浏览器 Event 对象
   */
  private handleEvent(type: SSEMessageType, event: Event): void {
    if (!(event instanceof MessageEvent)) return

    try {
      const rawData = JSON.parse(event.data)
      const message = this.parseMessage(type, rawData)

      if (message) {
        this.dispatchMessage(message)
      }
    } catch {
      // Silent
    }
  }

  /**
   * 处理通用 onmessage 事件
   * 期望 payload 含 type 与 taskId 字段
   */
  private handleGenericMessage(event: MessageEvent): void {
    try {
      const rawData = JSON.parse(event.data)

      if (rawData.type && rawData.taskId) {
        const message = this.parseMessage(rawData.type, rawData)
        if (message) {
          this.dispatchMessage(message)
        }
      }
    } catch {
      // Silent
    }
  }

  /**
   * 将原始 JSON 解析为统一的 SSEMessage 结构
   * @param type 消息类型
   * @param rawData 原始 JSON 对象
   * @returns 解析成功返回 SSEMessage，缺少 taskId 时返回 null
   */
  private parseMessage(
    type: SSEMessageType,
    rawData: Record<string, unknown>
  ): SSEMessage | null {
    const taskId = rawData.taskId as string
    if (!taskId) return null

    // data 可能在嵌套字段中，也可能与顶层字段合并
    const data = (rawData.data as Record<string, unknown>) || rawData

    switch (type) {
      case 'progress':
        return { type: 'progress', taskId, data: parseProgressData(data) }
      case 'status':
        return { type: 'status', taskId, data: parseStatusData(data) }
      case 'complete':
        return { type: 'complete', taskId, data: parseCompleteData(data) }
      case 'error':
        return { type: 'error', taskId, data: parseErrorData(data) }
      default:
        return null
    }
  }

  /** 向所有已注册的 messageHandlers 广播消息 */
  private dispatchMessage(message: SSEMessage): void {
    this.messageHandlers.forEach((handler) => {
      try {
        handler(message)
      } catch {
        // Silent
      }
    })
  }
}

/** SSE 服务默认单例，供 transfer store 使用 */
export const sseService = SSEService.getInstance()

/** 导出 SSEService 类，便于测试或自定义配置 */
export { SSEService }
