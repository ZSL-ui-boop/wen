/**
 * 工作空间 API 模块
 *
 * 封装工作空间 CRUD、成员管理、邀请管理等接口。
 * 除 list/checkSlug 外，多数接口需请求头 X-Workspace-Id。
 */
import type {
  Workspace,
  WorkspaceDetail,
  WorkspaceMember,
  WorkspaceInvitation,
  CreateWorkspaceParams,
  UpdateWorkspaceParams,
  CreateWorkspaceInvitationParams,
  WorkspaceMemberQueryParams,
} from '@/types/workspace'
import type { PageResult } from '@/types/permission'
import { request } from './request'

/** 工作空间相关 API 集合 */
export const workspaceApi = {
  /**
   * 获取当前用户的工作空间列表
   * 不需要 X-Workspace-Id 请求头
   * @returns 工作空间列表
   */
  list: () => request.get<Workspace[]>('/apis/workspace/list'),

  /**
   * 创建工作空间
   * @param data 名称、slug 等创建参数
   * @returns 新建工作空间
   */
  create: (data: CreateWorkspaceParams) =>
    request.post<Workspace>('/apis/workspace', data),

  /**
   * 获取当前工作空间详情及用户在其中的角色权限
   * 需要 X-Workspace-Id 请求头
   * @returns 工作空间详情
   */
  getCurrent: () =>
    request.get<WorkspaceDetail>('/apis/workspace/current'),

  /**
   * 更新工作空间信息
   * @param data 可更新的工作空间字段
   * @returns 更新后的工作空间
   */
  update: (data: UpdateWorkspaceParams) =>
    request.put<Workspace>('/apis/workspace', data),

  /**
   * 删除工作空间（仅 owner 可操作）
   */
  delete: () => request.delete('/apis/workspace'),

  /**
   * 检查 slug 是否可用（创建/重命名时校验）
   * @param slug 待检查的 slug
   * @returns true 表示可用
   */
  checkSlug: (slug: string) =>
    request.get<boolean>('/apis/workspace/check-slug', { params: { slug } }),

  // ---- 成员管理 ----

  /**
   * 分页获取工作空间成员列表
   * @param params 分页与筛选条件
   * @returns 成员分页数据
   */
  getMembers: (params: WorkspaceMemberQueryParams) =>
    request.get<PageResult<WorkspaceMember>>('/apis/workspace/members', {
      params,
    }),

  /**
   * 更新成员角色
   * @param userId 成员用户 ID
   * @param roleId 新角色 ID
   */
  updateMemberRole: (userId: string, roleId: number) =>
    request.put(`/apis/workspace/members/${userId}/role`, { roleId }),

  /**
   * 从工作空间移除成员
   * @param userId 成员用户 ID
   */
  removeMember: (userId: string) =>
    request.delete(`/apis/workspace/members/${userId}`),

  // ---- 邀请管理 ----

  /**
   * 获取工作空间待处理邀请列表
   * @returns 邀请记录列表
   */
  getInvitations: () =>
    request.get<WorkspaceInvitation[]>('/apis/workspace/invitations'),

  /**
   * 创建成员邀请
   * @param data 邀请邮箱、角色等参数
   * @returns 邀请记录
   */
  createInvitation: (data: CreateWorkspaceInvitationParams) =>
    request.post<WorkspaceInvitation>('/apis/workspace/invitations', data),

  /**
   * 取消待处理的邀请
   * @param id 邀请记录 ID
   */
  deleteInvitation: (id: string) =>
    request.delete(`/apis/workspace/invitations/${id}`),
}
