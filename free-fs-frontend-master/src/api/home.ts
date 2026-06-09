/**
 * 首页信息 API 模块
 *
 * 提供首页存储用量、趋势图表、最近文件等聚合数据接口及类型定义。
 */
import type { FileItem } from '@/types/file'
import { request } from './request'

/** 首页 getHomeInfo 定时刷新间隔（毫秒）；标签页失焦时 React Query 默认会暂停轮询 */
export const HOME_INFO_REFETCH_INTERVAL_MS = 60_000

/** 存储用量单位枚举，与后端 @Schema 一致：1 KB, 2 MB, 3 GB（无字节） */
export type HomeUsedBytesUnit = 1 | 2 | 3

/** 趋势时间范围：0 近三个月, 1 近 30 天, 2 近 7 天 */
export type HomeUsedBytesDateType = 0 | 1 | 2

/** 单日存储用量趋势数据点 */
export interface HomeUsedBytesPoint {
  date: string
  usedBytes: number
  uploadCount?: number
}

/** 首页聚合信息，对应后端 FileHomeVO */
export interface HomeInfo {
  /** 与 unit 配套，已为展示用数值，无需再按字节换算 */
  usedStorage: number
  /** 与 usedStorage、usedBytes 数值配套的单位文案，由服务端返回 */
  unit?: string
  /** 随 unit、dateType 查询条件变化的用量趋势序列 */
  usedBytes: HomeUsedBytesPoint[]
  /** 最近上传/访问的文件列表 */
  recentFiles: FileItem[]
}

/**
 * 获取首页聚合信息
 * @param params.unit 存储展示单位
 * @param params.dateType 趋势时间范围
 * @returns 首页用量、趋势与最近文件
 */
export function getHomeInfo(params?: {
  unit?: HomeUsedBytesUnit
  dateType?: HomeUsedBytesDateType
}) {
  return request.get<HomeInfo>('/apis/home/info', { params })
}
