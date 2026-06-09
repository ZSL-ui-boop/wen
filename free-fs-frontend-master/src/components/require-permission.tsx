/**
 * @file 权限守卫组件
 * @description 按权限码条件渲染子节点或 fallback，支持单权限与任一权限匹配。
 */
import type { ReactNode } from 'react'
import { usePermission } from '@/hooks/use-permission'
import type { PermissionCodeType } from '@/types/permission'

interface RequirePermissionProps {
  code: PermissionCodeType
  children: ReactNode
  fallback?: ReactNode
}

/**
 * 拥有指定权限时渲染 children，否则渲染 fallback。
 */
export function RequirePermission({
  code,
  children,
  fallback = null,
}: RequirePermissionProps) {
  const { hasPermission } = usePermission()

  return hasPermission(code) ? <>{children}</> : <>{fallback}</>
}

interface RequireAnyPermissionProps {
  codes: PermissionCodeType[]
  children: ReactNode
  fallback?: ReactNode
}

/**
 * 拥有 codes 中任一权限时渲染 children，否则渲染 fallback。
 */
export function RequireAnyPermission({
  codes,
  children,
  fallback = null,
}: RequireAnyPermissionProps) {
  const { hasAnyPermission } = usePermission()

  return hasAnyPermission(...codes) ? <>{children}</> : <>{fallback}</>
}
