/**
 * 工作空间邀请 API 模块
 *
 * 封装邀请令牌验证与接受邀请接口（供受邀用户落地页使用）。
 */
import { InvitationDetail, AcceptInvitationResponse } from '@/types/invitation'
import { request } from './request'

/** 邀请相关 API 集合 */
export const invitationApi = {
  /**
   * 验证邀请令牌是否有效
   * @param token 邀请链接中的令牌
   * @returns 邀请详情（工作空间名、邀请人等）
   */
  verifyInvitation: (token: string) => {
    return request.get<InvitationDetail>(`/apis/invitation/verify/${token}`)
  },

  /**
   * 接受工作空间邀请
   * @param token 邀请令牌
   * @returns 接受结果（含跳转工作空间信息等）
   */
  acceptInvitation: (token: string) => {
    return request.post<AcceptInvitationResponse>(`/apis/invitation/accept/${token}`)
  },
}
