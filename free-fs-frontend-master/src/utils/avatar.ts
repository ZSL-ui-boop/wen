/**
 * 用户头像占位文字工具
 *
 * 当用户未上传头像时，根据昵称/用户名生成 1～2 个字符的 fallback 文字，
 * 用于 Avatar 组件的 initials 展示。
 */

/**
 * 获取用户头像的 fallback 文字
 *
 * 规则：
 * - 中文名：取第一个汉字
 * - 英文名：取前两个字母并转大写
 * - 无有效字符：取前两个字符或显示「?」
 *
 * @param name 用户昵称或用户名
 * @returns 1～2 个字符的占位文字
 */
export function getAvatarFallback(name: string): string {
  if (!name || !name.trim()) {
    return '?'
  }

  const trimmedName = name.trim()

  // 检查是否包含中文字符
  const hasChinese = /[\u4e00-\u9fa5]/.test(trimmedName)

  if (hasChinese) {
    // 中文：只取第一个汉字作为头像字
    const firstChinese = trimmedName.match(/[\u4e00-\u9fa5]/)
    return firstChinese ? firstChinese[0] : trimmedName.slice(0, 1)
  } else {
    // 非中文：优先取拉丁字母的前两个并转大写
    const letters = trimmedName.replace(/[^a-zA-Z]/g, '')
    if (letters.length === 0) {
      // 无字母时退化为取前两个任意字符
      return trimmedName.slice(0, 2).toUpperCase()
    }
    return letters.slice(0, 2).toUpperCase()
  }
}
