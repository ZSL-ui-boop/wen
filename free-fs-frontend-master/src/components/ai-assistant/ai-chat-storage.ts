/**
 * @file AI 聊天本地存储
 * @description 按工作空间持久化会话、消息、深度思考与 Agent 模式偏好至 localStorage。
 */
import { getCurrentWorkspaceId } from '@/store/workspace'

/** 单条 AI 对话消息（持久化结构） */
export type StoredAiMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  thinking?: string
  plan?: string
  answer?: string
}

/** 单个聊天会话 */
export type AiChatSession = {
  id: string
  title: string
  updatedAt: number
  messages: StoredAiMessage[]
}

/** 工作空间级 AI 存储根结构 */
export type AiWorkspaceStore = {
  activeSessionId: string
  deepThink: boolean
  agentMode: boolean
  sessions: AiChatSession[]
  memory: string[]
}

const MAX_MESSAGES_PER_SESSION = 40
const MAX_SESSIONS = 30
const MAX_MEMORY_ITEMS = 20
const MAX_MEMORY_LEN = 500

/** 生成当前工作空间的 localStorage 键 */
function storeKey(): string {
  const ws = getCurrentWorkspaceId() || 'default'
  return `free-fs-ai-store:${ws}`
}

/** 旧版单会话存储键（用于迁移） */
function legacyKey(): string {
  const ws = getCurrentWorkspaceId() || 'default'
  return `free-fs-ai-chat:${ws}`
}

/** 根据首条用户消息生成会话标题 */
function sessionTitle(messages: StoredAiMessage[]): string {
  const first = messages.find((m) => m.role === 'user' && m.content.trim())
  if (!first) return '新对话'
  const t = first.content.trim().replace(/\s+/g, ' ')
  return t.length > 28 ? `${t.slice(0, 28)}…` : t
}

/** 创建新会话对象 */
function newSession(messages: StoredAiMessage[] = []): AiChatSession {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    title: sessionTitle(messages),
    updatedAt: now,
    messages: messages.slice(-MAX_MESSAGES_PER_SESSION),
  }
}

/** 默认空存储（含一个空会话） */
function defaultStore(): AiWorkspaceStore {
  const session = newSession()
  return {
    activeSessionId: session.id,
    deepThink: true,
    agentMode: false,
    sessions: [session],
    memory: [],
  }
}

/** 从旧版单会话格式迁移到新多会话结构 */
function migrateLegacy(): AiWorkspaceStore | null {
  try {
    const raw = localStorage.getItem(legacyKey())
    if (!raw) return null
    const data = JSON.parse(raw) as {
      messages?: StoredAiMessage[]
      deepThink?: boolean
    }
    const messages = Array.isArray(data.messages) ? data.messages : []
    const session = newSession(messages)
    if (messages.length > 0) session.title = sessionTitle(messages)
    return {
      activeSessionId: session.id,
      deepThink: data.deepThink !== false,
      agentMode: false,
      sessions: [session],
      memory: [],
    }
  } catch {
    return null
  }
}

/** 从 localStorage 加载 AI 存储，必要时执行旧数据迁移 */
export function loadAiStore(): AiWorkspaceStore {
  try {
    const raw = localStorage.getItem(storeKey())
    if (!raw) {
      const migrated = migrateLegacy()
      if (migrated) {
        persistStore(migrated)
        localStorage.removeItem(legacyKey())
        return migrated
      }
      return defaultStore()
    }
    const data = JSON.parse(raw) as Partial<AiWorkspaceStore>
    if (!Array.isArray(data.sessions) || data.sessions.length === 0) {
      return defaultStore()
    }
    const sessions = data.sessions.slice(0, MAX_SESSIONS).map((s) => ({
      id: s.id || crypto.randomUUID(),
      title: s.title || '新对话',
      updatedAt: s.updatedAt || Date.now(),
      messages: Array.isArray(s.messages)
        ? s.messages.slice(-MAX_MESSAGES_PER_SESSION)
        : [],
    }))
    const activeId =
      sessions.find((s) => s.id === data.activeSessionId)?.id ?? sessions[0].id
    return {
      activeSessionId: activeId,
      deepThink: data.deepThink !== false,
      agentMode: data.agentMode === true,
      sessions,
      memory: Array.isArray(data.memory)
        ? data.memory
            .map((m) => String(m).trim().slice(0, MAX_MEMORY_LEN))
            .filter(Boolean)
            .slice(0, MAX_MEMORY_ITEMS)
        : [],
    }
  } catch {
    return defaultStore()
  }
}

/** 将完整存储写入 localStorage */
export function persistStore(store: AiWorkspaceStore) {
  try {
    localStorage.setItem(storeKey(), JSON.stringify(store))
  } catch {
    /* quota */
  }
}

/** 获取当前激活的会话 */
export function getActiveSession(store: AiWorkspaceStore): AiChatSession {
  return (
    store.sessions.find((s) => s.id === store.activeSessionId) ??
    store.sessions[0]
  )
}

/** 更新当前会话消息及模式偏好 */
export function updateActiveSession(
  store: AiWorkspaceStore,
  messages: StoredAiMessage[],
  deepThink: boolean,
  agentMode: boolean
): AiWorkspaceStore {
  const now = Date.now()
  const sessions = store.sessions.map((s) => {
    if (s.id !== store.activeSessionId) return s
    const trimmed = messages.slice(-MAX_MESSAGES_PER_SESSION)
    return {
      ...s,
      messages: trimmed,
      updatedAt: now,
      title: trimmed.length > 0 ? sessionTitle(trimmed) : s.title,
    }
  })
  return { ...store, sessions, deepThink, agentMode }
}

/** 新建会话并设为当前激活 */
export function createNewSession(store: AiWorkspaceStore): AiWorkspaceStore {
  const session = newSession()
  const sessions = [session, ...store.sessions].slice(0, MAX_SESSIONS)
  return {
    ...store,
    activeSessionId: session.id,
    sessions,
  }
}

/** 切换到指定会话，不存在则返回 null */
export function switchSession(
  store: AiWorkspaceStore,
  sessionId: string
): AiWorkspaceStore | null {
  if (!store.sessions.some((s) => s.id === sessionId)) return null
  return { ...store, activeSessionId: sessionId }
}

/** 删除会话；仅剩一条时重置为空会话 */
export function deleteSession(
  store: AiWorkspaceStore,
  sessionId: string
): AiWorkspaceStore {
  if (store.sessions.length <= 1) {
    const fresh = newSession()
    return {
      ...store,
      activeSessionId: fresh.id,
      sessions: [fresh],
    }
  }
  const sessions = store.sessions.filter((s) => s.id !== sessionId)
  const activeSessionId =
    store.activeSessionId === sessionId
      ? sessions[0].id
      : store.activeSessionId
  return { ...store, sessions, activeSessionId }
}

/** 向记忆列表追加一条（去重、截断长度与数量） */
export function addMemoryItem(store: AiWorkspaceStore, text: string): AiWorkspaceStore {
  const item = text.trim().slice(0, MAX_MEMORY_LEN)
  if (!item || store.memory.includes(item)) return store
  return {
    ...store,
    memory: [item, ...store.memory].slice(0, MAX_MEMORY_ITEMS),
  }
}

/** 按索引移除记忆项 */
export function removeMemoryItem(store: AiWorkspaceStore, index: number): AiWorkspaceStore {
  return {
    ...store,
    memory: store.memory.filter((_, i) => i !== index),
  }
}

/** @deprecated 兼容旧调用 */
export function loadAiChat() {
  const store = loadAiStore()
  const session = getActiveSession(store)
  return {
    messages: session.messages,
    deepThink: store.deepThink,
    agentMode: store.agentMode,
  }
}

/** @deprecated */
export function saveAiChat(
  messages: StoredAiMessage[],
  deepThink: boolean,
  agentMode = false
) {
  const s = loadAiStore()
  persistStore(updateActiveSession(s, messages, deepThink, agentMode))
}

/** @deprecated */
export function clearAiChatStorage() {
  persistStore(createNewSession(loadAiStore()))
}
