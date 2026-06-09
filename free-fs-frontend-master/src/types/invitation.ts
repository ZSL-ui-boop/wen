/**
 * 工作空间邀请类型定义
 * 用于邀请链接验证、接受邀请等流程
 */

/** 邀请详情（验证接口 GET 返回） */
export interface InvitationDetail {
  id: string
  workspaceId: string
  workspaceName: string
  email: string
  roleName: string
  inviterName: string
  /** 邀请状态 */
  status: number
  expiresAt: string
  /** 是否已过期 */
  expired: boolean
  createdAt: string
  /** 被邀请邮箱是否已注册账号（决定跳转登录还是注册） */
  userExists: boolean
}

/** 接受邀请接口响应 */
export interface AcceptInvitationResponse {
  message?: string
}
