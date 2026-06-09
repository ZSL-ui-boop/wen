/**
 * 角色模块类型定义
 * 工作空间内自定义角色与权限绑定
 */
import type { PermissionCodeType } from './permission'

/** 角色类型：0 系统预设，1 用户自定义 */
export type RoleType = 0 | 1

/** GET `/apis/role/list` 列表项（不含 permissions 详情） */
export interface RoleListItem {
  id: number
  roleCode: string
  roleName: string
  /** 角色描述 */
  description?: string | null
  roleType?: RoleType
  createdAt?: string
  updatedAt?: string
}

/** 创建/更新角色等返回的完整角色（含权限列表） */
export interface Role extends RoleListItem {
  permissions: PermissionCodeType[]
  /** 绑定该角色的用户数量 */
  userCount?: number
}

/** 创建角色请求参数 */
export interface CreateRoleParams {
  roleCode: string
  roleName: string
  description?: string
  permissions: PermissionCodeType[]
}

/** 更新角色请求参数（roleCode 不可改） */
export interface UpdateRoleParams {
  roleName: string
  description?: string
  permissions: PermissionCodeType[]
}
