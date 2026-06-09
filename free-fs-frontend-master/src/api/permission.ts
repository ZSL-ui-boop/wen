/**
 * 权限定义 API 模块
 *
 * 提供系统权限点列表查询，供角色配置时使用。
 */
import type { PermissionDef } from '@/types/permission'
import { request } from './request'

/** 权限定义 API 集合 */
export const permissionApi = {
  /**
   * 获取系统全部权限定义列表
   * @returns 权限点定义数组
   */
  list: () => {
    return request.get<PermissionDef[]>('/apis/permission/list')
  },
}
