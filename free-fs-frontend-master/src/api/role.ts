/**
 * 角色管理 API 模块
 *
 * 封装系统角色的增删改查接口，用于权限配置。
 */
import type {
  Role,
  RoleListItem,
  CreateRoleParams,
  UpdateRoleParams,
} from '@/types/role'
import { request } from './request'

/** 角色管理 API 集合 */
export const roleApi = {
  /**
   * 获取角色列表（精简字段，用于列表展示）
   * @returns 角色列表项数组
   */
  list: () => {
    return request.get<RoleListItem[]>('/apis/role/list')
  },

  /**
   * 获取角色详情（含权限配置）
   * @param roleId 角色 ID
   * @returns 完整角色信息
   */
  get: (roleId: number) => {
    return request.get<Role>(`/apis/role/${roleId}`)
  },

  /**
   * 创建新角色
   * @param data 角色名称、权限 ID 列表等
   * @returns 新建角色
   */
  create: (data: CreateRoleParams) => {
    return request.post<Role>('/apis/role', data)
  },

  /**
   * 更新角色信息
   * @param roleId 角色 ID
   * @param data 可更新字段
   * @returns 更新后的角色
   */
  update: (roleId: number, data: UpdateRoleParams) => {
    return request.put<Role>(`/apis/role/${roleId}`, data)
  },

  /**
   * 删除角色
   * @param roleId 角色 ID
   */
  delete: (roleId: number) => {
    return request.delete(`/apis/role/${roleId}`)
  },
}
