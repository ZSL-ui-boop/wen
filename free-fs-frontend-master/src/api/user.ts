/**
 * 用户与认证 API 模块
 *
 * 封装登录/注册、用户信息、密码、头像、传输设置等接口。
 * 登录支持账号密码与邮箱验证码两种方式。
 */
import {
  TransferSetting,
  UpdateTransferSettingCmd,
} from '@/types/transfer-setting'
import {
  LoginParams,
  LoginRes,
  UserInfo,
  UserRegisterParams,
  ChangePasswordParams,
  SetPasswordParams,
  ForgotPasswordParams,
  UpdateUserInfoParams,
} from '@/types/user'
import { request } from './request'

/** 用户与认证相关 API 集合 */
export const userApi = {
  /**
   * 用户登录（账号密码或验证码）
   * @param data 登录参数（账号、密码/验证码等）
   * @returns 登录响应（含 token）
   */
  login: (data: LoginParams) => {
    return request.post<LoginRes>('/apis/auth/login', data)
  },

  /**
   * 登录-发送邮箱验证码
   * @param account 用户账号（对应邮箱）
   */
  sendLoginEmailCode: (account: string) => {
    return request.post<unknown>('/apis/auth/login/email-code', null, {
      params: { account },
    })
  },

  /**
   * 用户注册
   * @param data 注册参数
   * @returns 注册成功后的用户信息
   */
  register: (data: UserRegisterParams) => {
    return request.post<UserInfo>('/apis/user/register', data)
  },

  /**
   * 获取当前登录用户信息
   * @returns 用户详情
   */
  getUserInfo: () => {
    return request.get<UserInfo>('/apis/user/info')
  },

  /**
   * 更新用户信息
   * 请求体仅传可改字段；成功后需再调 getUserInfo，因接口可能不返回 data
   * @param data 可更新的用户字段
   */
  updateUserInfo: async (data: UpdateUserInfoParams): Promise<void> => {
    await request.put<unknown>('/apis/user/info', data)
  },

  /**
   * 发送修改邮箱验证码
   * @param mail 新邮箱地址
   */
  sendUpdateEmailCode: (mail: string) => {
    return request.post<unknown>(`/apis/user/update-mail/code/${mail}`)
  },

  /**
   * 修改绑定邮箱
   * @param mail 新邮箱
   * @param code 邮箱验证码
   */
  updateEmail: (mail: string, code: string) => {
    return request.put<unknown>(`/apis/user/update-mail/code/${mail}/${code}`, {
      email: mail,
      code: code,
    })
  },

  /**
   * 上传用户头像
   * multipart 字段名为 file；成功后请调用 getUserInfo 刷新头像 URL
   * @param file 头像图片文件
   */
  uploadAvatar: async (file: File): Promise<void> => {
    const formData = new FormData()
    formData.append('file', file)
    await request.put<unknown>('/apis/user/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },

  /**
   * 修改密码（需验证原密码）
   * @param data 原密码与新密码
   */
  changePassword: (data: ChangePasswordParams) => {
    return request.put('/apis/user/password', data)
  },

  /**
   * 首次设置密码（无原密码，适用于邮箱验证码注册用户）
   * @param data 新密码及验证码
   */
  setPassword: async (data: SetPasswordParams): Promise<void> => {
    await request.post<unknown>('/apis/user/password', data)
  },

  /**
   * 退出登录
   * 清除服务端 session，客户端需同步清除 token
   */
  logout: () => {
    return request.post('/apis/auth/logout')
  },

  /**
   * 忘记密码-发送邮箱验证码
   * @param mail 注册邮箱
   */
  sendForgetPasswordCode: (mail: string) => {
    return request.get(`/apis/user/forget-password/code/${mail}`)
  },

  /**
   * 忘记密码-重置密码
   * @param data 邮箱、验证码、新密码
   */
  updateForgetPassword: (data: ForgotPasswordParams) => {
    return request.put('/apis/user/forget-password', data)
  },

  /**
   * 获取用户传输设置（并发数、分片大小等）
   * @returns 传输配置
   */
  getTransferSetting: () => {
    return request.get<TransferSetting>('/apis/user/transfer/setting')
  },

  /**
   * 更新用户传输设置
   * @param data 传输配置更新命令
   * @returns 更新后的传输配置
   */
  updateTransferSetting: (data: UpdateTransferSettingCmd) => {
    return request.put<TransferSetting>('/apis/user/transfer/setting', data)
  },
}
