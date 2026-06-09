/**
 * AI 对话 API 模块
 *
 * 提供 AI 服务状态查询、SSE 流式对话及深度思考/Agent 模式内容解析工具。
 * 流式对话使用原生 fetch（非 axios），以支持 ReadableStream。
 */
import { request } from '@/api/request'
import { getToken } from '@/utils/auth'
import { getRequestLangHeader } from '@/i18n'
import { getCurrentWorkspaceId } from '@/store/workspace'

/** AI 对话消息结构 */
export interface AiChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

/** SSE meta 事件携带的模式信息 */
export interface AiStreamMeta {
  deepThink: boolean
  agentMode: boolean
}

/** 流式对话回调处理器 */
export interface AiStreamHandlers {
  /** 收到 meta 事件时触发 */
  onMeta?: (meta: AiStreamMeta) => void
  /** 收到增量文本时触发 */
  onDelta?: (text: string) => void
  /** 流式结束时触发 */
  onDone?: () => void
  /** 发生错误时触发 */
  onError?: (message: string) => void
}

/** AI 服务可用状态 */
export interface AiStatus {
  enabled: boolean
  model: string
}

/**
 * 从 localStorage 读取当前存储平台配置 ID
 * @returns settingId 或 null
 */
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

/**
 * 构建 AI 流式请求所需的认证与作用域请求头
 * 与 axios 拦截器逻辑保持一致
 */
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

/**
 * 解析 API 完整 URL
 * 开发环境走 Vite 代理（/apis → 8081），避免跨域导致 fetch 流式失败
 * @param path 接口路径（如 /apis/ai/chat）
 * @returns 可直接 fetch 的 URL
 */
export function resolveApiUrl(path: string): string {
  if (import.meta.env.DEV) {
    return path
  }
  const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
  return base ? `${base}${path}` : path
}

/**
 * 查询 AI 服务是否可用及当前模型名称
 * 404 时视为已启用（接口未部署），避免误判为未配置
 * @returns AI 服务状态
 */
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

/**
 * 解析 HTTP 错误响应体，提取可读错误信息
 * @param res fetch Response 对象
 * @returns 错误描述字符串
 */
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
 * 发起 AI 流式对话（SSE）
 * POST /apis/ai/chat，事件类型：meta | delta | done | error
 * @param payload 消息内容、模式开关、上下文与历史
 * @param handlers 流式事件回调
 * @param signal AbortSignal，用于取消请求
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
  // 确保 onDone/onError 只触发一次
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

  /** 解析单个 SSE 事件块（event + data 行） */
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
      /* 忽略格式错误的 chunk */
    }
  }

  try {
    // 按 \n\n 分割 SSE 事件块，保留未完整的尾部到 buffer
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

/**
 * 解析深度思考模式的 XML 标签内容
 * 模型输出格式：<thinking>...</thinking><answer>...</answer>
 * @param raw 原始流式文本
 * @returns 思考内容、回答内容及是否仍在思考中
 */
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

/**
 * 流式结束后整理深度思考展示内容
 * 模型未按标签输出时回退为全文
 * @param raw 完整原始文本
 * @returns 最终思考与回答内容
 */
export function finalizeDeepThinkContent(raw: string): {
  thinking: string
  answer: string
} {
  const parsed = parseDeepThinkContent(raw)
  let answer = parsed.answer
  const thinking = parsed.thinking
  if (!answer && raw.trim()) {
    // 无 answer 标签时，剥离 thinking 标签后剩余作为回答
    answer = raw
      .replace(/<\/?thinking>/gi, '')
      .replace(/<\/?answer>/gi, '')
      .trim()
  }
  return { thinking, answer: answer || raw.trim() }
}

/**
 * 解析 Agent 模式的 XML 标签内容
 * 模型输出格式：<plan>...</plan><answer>...</answer>
 * @param raw 原始流式文本
 * @returns 计划内容、回答内容及是否仍在规划中
 */
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

/**
 * Agent 模式启发式回退拆分
 * 模型未输出 plan/answer 标签时，按步骤列表与结论段落拆分
 * @param raw 原始文本
 * @returns 计划与回答两部分
 */
function splitAgentFallback(raw: string): { plan: string; answer: string } {
  const text = raw.trim()
  if (!text) return { plan: '', answer: '' }

  // 优先按「结论/总结/回答」等标题分段
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

  // 从第一个非步骤行起视为回答部分
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

/**
 * 流式结束后整理 Agent 模式展示内容
 * @param raw 完整原始文本
 * @returns 最终计划与回答内容
 */
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

/** 流式解析结果（含进行中状态） */
export type AiStreamParts = {
  thinking: string
  plan: string
  answer: string
  inProgress: boolean
}

/**
 * 根据当前模式解析流式文本为展示片段
 * @param raw 当前累积的流式文本
 * @param mode agentMode / deepThink 开关
 * @returns 思考/计划/回答片段及是否仍在生成中
 */
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
  // 普通模式：全文即回答
  return { thinking: '', plan: '', answer: raw, inProgress: false }
}

/**
 * 流式结束后根据模式整理最终展示内容
 * @param raw 完整原始文本
 * @param mode agentMode / deepThink 开关
 * @returns 最终思考、计划、回答三部分
 */
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
