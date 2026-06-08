/** 分享权限 scope：为空或未传表示不限制；仅当显式列出且不包含该项时禁用 */

export function shareAllowsPreview(scope?: string | null): boolean {
  const s = scope?.trim()
  if (!s) return true
  return s.includes('preview')
}

export function shareAllowsDownload(scope?: string | null): boolean {
  const s = scope?.trim()
  if (!s) return true
  return s.includes('download')
}
