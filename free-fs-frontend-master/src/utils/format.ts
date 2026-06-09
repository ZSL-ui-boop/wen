/**
 * 通用格式化工具
 *
 * 提供文件大小、日期时间、时长及首页存储容量等展示格式化，
 * 部分函数依赖 i18n 以支持多语言文案。
 */
import dayjs from 'dayjs'

import type { HomeUsedBytesUnit } from '@/api/home'
import i18n from '@/i18n'

/**
 * 将字节数格式化为人类可读的文件大小（B / KB / MB / GB / TB）
 *
 * @param bytes 字节数
 * @returns 带两位小数的 size 字符串，如「1.50 MB」
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

/** 中文紧凑数字格式（如 2.16万），用于首页存储图表 */
const compactZh = (value: number) =>
  new Intl.NumberFormat('zh-CN', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value)

/**
 * 首页存储图表纵轴 / Tooltip 专用数字格式
 *
 * 规则：
 * - 万级及以上：紧凑格式（如 2.16万）
 * - KB 单位：始终紧凑
 * - 较小数值：按量级保留 2～3 位小数
 * - 不做单位换算，仅格式化数字本身
 *
 * @param value 原始数值
 * @param unit 服务端存储单位枚举（1=KB 等）
 */
export function formatHomeStorageNumber(
  value: number,
  unit: HomeUsedBytesUnit
): string {
  if (!Number.isFinite(value)) return ''
  if (value === 0) return '0'
  const abs = Math.abs(value)

  // ≥10000 统一走紧凑格式
  if (abs >= 10000) {
    return compactZh(value)
  }
  // KB 未过万也保持紧凑
  if (unit === 1) {
    return compactZh(value)
  }
  if (abs >= 100) {
    return value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
  }
  if (abs >= 1) {
    return value.toLocaleString('zh-CN', { maximumFractionDigits: 3 })
  }
  // 极小值保留更多小数位
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 8,
    minimumFractionDigits: 0,
  }).format(value)
}

/**
 * 首页存储概览展示：数字格式与图表一致，再拼接服务端单位文案
 *
 * @param value 存储用量数值
 * @param unitLabel 单位文案（如「GB」）
 * @param storageUnit 存储单位枚举，用于选择数字格式策略
 */
export function formatHomeStorageDisplay(
  value: number,
  unitLabel: string,
  storageUnit: HomeUsedBytesUnit
): string {
  if (!Number.isFinite(value)) return '—'
  const num = formatHomeStorageNumber(value, storageUnit)
  const u = unitLabel.trim()
  return u ? `${num} ${u}` : num
}

/**
 * 通用日期格式化（基于 dayjs）
 *
 * @param date 日期字符串、时间戳或 Date 对象
 * @param format 输出格式，默认「YYYY/MM/DD HH:mm:ss」
 */
export const formatDate = (
  date: string | number | Date,
  format = 'YYYY/MM/DD HH:mm:ss'
): string => {
  return dayjs(date).format(format)
}

/**
 * 文件时间戳格式化（固定格式）
 *
 * @param date 日期字符串、时间戳或 Date 对象
 * @returns 「YYYY/MM/DD HH:mm:ss」格式字符串
 */
export const formatFileTime = (date: string | number | Date): string => {
  return dayjs(date).format('YYYY/MM/DD HH:mm:ss')
}

/**
 * 相对友好的时间展示
 *
 * 规则：
 * - 今天：显示「今天 HH:mm」（i18n）
 * - 非今天：显示「YYYY/MM/DD HH:mm」
 *
 * @param dateStr 日期字符串或时间戳
 * @returns 格式化后的时间字符串
 */
export function formatTime(dateStr: string | number | Date): string {
  const date = new Date(dateStr)
  const now = new Date()

  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const timeStr = `${hours}:${minutes}`

  // 判断是否与当前日期为同一天
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  if (isToday) {
    return i18n.t('common:format.todayTime', { time: timeStr })
  }

  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')

  return `${year}/${month}/${day} ${timeStr}`
}

/**
 * 文件列表行时间展示：日期与时间用「 | 」分隔
 *
 * 风格接近常见网盘列表，今天同样走 i18n 文案。
 *
 * @param dateStr 日期字符串或时间戳
 */
export function formatFileListDisplayTime(
  dateStr: string | number | Date
): string {
  const date = new Date(dateStr)
  const now = new Date()
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const timeStr = `${hours}:${minutes}`

  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  if (isToday) {
    return i18n.t('common:format.todayListRow', { time: timeStr })
  }

  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')

  return `${year}/${month}/${day} | ${timeStr}`
}

/**
 * 将秒数格式化为时长字符串
 *
 * @param seconds 总秒数
 * @returns 有小时时为「H:MM:SS」，否则为「M:SS」
 */
export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}
