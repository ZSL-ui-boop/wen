/**
 * 权限模块类型定义
 * 权限码与后端 RBAC 体系一致，用于前端路由守卫与按钮级鉴权
 */

/** 系统预定义权限码常量 */
export const PermissionCode = {
  /** 查看文件 */
  FILE_READ: 'file:read',
  /** 上传/编辑/删除文件 */
  FILE_WRITE: 'file:write',
  /** 创建分享链接 */
  FILE_SHARE: 'file:share',
  /** 管理存储平台配置 */
  STORAGE_MANAGE: 'storage:manage',
  /** 管理工作空间成员与角色 */
  MEMBER_MANAGE: 'member:manage',
} as const

/** 权限码联合类型 */
export type PermissionCodeType =
  (typeof PermissionCode)[keyof typeof PermissionCode]

/** GET `/apis/permission/list` 返回的权限定义项 */
export interface PermissionDef {
  id: number
  permissionCode: PermissionCodeType
  permissionName: string
  /** 所属模块（file / storage / member 等） */
  module: string
  desc?: string | null
  sort?: number
}

/** 通用分页结果（部分接口使用） */
export interface PageResult<T> {
  total: number
  records: T[]
}
