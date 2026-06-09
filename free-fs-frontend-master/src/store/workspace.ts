/**
 * 工作空间状态 Store
 *
 * 职责：管理用户可访问的工作空间列表、当前选中的工作空间 ID，
 * 以及当前工作空间下的角色权限。仅持久化 currentWorkspaceId，
 * 工作空间列表在登录后由接口重新拉取。
 */
import type { Workspace } from '@/types/workspace'
import type { UserRolePermissions } from '@/types/user'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** 工作空间 Store 的状态结构与操作方法 */
interface WorkspaceState {
  /** 用户有权限访问的所有工作空间 */
  workspaces: Workspace[]
  /** 当前选中的工作空间 ID，未选择时为 null */
  currentWorkspaceId: string | null
  /** 当前工作空间下用户的角色与权限 */
  currentRole: UserRolePermissions | null

  /** 设置工作空间列表（登录或切换租户后调用） */
  setWorkspaces: (list: Workspace[]) => void
  /** 切换当前工作空间 */
  setCurrentWorkspaceId: (id: string | null) => void
  /** 设置当前工作空间下的角色权限 */
  setCurrentRole: (role: UserRolePermissions | null) => void
  /** 清空所有工作空间相关状态（登出时调用） */
  clear: () => void
}

/** 工作空间 Store Hook，持久化键名为 `workspace-storage` */
export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      workspaces: [],
      currentWorkspaceId: null,
      currentRole: null,

      /** @see WorkspaceState.setWorkspaces */
      setWorkspaces: (workspaces) => set({ workspaces }),

      /** @see WorkspaceState.setCurrentWorkspaceId */
      setCurrentWorkspaceId: (id) => set({ currentWorkspaceId: id }),

      /** @see WorkspaceState.setCurrentRole */
      setCurrentRole: (role) => set({ currentRole: role }),

      /** @see WorkspaceState.clear */
      clear: () =>
        set({
          workspaces: [],
          currentWorkspaceId: null,
          currentRole: null,
        }),
    }),
    {
      name: 'workspace-storage',
      // 只持久化当前工作空间 ID，列表数据以服务端为准
      partialize: (state) => ({
        currentWorkspaceId: state.currentWorkspaceId,
      }),
    }
  )
)

/**
 * 获取当前工作空间 ID（非 Hook 场景，如 API 拦截器）
 * @returns 当前工作空间 ID，未选择时返回 null
 */
export const getCurrentWorkspaceId = (): string | null =>
  useWorkspaceStore.getState().currentWorkspaceId

/**
 * 根据当前工作空间 ID 查找对应的 slug（URL 路由标识）
 * @returns 当前工作空间的 slug，找不到时返回 null
 */
export const getCurrentSlug = (): string | null => {
  const { workspaces, currentWorkspaceId } = useWorkspaceStore.getState()
  return workspaces.find((w) => w.id === currentWorkspaceId)?.slug ?? null
}

/**
 * 按 slug 查找工作空间
 * @param slug 工作空间 URL 标识
 * @returns 匹配的工作空间对象，不存在时返回 undefined
 */
export const findBySlug = (slug: string): Workspace | undefined =>
  useWorkspaceStore.getState().workspaces.find((w) => w.slug === slug)
