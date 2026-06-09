/**
 * 工作空间权限 Hook
 *
 * 基于当前工作空间角色的 permissions 列表，提供单权限、
 * 任一/全部权限判断及管理员身份检测。
 */
import { useCallback, useMemo } from 'react'
import { useWorkspaceStore } from '@/store/workspace'
import type { PermissionCodeType } from '@/types/permission'

/**
 * 读取当前角色权限并提供便捷判断方法
 *
 * @returns hasPermission / hasAnyPermission / hasAllPermissions / isAdmin
 */
export function usePermission() {
  const currentRole = useWorkspaceStore((s) => s.currentRole)
  const permissions = currentRole?.permissions ?? []

  // Set 便于 O(1) 权限查询
  const permissionSet = useMemo(() => new Set(permissions), [permissions])

  /** 是否拥有指定单个权限码 */
  const hasPermission = useCallback(
    (code: PermissionCodeType) => permissionSet.has(code),
    [permissionSet]
  )

  /** 是否拥有传入权限码中的任意一个 */
  const hasAnyPermission = useCallback(
    (...codes: PermissionCodeType[]) => codes.some((c) => permissionSet.has(c)),
    [permissionSet]
  )

  /** 是否同时拥有传入的全部权限码 */
  const hasAllPermissions = useCallback(
    (...codes: PermissionCodeType[]) =>
      codes.every((c) => permissionSet.has(c)),
    [permissionSet]
  )

  const isAdmin = currentRole?.roleCode === 'admin'

  return { hasPermission, hasAnyPermission, hasAllPermissions, isAdmin }
}
