/**
 * 系统管理 API 模块
 *
 * 系统级管理操作（跨工作空间的全局操作）。
 * 工作空间级的成员管理和邀请已迁移到 workspaceApi。
 */
import { request } from './request'

/** 系统管理 API 集合 */
export const adminApi = {
  /**
   * 禁用或启用用户（全局管理员操作）
   * @param userId 目标用户 ID
   * @param status 用户状态码
   */
  updateUserStatus: (userId: string, status: number) => {
    return request.put(`/apis/admin/users/${userId}/status`, { status })
  },
}
