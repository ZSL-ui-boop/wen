/**
 * 分享链接权限 scope 解析
 *
 * scope 为空或未传表示不限制；仅当显式列出权限项且不包含对应项时禁用该能力。
 */

/**
 * 判断分享 scope 是否允许预览
 *
 * @param scope 服务端返回的权限 scope 字符串（如含 preview、download）
 * @returns scope 为空或未限制时 true；显式列出且不包含 preview 时 false
 */
export function shareAllowsPreview(scope?: string | null): boolean {
  const s = scope?.trim()
  if (!s) return true
  return s.includes('preview')
}

/**
 * 判断分享 scope 是否允许下载
 *
 * @param scope 服务端返回的权限 scope 字符串
 * @returns scope 为空或未限制时 true；显式列出且不包含 download 时 false
 */
export function shareAllowsDownload(scope?: string | null): boolean {
  const s = scope?.trim()
  if (!s) return true
  return s.includes('download')
}
