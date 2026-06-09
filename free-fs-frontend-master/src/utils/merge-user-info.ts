/**
 * 用户信息合并工具
 *
 * 将接口返回的部分用户字段合并进当前用户对象，
 * 避免 PUT 只返回 patch 字段时误清空头像等已有信息。
 */
import type { UserInfo } from '@/types/user'

/**
 * 将 patch 中的非空字段合并到 prev，生成新的 UserInfo
 *
 * 仅当 patch 中某字段值不为 undefined 且不为 null 时才覆盖，
 * 保留 prev 中未被 patch 提及的字段。
 *
 * @param prev 当前完整的用户信息
 * @param patch 接口返回的部分更新字段
 * @returns 合并后的新 UserInfo（浅拷贝）
 */
export function mergeUserInfo(
  prev: UserInfo,
  patch: Partial<UserInfo>
): UserInfo {
  const next = { ...prev }
  for (const key of Object.keys(patch) as (keyof UserInfo)[]) {
    const v = patch[key]
    // 忽略 undefined / null，避免清空已有字段
    if (v !== undefined && v !== null) {
      ;(next as Record<keyof UserInfo, UserInfo[keyof UserInfo]>)[key] = v
    }
  }
  return next
}
