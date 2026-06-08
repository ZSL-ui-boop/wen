import { getCurrentWorkspaceId } from '@/store/workspace'

export type StoredAiMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  thinking?: string
  plan?: string
  answer?: string
}

export type AiChatSession = {
  id: string
  title: string
  updatedAt: number
  messages: StoredAiMessage[]
}

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

function storeKey(): string {
  const ws = getCurrentWorkspaceId() || 'default'
  return `free-fs-ai-store:${ws}`
}

function legacyKey(): string {
  const ws = getCurrentWorkspaceId() || 'default'
  return `free-fs-ai-chat:${ws}`
}

function sessionTitle(messages: StoredAiMessage[]): string {
  const first = messages.find((m) => m.role === 'user' && m.content.trim())
  if (!first) return '新对话'
  const t = first.content.trim().replace(/\s+/g, ' ')
  return t.length > 28 ? `${t.slice(0, 28)}…` : t
}

function newSession(messages: StoredAiMessage[] = []): AiChatSession {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    title: sessionTitle(messages),
    updatedAt: now,
    messages: messages.slice(-MAX_MESSAGES_PER_SESSION),
  }
}

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

export function persistStore(store: AiWorkspaceStore) {
  try {
    localStorage.setItem(storeKey(), JSON.stringify(store))
  } catch {
    /* quota */
  }
}

export function getActiveSession(store: AiWorkspaceStore): AiChatSession {
  return (
    store.sessions.find((s) => s.id === store.activeSessionId) ??
    store.sessions[0]
  )
}

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

export function createNewSession(store: AiWorkspaceStore): AiWorkspaceStore {
  const session = newSession()
  const sessions = [session, ...store.sessions].slice(0, MAX_SESSIONS)
  return {
    ...store,
    activeSessionId: session.id,
    sessions,
  }
}

export function switchSession(
  store: AiWorkspaceStore,
  sessionId: string
): AiWorkspaceStore | null {
  if (!store.sessions.some((s) => s.id === sessionId)) return null
  return { ...store, activeSessionId: sessionId }
}

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

export function addMemoryItem(store: AiWorkspaceStore, text: string): AiWorkspaceStore {
  const item = text.trim().slice(0, MAX_MEMORY_LEN)
  if (!item || store.memory.includes(item)) return store
  return {
    ...store,
    memory: [item, ...store.memory].slice(0, MAX_MEMORY_ITEMS),
  }
}

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
