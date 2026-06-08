import { request } from '@/api/request'
import { getToken } from '@/utils/auth'
import { getRequestLangHeader } from '@/i18n'
import { getCurrentWorkspaceId } from '@/store/workspace'

export interface AiChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AiStreamMeta {
  deepThink: boolean
  agentMode: boolean
}

export interface AiStreamHandlers {
  onMeta?: (meta: AiStreamMeta) => void
  onDelta?: (text: string) => void
  onDone?: () => void
  onError?: (message: string) => void
}

export interface AiStatus {
  enabled: boolean
  model: string
}

function getStoragePlatformHeader(): string | null {
  const raw = localStorage.getItem('current-storage-platform')
  if (!raw) return null
  try {
    const platform = JSON.parse(raw) as { settingId?: string }
    return platform?.settingId ?? null
  } catch {
    return null
  }
}

function buildAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    lang: getRequestLangHeader(),
  }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const workspaceId = getCurrentWorkspaceId()
  if (workspaceId) headers['X-Workspace-Id'] = workspaceId
  const storageId = getStoragePlatformHeader()
  if (storageId) headers['X-Storage-Platform-Config-Id'] = storageId
  return headers
}

/** 开发环境走 Vite 代理（/apis → 8081），避免跨域导致 fetch 流式失败 */
export function resolveApiUrl(path: string): string {
  if (import.meta.env.DEV) {
    return path
  }
  const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
  return base ? `${base}${path}` : path
}

export async function fetchAiStatus(): Promise<AiStatus> {
  try {
    const data = await request.get<AiStatus>('/apis/ai/status', {
      showErrorMessage: false,
    } as { showErrorMessage?: boolean })
    return {
      enabled: Boolean(data?.enabled),
      model: String(data?.model ?? ''),
    }
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status
    // 接口未部署时勿误判为未配置，仍允许用户尝试对话
    if (status === 404) {
      return { enabled: true, model: '' }
    }
    return { enabled: false, model: '' }
  }
}

async function parseHttpError(res: Response): Promise<string> {
  try {
    const text = await res.text()
    const json = JSON.parse(text) as { msg?: string; message?: string }
    if (json.msg) return json.msg
    if (json.message) return json.message
  } catch {
    /* ignore */
  }
  return `HTTP ${res.status}`
}

/**
 * POST /apis/ai/chat，SSE 流式（event: meta | delta | done | error）
 */
export async function streamAiChat(
  payload: {
    message: string
    deepThink: boolean
    agentMode?: boolean
    context?: string
    history?: AiChatMessage[]
    memory?: string[]
  },
  handlers: AiStreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  let settled = false
  const finish = (fn: () => void) => {
    if (settled) return
    settled = true
    fn()
  }

  let res: Response
  try {
    res = await fetch(resolveApiUrl('/apis/ai/chat'), {
      method: 'POST',
      headers: buildAuthHeaders(),
      body: JSON.stringify({
        message: payload.message,
        deepThink: payload.deepThink,
        agentMode: payload.agentMode ?? false,
        context: payload.context ?? '',
        history: payload.history ?? [],
        memory: payload.memory ?? [],
      }),
      signal,
    })
  } catch (err) {
    if (signal?.aborted) return
    const msg =
      err instanceof TypeError
        ? '无法连接后端，请确认后端已启动并已重启加载 AI 配置'
        : err instanceof Error
          ? err.message
          : 'Network error'
    finish(() => handlers.onError?.(msg))
    return
  }

  if (!res.ok || !res.body) {
    const httpErr = await parseHttpError(res)
    finish(() => handlers.onError?.(httpErr))
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const processBlock = (block: string) => {
    const lines = block.split('\n')
    let eventName = 'message'
    let dataLine = ''
    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim()
      } else if (line.startsWith('data:')) {
        dataLine += line.slice(5).trim()
      }
    }
    if (!dataLine) return
    try {
      const data = JSON.parse(dataLine) as Record<string, unknown>
      if (eventName === 'meta') {
        handlers.onMeta?.({
          deepThink: Boolean(data.deepThink),
          agentMode: Boolean(data.agentMode),
        })
      } else if (eventName === 'delta' && typeof data.text === 'string') {
        handlers.onDelta?.(data.text)
      } else if (eventName === 'done') {
        finish(() => handlers.onDone?.())
      } else if (eventName === 'error') {
        finish(() => handlers.onError?.(String(data.message ?? 'AI error')))
      }
    } catch {
      /* ignore malformed chunk */
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() ?? ''
      for (const part of parts) {
        if (part.trim()) processBlock(part)
      }
    }
    if (buffer.trim()) processBlock(buffer)
    finish(() => handlers.onDone?.())
  } catch (err) {
    if (signal?.aborted) return
    finish(() =>
      handlers.onError?.(err instanceof Error ? err.message : 'Stream read failed')
    )
  }
}

/** 解析深度思考标签 */
export function parseDeepThinkContent(raw: string): {
  thinking: string
  answer: string
  inThinking: boolean
} {
  const thinkingMatch = raw.match(/<thinking>([\s\S]*?)(?:<\/thinking>|$)/i)
  const answerMatch = raw.match(/<answer>([\s\S]*?)(?:<\/answer>|$)/i)
  const inThinking =
    /<thinking>/i.test(raw) && !/<\/thinking>/i.test(raw) && !/<answer>/i.test(raw)
  return {
    thinking: thinkingMatch?.[1]?.trim() ?? '',
    answer: answerMatch?.[1]?.trim() ?? '',
    inThinking,
  }
}

/** 流式结束后整理展示内容（模型未按标签输出时回退为全文） */
export function finalizeDeepThinkContent(raw: string): {
  thinking: string
  answer: string
} {
  const parsed = parseDeepThinkContent(raw)
  let answer = parsed.answer
  const thinking = parsed.thinking
  if (!answer && raw.trim()) {
    answer = raw
      .replace(/<\/?thinking>/gi, '')
      .replace(/<\/?answer>/gi, '')
      .trim()
  }
  return { thinking, answer: answer || raw.trim() }
}

/** 解析 Agent 模式标签 */
export function parseAgentContent(raw: string): {
  plan: string
  answer: string
  inPlan: boolean
} {
  const planMatch = raw.match(/<plan>([\s\S]*?)(?:<\/plan>|$)/i)
  const answerMatch = raw.match(/<answer>([\s\S]*?)(?:<\/answer>|$)/i)
  const inPlan =
    /<plan>/i.test(raw) && !/<\/plan>/i.test(raw) && !/<answer>/i.test(raw)
  return {
    plan: planMatch?.[1]?.trim() ?? '',
    answer: answerMatch?.[1]?.trim() ?? '',
    inPlan,
  }
}

/** 模型未输出 plan/answer 标签时，按步骤列表启发式拆分 */
function splitAgentFallback(raw: string): { plan: string; answer: string } {
  const text = raw.trim()
  if (!text) return { plan: '', answer: '' }

  const sectionMatch = text.match(
    /^([\s\S]*?)\n(?:#{1,3}\s*)?(?:结论|总结|操作建议|回答|建议)[:：]?\s*\n([\s\S]+)$/im
  )
  if (sectionMatch?.[1]?.trim() && sectionMatch[2]?.trim()) {
    return { plan: sectionMatch[1].trim(), answer: sectionMatch[2].trim() }
  }

  const lines = text.split('\n')
  const isStepLine = (line: string) =>
    /^\s*(?:\d+[\.、)\]]\s|步骤\s*\d|[\*\\-]\s+\*\*步骤)/.test(line)

  let firstStep = lines.findIndex(isStepLine)
  if (firstStep < 0) return { plan: '', answer: text }

  let splitAt = lines.length
  for (let i = firstStep + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue
    if (isStepLine(line)) continue
    if (/^\s{2,}/.test(line)) continue
    splitAt = i
    break
  }

  if (splitAt < lines.length) {
    const plan = lines.slice(0, splitAt).join('\n').trim()
    const answer = lines.slice(splitAt).join('\n').trim()
    if (plan && answer) return { plan, answer }
  }

  const stepCount = lines.filter(isStepLine).length
  if (stepCount >= 2) {
    return {
      plan: text,
      answer: '请按上述步骤在 Free-FS 网盘界面中逐项执行；如有疑问可继续追问。',
    }
  }

  return { plan: '', answer: text }
}

export function finalizeAgentContent(raw: string): { plan: string; answer: string } {
  const parsed = parseAgentContent(raw)
  if (parsed.plan || parsed.answer) {
    let answer = parsed.answer
    const plan = parsed.plan
    if (!answer && raw.trim()) {
      answer = raw
        .replace(/<\/?plan>/gi, '')
        .replace(/<\/?answer>/gi, '')
        .trim()
    }
    return { plan, answer: answer || raw.trim() }
  }
  return splitAgentFallback(raw)
}

export type AiStreamParts = {
  thinking: string
  plan: string
  answer: string
  inProgress: boolean
}

export function parseStreamParts(
  raw: string,
  mode: { agentMode: boolean; deepThink: boolean }
): AiStreamParts {
  if (mode.agentMode) {
    const p = parseAgentContent(raw)
    return {
      thinking: '',
      plan: p.plan,
      answer: p.answer,
      inProgress: p.inPlan || (Boolean(p.plan) && !p.answer),
    }
  }
  if (mode.deepThink) {
    const p = parseDeepThinkContent(raw)
    return {
      thinking: p.thinking,
      plan: '',
      answer: p.answer || (!p.inThinking ? '' : ''),
      inProgress: p.inThinking || (Boolean(p.thinking) && !p.answer),
    }
  }
  return { thinking: '', plan: '', answer: raw, inProgress: false }
}

export function finalizeStreamParts(
  raw: string,
  mode: { agentMode: boolean; deepThink: boolean }
): { thinking: string; plan: string; answer: string } {
  if (mode.agentMode) {
    const { plan, answer } = finalizeAgentContent(raw)
    return { thinking: '', plan, answer }
  }
  if (mode.deepThink) {
    const { thinking, answer } = finalizeDeepThinkContent(raw)
    return { thinking, plan: '', answer }
  }
  return { thinking: '', plan: '', answer: raw.trim() }
}
