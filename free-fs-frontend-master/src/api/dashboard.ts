/**
 * 仪表盘 API 模块
 *
 * 提供文件统计仪表盘数据；若后端未部署 dashboard 接口则降级使用 home 接口数据。
 */
import type { HomeUsedBytesPoint, HomeUsedBytesUnit } from '@/api/home'
import { getHomeInfo } from '@/api/home'
import { request } from './request'

/** 文件仪表盘统计数据结构 */
export interface FileDashboard {
  /** 已用存储量（与 unit 配套） */
  usedStorage: number
  /** 存储单位文案 */
  unit?: string
  /** 文件总数 */
  fileCount: number
  /** 文件夹总数 */
  folderCount: number
  /** 分享总数 */
  shareCount: number
  /** 回收站文件数 */
  recycleCount: number
  /** 今日上传数 */
  uploadTodayCount: number
  /** 近 7 天用量趋势 */
  trend7d: HomeUsedBytesPoint[]
  /** 数据更新时间 */
  updatedAt: string
}

/**
 * 获取文件仪表盘数据
 * dashboard 接口 404 时自动降级：用 getHomeInfo 填充基础用量与趋势，其余计数置 0
 * @param params.unit 存储展示单位，默认 GB
 * @returns 仪表盘统计数据
 */
export function getDashboard(params?: { unit?: HomeUsedBytesUnit }) {
  return request
    .get<FileDashboard>('/apis/home/dashboard', {
      params,
      showErrorMessage: false,
    } as Parameters<typeof request.get>[1])
    .catch(async (err: { response?: { status?: number }; code?: number }) => {
      const is404 = err?.response?.status === 404 || err?.code === 404
      if (!is404) throw err
      // 降级：复用首页接口，保证旧版后端仍可展示基础数据
      const home = await getHomeInfo({ unit: params?.unit ?? 3, dateType: 2 })
      return {
        usedStorage: home.usedStorage,
        unit: home.unit,
        fileCount: 0,
        folderCount: 0,
        shareCount: 0,
        recycleCount: 0,
        uploadTodayCount: 0,
        trend7d: home.usedBytes ?? [],
        updatedAt: new Date().toLocaleString(),
      } satisfies FileDashboard
    })
}
