/**
 * 传输任务状态机
 *
 * 定义上传/传输任务各状态之间的合法转换规则，
 * 并提供 canTransition / transition 供 store 与 executor 校验状态变更。
 */
import type { TaskStatus, TransferTask } from '@/types/transfer'

/**
 * 状态转换规则映射表
 * key 为当前状态，value 为允许进入的下一状态列表
 */
export const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  idle: ['initialized'],
  initialized: ['checking', 'failed', 'cancelled'],
  checking: ['uploading', 'completed', 'failed', 'cancelled'],
  uploading: ['paused', 'merging', 'failed', 'cancelled'],
  paused: ['uploading', 'cancelled'],
  merging: ['completed', 'failed'],
  completed: [],
  failed: ['initialized'],
  cancelled: [],
}

/**
 * 判断从 from 状态能否转换到 to 状态
 *
 * @param from 当前状态
 * @param to 目标状态
 * @returns 相同状态或目标在合法列表中时为 true
 */
export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  if (from === to) return true
  const validTargets = VALID_TRANSITIONS[from]
  return validTargets.includes(to)
}

/**
 * 尝试将任务转换到目标状态
 *
 * @param task 当前传输任务
 * @param to 目标状态
 * @returns 转换成功时返回新任务对象（含 updatedAt）；非法转换返回 null
 */
export function transition(
  task: TransferTask,
  to: TaskStatus
): TransferTask | null {
  if (!canTransition(task.status, to)) {
    return null
  }

  // 状态未变时直接返回原对象，避免无意义的新引用
  if (task.status === to) {
    return task
  }

  return {
    ...task,
    status: to,
    updatedAt: Date.now(),
  }
}

/** 状态机门面，便于统一引用 */
export const stateMachine = {
  canTransition,
  transition,
}
