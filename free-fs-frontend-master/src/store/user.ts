/**
 * 用户状态 Store
 *
 * 职责：管理当前登录用户的基本信息与传输设置（分片大小、并发数等），
 * 并通过 persist 中间件持久化到 localStorage，供上传/下载等模块读取。
 */
import { TransferSetting } from '@/types/transfer-setting'
import { UserInfo } from '@/types/user'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { userApi } from '@/api/user'

/** 用户 Store 的状态结构与操作方法 */
interface UserState {
  /** 用户 ID */
  id: string
  /** 登录用户名 */
  username: string
  /** 显示昵称 */
  nickname: string
  /** 邮箱地址 */
  email: string
  /** 头像 URL */
  avatar: string
  /** 账号状态（如启用/禁用） */
  status: number
  /** 账号创建时间 */
  createdAt: string
  /** 账号最后更新时间 */
  updatedAt: string
  /** 最后登录时间 */
  lastLoginAt: string
  /** 是否已设置密码（第三方登录用户可能未设置） */
  isSetPassword?: boolean
  /** 传输相关设置（分片大小、并发上传数等） */
  transferSetting?: TransferSetting
  /** 将 API 返回的用户信息写入 Store */
  setUserInfo: (userInfo: UserInfo) => void
  /** 更新传输设置（本地或接口拉取后调用） */
  setTransferSetting: (setting: TransferSetting) => void
  /** 从后端拉取传输设置；失败时使用默认值 */
  loadTransferSetting: () => Promise<void>
  /** 清空用户信息（登出时调用） */
  clearUserInfo: () => void
}

/** 用户 Store Hook，持久化键名为 `user-storage` */
export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      id: '',
      username: '',
      nickname: '',
      email: '',
      avatar: '',
      status: 0,
      createdAt: '',
      updatedAt: '',
      lastLoginAt: '',
      isSetPassword: undefined,
      transferSetting: undefined,

      /** @see UserState.setUserInfo */
      setUserInfo: (userInfo) =>
        set({
          id: userInfo.id,
          username: userInfo.username,
          nickname: userInfo.nickname,
          email: userInfo.email,
          avatar: userInfo.avatar,
          status: userInfo.status,
          createdAt: userInfo.createdAt,
          updatedAt: userInfo.updatedAt,
          lastLoginAt: userInfo.lastLoginAt,
          isSetPassword: userInfo.isSetPassword,
        }),

      /** @see UserState.setTransferSetting */
      setTransferSetting: (setting) => set({ transferSetting: setting }),

      /** @see UserState.loadTransferSetting */
      loadTransferSetting: async () => {
        try {
          const setting = await userApi.getTransferSetting()
          set({ transferSetting: setting })
        } catch (error) {
          // 接口失败时使用与后端一致的默认传输配置，保证上传流程仍可继续
          set({
            transferSetting: {
              userId: '',
              downloadLocation: '',
              isDefaultDownloadLocation: 1,
              downloadSpeedLimit: 0,
              concurrentUploadQuantity: 3,
              concurrentDownloadQuantity: 3,
              chunkSize: 5 * 1024 * 1024,
            },
          })
        }
      },

      /** @see UserState.clearUserInfo */
      clearUserInfo: () =>
        set({
          id: '',
          username: '',
          nickname: '',
          email: '',
          avatar: '',
          status: 0,
          createdAt: '',
          updatedAt: '',
          lastLoginAt: '',
          isSetPassword: undefined,
          transferSetting: undefined,
        }),
    }),
    {
      name: 'user-storage',
    }
  )
)
