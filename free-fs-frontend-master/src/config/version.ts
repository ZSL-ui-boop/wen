/**
 * 应用版本配置模块
 *
 * 职责：从 package.json 读取应用版本号，供关于页、更新提示等 UI 展示。
 * 版本号随构建时的 package.json 自动同步，无需手动维护。
 */
import packageJson from '../../package.json'

/** 当前应用版本号（语义化版本，如 "1.0.0"） */
export const APP_VERSION = packageJson.version
