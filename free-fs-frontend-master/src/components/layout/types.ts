/**
 * @file 布局类型定义
 * @description 侧边栏导航、用户与团队相关的 TypeScript 类型。
 */
import type { PermissionCodeType } from '@/types/permission'

/** 侧边栏导航：默认 Line，选中时 Fill（@remixicon/react） */
type SidebarNavIconPair = {
  line: React.ElementType<{ className?: string }>
  fill: React.ElementType<{ className?: string }>
}

/** 侧边栏用户信息 */
type User = {
  name: string
  email: string
  avatar: string
}

/** 团队/组织占位类型（预留） */
type Team = {
  name: string
  logo: React.ElementType
  plan: string
}

/** 导航项公共字段 */
type BaseNavItem = {
  /** i18n 键名，位于 `layout` 命名空间，如 sidebar.nav.home */
  titleKey: string
  badge?: string
  icon?: SidebarNavIconPair
  permission?: PermissionCodeType
}

/** 单层链接型导航项 */
type NavLink = BaseNavItem & {
  url: string
  items?: never
}

/** 带子菜单的可折叠导航项 */
type NavCollapsible = BaseNavItem & {
  items: (BaseNavItem & { url: string })[]
  url?: never
}

type NavItem = NavCollapsible | NavLink

/** 导航分组：含标题与若干导航项 */
type NavGroup = {
  titleKey: string
  items: NavItem[]
}

/** 侧边栏静态数据结构 */
type SidebarData = {
  user: User
  teams: Team[]
  navGroups: NavGroup[]
}

export type {
  SidebarData,
  NavGroup,
  NavItem,
  NavCollapsible,
  NavLink,
  SidebarNavIconPair,
}
