/**
 * 工作空间模块类型定义
 * 多租户协作：工作空间、成员、邀请等
 */
import type { PermissionCodeType } from './permission'

/** 工作空间基本信息 */
export interface Workspace {
  id: string
  /** 显示名称 */
  name: string
  /** URL 友好标识（slug） */
  slug: string
  description?: string
  /** 所有者用户 ID */
  ownerId: string
  /** 成员数量 */
  memberCount: number
  createdAt: string
  updatedAt: string
}

/** GET `/apis/workspace/current` 返回，附带当前用户在该空间内的角色与权限 */
export interface WorkspaceDetail extends Workspace {
  roleCode: string
  roleName: string
  permissions: PermissionCodeType[]
}

/** 工作空间成员信息 */
export interface WorkspaceMember {
  id: string
  userId: string
  workspaceId: string
  username: string
  nickname: string
  email: string
  avatar: string
  roleId: number
  roleCode: string
  roleName: string
  /** 成员状态（启用/禁用等） */
  status: number
  joinedAt: string
  lastLoginAt?: string
}

/** 创建工作空间请求参数 */
export interface CreateWorkspaceParams {
  name: string
  slug: string
  description?: string
}

/** 更新工作空间请求参数 */
export interface UpdateWorkspaceParams {
  name?: string
  slug?: string
  description?: string
}

/** 工作空间邀请记录 */
export interface WorkspaceInvitation {
  id: string
  workspaceId: string
  email: string
  roleId: number
  roleName?: string
  invitedBy: string
  invitedByName?: string
  /** 邀请状态 */
  status: number
  expiresAt: string
  createdAt: string
}

/** 发送工作空间邀请请求参数 */
export interface CreateWorkspaceInvitationParams {
  email: string
  roleId: number
}

/** 成员列表分页查询参数 */
export interface WorkspaceMemberQueryParams {
  page: number
  size: number
  keyword?: string
}
