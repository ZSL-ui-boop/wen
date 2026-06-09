/**
 * SSE 连接生命周期 Hook
 *
 * 在用户已认证且工作空间已激活时自动建立 SSE 连接，
 * 切换用户或工作空间时断开并重连，登出时清理连接。
 */
import { useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useTransferStore } from '@/store/transfer'
import { useWorkspaceStore } from '@/store/workspace'

/**
 * 自动管理传输模块 SSE 连接的 React Hook
 *
 * 依赖：isAuthenticated、user.id、currentWorkspaceId、currentRole 均就绪后才 initSSE。
 *
 * @returns sseConnected 当前 SSE 是否已连接
 */
export function useSSEConnection() {
  const { user, isAuthenticated } = useAuth()
  const { initSSE, disconnectSSE, sseConnected } = useTransferStore()
  const currentWorkspaceId = useWorkspaceStore((s) => s.currentWorkspaceId)
  const currentRole = useWorkspaceStore((s) => s.currentRole)
  const isInitializedRef = useRef(false)
  /** 记录上次 init 时的「用户:工作空间」上下文，避免重复连接 */
  const contextRef = useRef<string | null>(null)

  useEffect(() => {
    const contextKey = `${user?.id}:${currentWorkspaceId}`

    if (isAuthenticated && user?.id && currentWorkspaceId && currentRole) {
      // 同一上下文且已初始化则跳过
      if (isInitializedRef.current && contextRef.current === contextKey) {
        return
      }

      // 用户或工作空间变化：先断开旧连接
      if (isInitializedRef.current) {
        disconnectSSE()
      }

      initSSE(user.id)
      isInitializedRef.current = true
      contextRef.current = contextKey
    }

    return () => {
      // 登出或未认证时断开 SSE 并重置 ref
      if (!isAuthenticated || !user?.id) {
        disconnectSSE()
        isInitializedRef.current = false
        contextRef.current = null
      }
    }
  }, [isAuthenticated, user?.id, currentWorkspaceId, currentRole])

  return { sseConnected }
}
