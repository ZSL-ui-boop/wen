/**
 * 上传进度计算器
 *
 * 负责平滑计算并展示上传进度、瞬时速度与剩余时间。
 * 采用滑动窗口测速 + 节流更新，避免 UI 抖动与频繁重渲染。
 */

/** 滑动窗口内的一次速度采样点 */
interface SpeedSample {
  timestamp: number
  bytes: number
}

/** 单个上传任务在计算器内的内部状态 */
interface TaskProgressData {
  uploadedBytes: number
  totalBytes: number
  lastProgress: number
  lastUpdateTime: number
  speedCalculator: SlidingWindowSpeed
}

/** 供 UI 展示的进度、速度与剩余时间 */
export interface DisplayData {
  progress: number
  speed: number
  remainingTime: number
}

/**
 * 滑动窗口速度计算器
 *
 * 在固定时间窗口内根据首尾采样点的字节差计算平均上传速度。
 */
export class SlidingWindowSpeed {
  private samples: SpeedSample[] = []
  private readonly windowSize: number

  /**
   * @param windowSize 采样窗口时长（毫秒），默认 5000ms
   */
  constructor(windowSize = 5000) {
    this.windowSize = windowSize
  }

  /**
   * 追加一次已上传字节数采样，并剔除窗口外的旧采样
   *
   * @param bytes 当前累计已上传字节数
   */
  addSample(bytes: number): void {
    const now = Date.now()
    this.samples.push({ timestamp: now, bytes })
    // 只保留窗口内的采样，用于计算近期平均速度
    this.samples = this.samples.filter(
      (s) => now - s.timestamp < this.windowSize
    )
  }

  /**
   * 根据窗口内首尾采样计算平均速度（字节/秒）
   *
   * @returns 速度值；采样不足 2 个时返回 0
   */
  getSpeed(): number {
    if (this.samples.length < 2) return 0

    const first = this.samples[0]
    const last = this.samples[this.samples.length - 1]
    const timeDiff = (last.timestamp - first.timestamp) / 1000
    const bytesDiff = last.bytes - first.bytes

    return timeDiff > 0 ? bytesDiff / timeDiff : 0
  }

  /** 清空所有采样，用于任务结束或重置 */
  clear(): void {
    this.samples = []
  }
}

/**
 * 多任务进度管理器
 *
 * 按 taskId 维护进度状态，update 节流后 getDisplayData 供 UI 读取。
 */
export class ProgressCalculator {
  private tasks: Map<string, TaskProgressData> = new Map()
  private readonly throttleInterval: number
  private readonly windowSize: number

  /**
   * @param throttleInterval UI 更新最小间隔（毫秒），默认 100ms
   * @param windowSize 速度计算滑动窗口（毫秒），默认 5000ms
   */
  constructor(throttleInterval = 100, windowSize = 5000) {
    this.throttleInterval = throttleInterval
    this.windowSize = windowSize
  }

  /**
   * 更新指定任务的上传进度
   *
   * @param taskId 任务唯一标识
   * @param uploadedBytes 已上传字节数
   * @param totalBytes 文件总字节数
   * @returns 是否应触发 UI 刷新（节流通过时为 true）
   */
  update(taskId: string, uploadedBytes: number, totalBytes: number): boolean {
    const now = Date.now()
    let taskData = this.tasks.get(taskId)

    if (!taskData) {
      taskData = {
        uploadedBytes: 0,
        totalBytes,
        lastProgress: 0,
        lastUpdateTime: 0,
        speedCalculator: new SlidingWindowSpeed(this.windowSize),
      }
      this.tasks.set(taskId, taskData)
    }

    taskData.uploadedBytes = uploadedBytes
    taskData.totalBytes = totalBytes
    taskData.speedCalculator.addSample(uploadedBytes)

    // 节流：间隔内多次 update 不触发 UI 刷新
    if (now - taskData.lastUpdateTime < this.throttleInterval) {
      return false
    }

    taskData.lastUpdateTime = now
    return true
  }

  /**
   * 获取任务的展示数据（进度百分比、速度、剩余秒数）
   *
   * 进度只增不减，避免网络波动导致进度条回退。
   *
   * @param taskId 任务唯一标识
   */
  getDisplayData(taskId: string): DisplayData {
    const taskData = this.tasks.get(taskId)

    if (!taskData) {
      return { progress: 0, speed: 0, remainingTime: 0 }
    }

    let progress = 0
    if (taskData.totalBytes > 0) {
      progress = (taskData.uploadedBytes / taskData.totalBytes) * 100
    }

    // 进度单调递增：新值低于历史最大值时沿用旧值
    if (progress < taskData.lastProgress) {
      progress = taskData.lastProgress
    } else {
      taskData.lastProgress = progress
    }

    progress = Math.min(100, Math.max(0, Math.round(progress)))

    const speed = taskData.speedCalculator.getSpeed()

    let remainingTime = 0
    if (speed > 0) {
      const remainingBytes = taskData.totalBytes - taskData.uploadedBytes
      remainingTime = remainingBytes / speed
    }

    return {
      progress,
      speed: Math.max(0, speed),
      remainingTime: Math.max(0, remainingTime),
    }
  }

  /**
   * 清除单个任务的状态与速度采样
   *
   * @param taskId 任务唯一标识
   */
  clear(taskId: string): void {
    const taskData = this.tasks.get(taskId)
    if (taskData) {
      taskData.speedCalculator.clear()
      this.tasks.delete(taskId)
    }
  }

  /** 清除所有任务状态 */
  clearAll(): void {
    this.tasks.forEach((taskData) => {
      taskData.speedCalculator.clear()
    })
    this.tasks.clear()
  }

  /**
   * 重置任务进度与速度采样，保留任务条目
   *
   * @param taskId 任务唯一标识
   */
  reset(taskId: string): void {
    const taskData = this.tasks.get(taskId)
    if (taskData) {
      taskData.uploadedBytes = 0
      taskData.lastProgress = 0
      taskData.lastUpdateTime = 0
      taskData.speedCalculator.clear()
    }
  }
}

/** 全局单例，供上传模块共享进度计算状态 */
export const progressCalculator = new ProgressCalculator()
