import type { HomeUsedBytesPoint, HomeUsedBytesUnit } from '@/api/home'
import { getHomeInfo } from '@/api/home'
import { request } from './request'

export interface FileDashboard {
  usedStorage: number
  unit?: string
  fileCount: number
  folderCount: number
  shareCount: number
  recycleCount: number
  uploadTodayCount: number
  trend7d: HomeUsedBytesPoint[]
  updatedAt: string
}

export function getDashboard(params?: { unit?: HomeUsedBytesUnit }) {
  return request
    .get<FileDashboard>('/apis/home/dashboard', {
      params,
      showErrorMessage: false,
    } as Parameters<typeof request.get>[1])
    .catch(async (err: { response?: { status?: number }; code?: number }) => {
      const is404 = err?.response?.status === 404 || err?.code === 404
      if (!is404) throw err
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
