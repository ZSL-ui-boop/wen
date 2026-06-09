/**
 * 存储平台配置 API 模块
 *
 * 封装存储平台列表、用户配置 CRUD、启用/禁用及当前激活平台查询。
 */
import type {
  StoragePlatform,
  StorageSetting,
  ActiveStoragePlatform,
  AddStorageSettingParams,
  UpdateStorageSettingParams,
} from '@/types/storage'
import { request } from './request'

/**
 * 获取系统支持的存储平台列表（用于下拉选择）
 * @returns 平台定义列表
 */
export function getStoragePlatforms() {
  return request.get<StoragePlatform[]>('/apis/storage/platforms')
}

/**
 * 获取当前用户已配置的存储平台列表
 * @returns 用户存储配置列表
 */
export function getUserStorageSettings() {
  return request.get<StorageSetting[]>('/apis/storage/platform/settings')
}

/**
 * 添加新的存储平台配置
 * @param data 平台类型、密钥、桶名等配置参数
 */
export function addStorageSetting(data: AddStorageSettingParams) {
  return request.post('/apis/storage/settings', data)
}

/**
 * 更新已有存储平台配置
 * @param data 含 ID 的更新参数
 */
export function updateStorageSetting(data: UpdateStorageSettingParams) {
  return request.put('/apis/storage/settings', data)
}

/**
 * 删除存储平台配置
 * @param id 配置记录 ID
 */
export function deleteStorageSetting(id: number) {
  return request.delete(`/apis/storage/settings/${id}`)
}

/**
 * 启用或禁用存储平台配置
 * @param id 配置 ID
 * @param action 操作码（启用/禁用）
 */
export function toggleStorageSetting(id: string, action: number) {
  return request.post(`/apis/storage/settings/${id}/${action}`)
}

/**
 * 按标识符获取单个存储平台配置详情
 * @param identifier 平台配置标识符
 * @returns 存储配置详情
 */
export function getStoragePlatformsSettings(identifier: string) {
  return request.get<StorageSetting>(`/apis/storage/settings/${identifier}`)
}

/**
 * 获取当前用户已开通且已配置的存储平台列表
 * @returns 可用激活平台列表
 */
export function getActiveStoragePlatforms() {
  return request.get<ActiveStoragePlatform[]>('/apis/storage/active-platforms')
}
