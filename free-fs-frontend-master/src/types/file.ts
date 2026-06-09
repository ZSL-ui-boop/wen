/**
 * 文件模块类型定义
 * 与后端 FileInfo、回收站、文件列表查询等接口字段对齐
 */

/** 文件/文件夹列表项 */
export interface FileItem {
  /** 文件唯一 ID */
  id: string
  /** 对象存储 key */
  objectKey: string
  /** 原始文件名（含后缀） */
  originalName: string
  /** 展示名称 */
  displayName: string
  /** 文件后缀（不含点） */
  suffix: string
  /** 文件大小（字节） */
  size: number
  /** MIME 类型 */
  mimeType: string
  /** 是否为文件夹 */
  isDir: boolean
  /** 父文件夹 ID，根目录为空 */
  parentId?: string
  /** 所属用户 ID */
  userId: string
  /** 上传时间 */
  uploadTime: string
  /** 最后修改时间 */
  updateTime: string
  /** 最后访问时间 */
  lastAccessTime?: string
  /** 是否已收藏 */
  isFavorite?: boolean
  /** 缩略图 URL（图片/视频等） */
  thumbnailUrl?: string
  /** 文件夹内文件数量（仅文件夹详情） */
  includeFiles?: number
  /** 文件夹内子文件夹数量（仅文件夹详情） */
  includeFolders?: number
  /** 创建时间（文件夹详情） */
  createTime?: string
}

/** 回收站中的文件/文件夹项 */
export interface FileRecycleItem {
  id: string
  displayName: string
  suffix: string
  size: number
  isDir: boolean
  /** 移入回收站的时间 */
  deletedTime: string
}

/** 回收站分页列表查询（与后端 /apis/recycle/pages 一致） */
export interface RecyclePageQuery {
  /** 名称关键词 */
  keyword?: string
  page?: number
  pageSize?: number
}

/** 文件类型筛选枚举 */
export type FileType = 'image' | 'video' | 'audio' | 'document' | 'other'

/** 排序方向 */
export type SortOrder = 'ASC' | 'DESC'

/** 文件列表查询参数 */
export interface FileListParams {
  /** 排序字段 */
  orderBy?: string
  orderDirection?: SortOrder
  /** 父文件夹 ID，不传则查根目录 */
  parentId?: string
  /** 名称关键词 */
  keyword?: string
  /** 按文件类型筛选 */
  fileType?: FileType
  /** 仅收藏 */
  isFavorite?: boolean
  /** 仅最近访问 */
  isRecents?: boolean
  /** 仅文件夹 */
  isDir?: boolean
  page?: number
  pageSize?: number
}

/** 面包屑导航项 */
export interface BreadcrumbItem {
  id: string
  name: string
}
