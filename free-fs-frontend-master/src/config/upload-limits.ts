/**
 * 上传限制配置模块
 *
 * 职责：定义文件夹批量上传的数量、体积、深度等上限，
 * 提供文件过滤与大小格式化工具函数，以及不同场景的预设配置。
 * 可根据部署环境（个人/企业/内部）调整 UPLOAD_LIMITS 或选用 PRESET_CONFIGS。
 */

/** 上传目录功能的限制常量集合 */
export const UPLOAD_LIMITS = {
  /**
   * 单次上传最多文件数量（文件夹批量）
   * 总体积仍受 MAX_TOTAL_SIZE 限制；海量小文件场景需要较高上限。
   */
  MAX_FILES: 200_000,

  /**
   * 单次上传总大小限制（字节）
   * 推荐值：10GB（个人网盘）、5GB（企业网盘）、50GB（内部系统）
   */
  MAX_TOTAL_SIZE: 10 * 1024 * 1024 * 1024, // 10GB

  /**
   * 最大目录深度（相对路径中 `/` 分隔的层级数）
   * 推荐值：10（个人网盘）、8（企业网盘）、15（内部系统）
   */
  MAX_DEPTH: 10,

  /**
   * 单个文件名最大长度
   * 推荐值：255（常见文件系统限制）
   */
  MAX_FILENAME_LENGTH: 255,

  /**
   * 完整相对路径最大长度（含目录 + 文件名）
   * 推荐值：1024
   */
  MAX_PATH_LENGTH: 1024,

  /**
   * 是否允许上传空文件夹
   * 推荐值：true
   */
  ALLOW_EMPTY_FOLDERS: true,

  /**
   * 是否自动过滤系统/开发工具产生的无关文件
   * 推荐值：true
   */
  AUTO_FILTER_SYSTEM_FILES: true,

  /**
   * 需要过滤的文件/文件夹路径片段
   * 路径中包含以下任一模式时会被自动跳过，不会上传
   */
  IGNORED_PATTERNS: [
    '.DS_Store',      // macOS 系统文件
    'Thumbs.db',      // Windows 缩略图缓存
    'desktop.ini',    // Windows 桌面配置
    '.git/',          // Git 版本控制
    'node_modules/',  // Node.js 依赖
    '__pycache__/',   // Python 缓存
    '.vscode/',       // VS Code 配置
    '.idea/',         // IntelliJ IDEA 配置
    '.svn/',          // SVN 版本控制
    '.hg/',           // Mercurial 版本控制
    'dist/',          // 构建输出（可选）
    'build/',         // 构建输出（可选）
  ],

  /**
   * 阻止的文件扩展名（可选，默认为空表示不限制）
   * 如需阻止可执行文件等，取消注释并添加扩展名
   */
  BLOCKED_EXTENSIONS: [
    // '.exe',
    // '.bat',
    // '.cmd',
    // '.sh',
    // '.dll',
    // '.scr',
  ] as string[],

  /**
   * 阻止的 MIME 类型（可选，默认为空表示不限制）
   */
  BLOCKED_MIMETYPES: [
    // 'application/x-msdownload',
    // 'application/x-sh',
  ] as string[],
}

/**
 * 将字节数格式化为人类可读的文件大小字符串
 * @param bytes 字节数
 * @returns 如 "1.50 GB"、"256.00 KB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

/**
 * 判断文件路径是否应被自动过滤（系统文件、依赖目录等）
 * @param filePath 文件的相对路径或文件名
 * @returns 若应跳过上传则返回 true
 */
export function shouldFilterFile(filePath: string): boolean {
  if (!UPLOAD_LIMITS.AUTO_FILTER_SYSTEM_FILES) {
    return false
  }

  return UPLOAD_LIMITS.IGNORED_PATTERNS.some((pattern) =>
    filePath.includes(pattern)
  )
}

/**
 * 判断文件扩展名是否在阻止列表中
 * @param fileName 文件名（含扩展名）
 * @returns 若扩展名被阻止则返回 true
 */
export function isExtensionBlocked(fileName: string): boolean {
  if (UPLOAD_LIMITS.BLOCKED_EXTENSIONS.length === 0) {
    return false
  }

  const ext = '.' + fileName.split('.').pop()?.toLowerCase()
  return UPLOAD_LIMITS.BLOCKED_EXTENSIONS.includes(ext)
}

/**
 * 判断 MIME 类型是否在阻止列表中
 * @param mimeType 文件的 MIME 类型
 * @returns 若 MIME 被阻止则返回 true
 */
export function isMimeTypeBlocked(mimeType: string): boolean {
  if (UPLOAD_LIMITS.BLOCKED_MIMETYPES.length === 0) {
    return false
  }

  return UPLOAD_LIMITS.BLOCKED_MIMETYPES.includes(mimeType)
}

/** 不同部署场景的预设上传限制（可按需覆盖 UPLOAD_LIMITS 中的对应字段） */
export const PRESET_CONFIGS = {
  /**
   * 个人网盘场景（默认推荐）
   * 文件数上限高、单批 10GB、深度 10 层
   */
  PERSONAL: {
    MAX_FILES: 200_000,
    MAX_TOTAL_SIZE: 10 * 1024 * 1024 * 1024, // 10GB
    MAX_DEPTH: 10,
    AUTO_FILTER_SYSTEM_FILES: true,
    BLOCKED_EXTENSIONS: [],
  },

  /**
   * 企业网盘场景
   * 更严格的体积与深度限制，并阻止常见可执行文件扩展名
   */
  ENTERPRISE: {
    MAX_FILES: 50_000,
    MAX_TOTAL_SIZE: 5 * 1024 * 1024 * 1024, // 5GB
    MAX_DEPTH: 8,
    AUTO_FILTER_SYSTEM_FILES: true,
    BLOCKED_EXTENSIONS: ['.exe', '.bat', '.cmd', '.sh', '.dll'],
  },

  /**
   * 内部系统场景
   * 允许更大批量与深度，不过滤系统文件
   */
  INTERNAL: {
    MAX_FILES: 500_000,
    MAX_TOTAL_SIZE: 50 * 1024 * 1024 * 1024, // 50GB
    MAX_DEPTH: 15,
    AUTO_FILTER_SYSTEM_FILES: false,
    BLOCKED_EXTENSIONS: [],
  },
}
