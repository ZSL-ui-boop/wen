/**
 * 认证 Token 本地存储工具
 *
 * 统一管理 accessToken 的读写与清除，支持「记住我」与「会话级」两种持久化策略。
 */

/** localStorage / sessionStorage 中存储 Token 的键名 */
const TOKEN_KEY = 'accessToken'

/**
 * 获取当前登录 Token
 * 优先从 localStorage 读取（记住我），否则从 sessionStorage 读取
 *
 * @returns Token 字符串，未登录时返回 null
 */
export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY)
}

/**
 * 保存登录 Token
 *
 * @param token 服务端颁发的 accessToken
 * @param remember 为 true 时写入 localStorage 并清除 sessionStorage；否则相反
 */
export const setToken = (token: string, remember: boolean = false): void => {
  if (remember) {
    localStorage.setItem(TOKEN_KEY, token)
    sessionStorage.removeItem(TOKEN_KEY)
  } else {
    sessionStorage.setItem(TOKEN_KEY, token)
    localStorage.removeItem(TOKEN_KEY)
  }
}

/** 清除两处存储中的 Token，用于登出 */
export const clearToken = (): void => {
  localStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
}

/**
 * 判断当前是否已登录
 *
 * @returns 存在有效 Token 时为 true
 */
export const isLogin = (): boolean => {
  return !!getToken()
}
