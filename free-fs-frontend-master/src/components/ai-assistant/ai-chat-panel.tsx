import * as React from 'react'
import {
  Bot,
  Brain,
  Copy,
  History,
  Loader2,
  MessageSquarePlus,
  Mic,
  MicOff,
  MicVocal,
  RotateCcw,
  Send,
  Square,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  type AiChatMessage,
  fetchAiStatus,
  finalizeStreamParts,
  parseStreamParts,
  streamAiChat,
} from '@/api/ai'
import { buildAgentContext } from './ai-agent-context'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { useSpeechRecognition } from '@/hooks/use-speech-recognition'
import { useSpeechSynthesis } from '@/hooks/use-speech-synthesis'
import {
  createNewSession,
  deleteSession,
  getActiveSession,
  loadAiStore,
  persistStore,
  switchSession,
  updateActiveSession,
  type AiChatSession,
  type AiWorkspaceStore,
  type StoredAiMessage,
} from './ai-chat-storage'

type UiMessage = StoredAiMessage & {
  streaming?: boolean
  failed?: boolean
}

const CHAT_PROMPT_KEYS = ['storage', 'share', 'upload'] as const
const AGENT_PROMPT_KEYS = ['analyze', 'cleanup', 'organize'] as const

function isFailedAssistant(m: UiMessage) {
  return m.role === 'assistant' && Boolean(m.failed)
}

function toHistory(messages: UiMessage[]): AiChatMessage[] {
  return messages
    .filter((m) => !m.streaming && !isFailedAssistant(m))
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-10)
    .map((m) => ({
      role: m.role,
      content: (m.answer || m.plan || m.content || m.thinking || '').trim(),
    }))
    .filter((m) => m.content.length > 0)
}

function formatSessionTime(ts: number) {
  const d = new Date(ts)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function AiChatPanel({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t, i18n } = useTranslation('ai')
  const speechLang = i18n.language?.startsWith('en') ? 'en-US' : 'zh-CN'
  const [store, setStore] = React.useState<AiWorkspaceStore>(() => loadAiStore())
  const activeSession = React.useMemo(() => getActiveSession(store), [store])

  const [messages, setMessages] = React.useState<UiMessage[]>(activeSession.messages)
  const [deepThink, setDeepThink] = React.useState(store.deepThink)
  const [agentMode, setAgentMode] = React.useState(store.agentMode)
  const [input, setInput] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [aiReady, setAiReady] = React.useState<boolean | null>(null)
  const [aiModel, setAiModel] = React.useState('')
  const [showHistory, setShowHistory] = React.useState(false)
  const [highlightId, setHighlightId] = React.useState<string | null>(null)
  const [loadingContext, setLoadingContext] = React.useState(false)
  const [voiceRealtime, setVoiceRealtime] = React.useState(false)
  const [voiceInterim, setVoiceInterim] = React.useState('')

  const abortRef = React.useRef<AbortController | null>(null)
  const bottomRef = React.useRef<HTMLDivElement>(null)
  const chatScrollRef = React.useRef<HTMLDivElement>(null)
  const messageRefs = React.useRef<Map<string, HTMLDivElement>>(new Map())
  const lastUserTextRef = React.useRef('')
  const loadingRef = React.useRef(false)
  const voiceRealtimeRef = React.useRef(false)
  const openRef = React.useRef(open)
  const inputBaseRef = React.useRef('')
  const runChatRef = React.useRef<(text: string) => Promise<void>>(async () => {})
  const aiReadyRef = React.useRef<boolean | null>(null)

  loadingRef.current = loading
  voiceRealtimeRef.current = voiceRealtime
  openRef.current = open
  aiReadyRef.current = aiReady

  const { supported: voiceSupported, listening, start: startListening, stop: stopListening } =
    useSpeechRecognition({
      lang: speechLang,
      continuous: !voiceRealtime,
      onInterim: (text) => {
        setVoiceInterim(text)
        if (!voiceRealtimeRef.current) {
          setInput(inputBaseRef.current ? `${inputBaseRef.current} ${text}`.trim() : text)
        }
      },
      onUtteranceEnd: (text) => {
        setVoiceInterim('')
        if (!text.trim()) return
        if (voiceRealtimeRef.current) {
          if (loadingRef.current || aiReadyRef.current === false) return
          void runChatRef.current(text)
          return
        }
        setInput((prev) => (prev ? `${prev} ${text}`.trim() : text))
        inputBaseRef.current = ''
      },
      onError: (code) => {
        setVoiceInterim('')
        if (code === 'unsupported') {
          toast.error(t('voiceUnsupported'))
          setVoiceRealtime(false)
          return
        }
        if (code === 'not-allowed') {
          toast.error(t('voiceDenied'))
          setVoiceRealtime(false)
          return
        }
        if (code !== 'no-speech' && code !== 'aborted') {
          toast.error(t('voiceError', { message: code }))
        }
      },
    })

  const { supported: ttsSupported, speaking, speak, cancel: cancelSpeak } =
    useSpeechSynthesis(speechLang)

  const userQuestions = React.useMemo(
    () => messages.filter((m) => m.role === 'user' && m.content.trim()),
    [messages]
  )

  React.useEffect(() => {
    if (!open) {
      setVoiceRealtime(false)
      stopListening()
      cancelSpeak()
      setVoiceInterim('')
      return
    }
  }, [open, stopListening, cancelSpeak])

  React.useEffect(() => {
    if (!voiceRealtime || !open || !voiceSupported) return
    if (loading || speaking || aiReady === false) {
      stopListening()
      return
    }
    startListening()
  }, [voiceRealtime, open, voiceSupported, loading, speaking, aiReady, startListening, stopListening])

  const resumeVoiceAfterReply = React.useCallback(
    async (answerText: string) => {
      if (!voiceRealtimeRef.current || !openRef.current) return
      const text = answerText.trim()
      if (text && ttsSupported) {
        await speak(text)
      }
      if (voiceRealtimeRef.current && openRef.current && !loadingRef.current) {
        startListening()
      }
    },
    [speak, startListening, ttsSupported]
  )

  React.useEffect(() => {
    if (!open) return
    const s = loadAiStore()
    setStore(s)
    const session = getActiveSession(s)
    setMessages(session.messages)
    setDeepThink(s.deepThink)
    setAgentMode(s.agentMode)
  }, [open])

  React.useEffect(() => {
    if (!open) return
    void fetchAiStatus().then((s) => {
      setAiReady(s.enabled)
      setAiModel(s.model)
    })
  }, [open])

  React.useEffect(() => {
    if (!open || loading) return
    const timer = window.setTimeout(() => {
      setStore((prev) => {
        const updated = updateActiveSession(
          prev,
          messages.filter((m) => !m.streaming),
          deepThink,
          agentMode
        )
        persistStore(updated)
        return updated
      })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [messages, deepThink, agentMode, open, loading])

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const scrollToMessage = (id: string) => {
    setShowHistory(false)
    requestAnimationFrame(() => {
      messageRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlightId(id)
      window.setTimeout(() => setHighlightId(null), 2200)
    })
  }

  const applySession = (session: AiChatSession) => {
    if (loading) stop()
    setMessages(session.messages)
  }

  const handleNewChat = () => {
    if (loading) stop()
    const next = createNewSession(store)
    persistStore(next)
    setStore(next)
    setMessages([])
    setShowHistory(false)
  }

  const handleSwitchSession = (sessionId: string) => {
    const next = switchSession(store, sessionId)
    if (!next) return
    persistStore(next)
    setStore(next)
    applySession(getActiveSession(next))
  }

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const next = deleteSession(store, sessionId)
    persistStore(next)
    setStore(next)
    applySession(getActiveSession(next))
  }

  const stop = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setLoading(false)
    setMessages((prev) =>
      prev.map((m) => {
        if (!m.streaming) return m
        const parts = finalizeStreamParts(m.content, { agentMode, deepThink })
        return {
          ...m,
          streaming: false,
          thinking: parts.thinking || m.thinking,
          plan: parts.plan || m.plan,
          answer: parts.answer || m.answer || t('stopped'),
          content: m.content,
        }
      })
    )
  }

  const clearCurrent = () => {
    if (loading) stop()
    setMessages([])
  }

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(t('copied'))
    } catch {
      toast.error(t('error', { message: 'copy failed' }))
    }
  }

  const runChat = async (text: string, options?: { replaceLastPair?: boolean }) => {
    if (!text || loading || aiReady === false) return

    lastUserTextRef.current = text

    const userMsg: UiMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
    }
    const assistantId = crypto.randomUUID()

    setMessages((prev) => {
      const base = options?.replaceLastPair
        ? prev.filter((_, i, arr) => i < arr.length - 2)
        : prev
      return [
        ...base,
        userMsg,
        { id: assistantId, role: 'assistant', content: '', streaming: true },
      ]
    })
    setInput('')
    setLoading(true)
    if (voiceRealtimeRef.current) stopListening()

    const history = toHistory(
      options?.replaceLastPair
        ? messages.filter((_, i, arr) => i < arr.length - 2)
        : messages
    )

    const controller = new AbortController()
    abortRef.current = controller
    let acc = ''

    const patchAssistant = (patch: Partial<UiMessage>) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, ...patch } : m))
      )
    }

    let context = ''
    if (agentMode) {
      setLoadingContext(true)
      try {
        const ctx = await buildAgentContext()
        context = ctx.text
        if (!ctx.loaded) {
          toast.info(t('contextEmpty'))
        }
      } finally {
        setLoadingContext(false)
      }
    }

    try {
      await streamAiChat(
        {
          message: text,
          deepThink: agentMode ? false : deepThink,
          agentMode,
          context,
          history,
          memory: loadAiStore().memory,
        },
        {
          onDelta: (chunk) => {
            acc += chunk
            const parsed = parseStreamParts(acc, { agentMode, deepThink })
            patchAssistant({
              content: acc,
              thinking: parsed.thinking,
              plan: parsed.plan,
              answer: parsed.answer || (!agentMode && !deepThink ? acc : ''),
              streaming: true,
              failed: false,
            })
          },
          onError: (message) => {
            const errText = t('error', { message })
            patchAssistant({
              content: errText,
              answer: errText,
              streaming: false,
              failed: true,
            })
            setLoading(false)
            abortRef.current = null
            if (voiceRealtimeRef.current) startListening()
          },
          onDone: () => {
            const parts = finalizeStreamParts(acc, { agentMode, deepThink })
            const answer = parts.answer || acc || t('stopped')
            patchAssistant({
              content: acc,
              thinking: parts.thinking,
              plan: parts.plan,
              answer,
              streaming: false,
              failed: false,
            })
            setLoading(false)
            abortRef.current = null
            void resumeVoiceAfterReply(answer)
          },
        },
        controller.signal
      )
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      const errText = t('error', {
        message: (err as Error).message || 'Network error',
      })
      patchAssistant({
        content: errText,
        answer: errText,
        streaming: false,
        failed: true,
      })
      setLoading(false)
      abortRef.current = null
    }
  }

  const send = () => void runChat(input.trim())

  runChatRef.current = runChat

  const toggleVoiceInput = () => {
    if (!voiceSupported) {
      toast.error(t('voiceUnsupported'))
      return
    }
    if (listening) {
      stopListening()
      return
    }
    if (voiceRealtime) setVoiceRealtime(false)
    inputBaseRef.current = input.trim()
    startListening()
  }

  const toggleVoiceRealtime = () => {
    if (!voiceSupported) {
      toast.error(t('voiceUnsupported'))
      return
    }
    if (voiceRealtime) {
      setVoiceRealtime(false)
      stopListening()
      cancelSpeak()
      return
    }
    if (loading) stop()
    stopListening()
    cancelSpeak()
    setVoiceInterim('')
    setVoiceRealtime(true)
  }

  const toggleSpeakLast = async () => {
    if (speaking) {
      cancelSpeak()
      return
    }
    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === 'assistant' && (m.answer || m.content))
    const text = lastAssistant?.answer || lastAssistant?.content
    if (text) await speak(text)
  }

  const retryLast = () => {
    const text =
      lastUserTextRef.current ||
      [...messages].reverse().find((m) => m.role === 'user')?.content
    if (text) void runChat(text, { replaceLastPair: true })
  }

  const lastFailed =
    messages.length > 0 && isFailedAssistant(messages[messages.length - 1])

  const renderMessages = () => (
    <>
      {messages.length === 0 ? (
        <div className='space-y-3'>
          <p className='text-muted-foreground text-sm'>
            {agentMode ? t('agentEmpty') : t('empty')}
          </p>
          <div className='flex flex-wrap gap-2'>
            {(agentMode ? AGENT_PROMPT_KEYS : CHAT_PROMPT_KEYS).map((key) => {
              const ns = agentMode ? 'agentPrompts' : 'prompts'
              return (
                <Button
                  key={key}
                  type='button'
                  variant='outline'
                  size='sm'
                  className='h-auto whitespace-normal py-1.5 text-left text-xs font-normal'
                  disabled={loading || loadingContext || aiReady === false}
                  onClick={() => void runChat(t(`${ns}.${key}`))}
                >
                  {t(`${ns}.${key}`)}
                </Button>
              )
            })}
          </div>
        </div>
      ) : (
        messages.map((m) => (
          <div
            key={m.id}
            ref={(el) => {
              if (el) messageRefs.current.set(m.id, el)
              else messageRefs.current.delete(m.id)
            }}
            className={cn(
              'group relative scroll-mt-4 rounded-lg px-3 py-2 text-sm transition-colors',
              m.role === 'user'
                ? 'bg-primary/10 text-foreground ml-4'
                : 'bg-muted/60 mr-1',
              m.failed && 'border border-destructive/30',
              highlightId === m.id && 'ring-2 ring-primary/50 ring-offset-2'
            )}
          >
            {m.role === 'user' && (
              <Button
                type='button'
                variant='ghost'
                size='sm'
                className='text-muted-foreground absolute -left-1 top-1 h-6 px-1 text-[10px] opacity-0 group-hover:opacity-100'
                title={t('jumpTo')}
                onClick={() => scrollToMessage(m.id)}
              >
                #
              </Button>
            )}
            {m.role === 'assistant' && (m.answer || m.content) && !m.streaming && (
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='absolute right-1 top-1 size-7 opacity-0 group-hover:opacity-100'
                aria-label={t('copy')}
                onClick={() => void copyText(m.answer || m.content)}
              >
                <Copy className='size-3.5' />
              </Button>
            )}
            {m.role === 'user' ? (
              <p className='whitespace-pre-wrap pl-4'>{m.content}</p>
            ) : (
              <>
                {(m.plan ||
                  (m.streaming && agentMode && !m.answer && !m.thinking)) && (
                  <div className='mb-3 rounded-md border border-violet-500/30 bg-violet-500/5 p-2 pr-8'>
                    <p className='mb-1 flex items-center gap-1 text-xs font-medium text-violet-700 dark:text-violet-300'>
                      {m.streaming && !m.answer && !m.plan ? (
                        <>
                          <Loader2 className='size-3 animate-spin' />
                          {t('planning')}
                        </>
                      ) : (
                        t('planDone')
                      )}
                    </p>
                    <p className='text-muted-foreground whitespace-pre-wrap text-xs leading-relaxed'>
                      {m.plan || '…'}
                    </p>
                  </div>
                )}
                {(m.thinking ||
                  (!m.plan &&
                    m.streaming &&
                    !agentMode &&
                    deepThink &&
                    !m.answer)) && (
                  <div className='mb-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 pr-8'>
                    <p className='mb-1 flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300'>
                      {m.streaming && !m.answer && !m.thinking ? (
                          <>
                            <Loader2 className='size-3 animate-spin' />
                            {t('thinking')}
                          </>
                        ) : (
                          t('thinkingDone')
                        )}
                      </p>
                      <p className='text-muted-foreground whitespace-pre-wrap text-xs leading-relaxed'>
                        {m.thinking || '…'}
                      </p>
                    </div>
                  )}
                {(m.answer ||
                  (!m.plan && !m.thinking && m.content) ||
                  m.failed) && (
                  <div className='pr-6'>
                    {(m.plan || m.thinking) && !m.failed && (
                      <p className='mb-1 text-xs font-medium text-foreground/80'>
                        {t('answer')}
                      </p>
                    )}
                    <p
                      className={cn(
                        'whitespace-pre-wrap',
                        m.failed && 'text-destructive text-xs'
                      )}
                    >
                      {m.answer || m.content}
                    </p>
                  </div>
                )}
                {m.streaming && !m.content && !m.thinking && !m.plan && (
                  <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                    <Loader2 className='size-4 animate-spin' />
                    {agentMode ? t('planning') : t('thinking')}
                  </div>
                )}
              </>
            )}
          </div>
        ))
      )}
      <div ref={bottomRef} />
    </>
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side='right'
        className={cn(
          'flex w-full flex-col gap-0 border-l border-border/60 p-0',
          showHistory ? 'sm:max-w-2xl' : 'sm:max-w-md'
        )}
      >
        <SheetHeader className='space-y-0 border-b px-4 pb-3 pt-4 pr-12'>
          <div className='flex items-center justify-between gap-3'>
            <SheetTitle className='text-base leading-tight'>{t('title')}</SheetTitle>
            <Button
              type='button'
              variant={showHistory ? 'secondary' : 'outline'}
              size='icon'
              className='size-8 shrink-0'
              title={t('history')}
              aria-label={t('history')}
              onClick={() => setShowHistory((v) => !v)}
            >
              <History className='size-4' />
            </Button>
          </div>
          <div className='mt-2 flex flex-wrap items-center gap-2'>
            <div className='bg-muted/50 inline-flex rounded-lg border p-0.5'>
              <button
                type='button'
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs transition-colors',
                  !agentMode && 'bg-background shadow-sm'
                )}
                disabled={loading || loadingContext}
                onClick={() => setAgentMode(false)}
              >
                {t('modeChat')}
              </button>
              <button
                type='button'
                className={cn(
                  'flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors',
                  agentMode && 'bg-background shadow-sm'
                )}
                disabled={loading || loadingContext}
                onClick={() => setAgentMode(true)}
              >
                <Bot className='size-3.5' />
                {t('modeAgent')}
              </button>
            </div>
            <Button type='button' variant='outline' size='sm' className='h-7' onClick={handleNewChat}>
              <MessageSquarePlus className='mr-1 size-3' />
              {t('newChat')}
            </Button>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className='text-muted-foreground h-7'
              disabled={messages.length === 0 && !loading}
              onClick={clearCurrent}
            >
              <Trash2 className='mr-1 size-3' />
              {t('clearChat')}
            </Button>
          </div>
          {agentMode ? (
            <p className='text-muted-foreground mt-2 text-xs leading-snug'>{t('agentHint')}</p>
          ) : null}
          <SheetDescription className='sr-only'>{t('title')}</SheetDescription>
          {aiReady === false && (
            <p className='mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-800 dark:text-amber-200'>
              {t('notConfigured')}
            </p>
          )}
          {aiReady && aiModel ? (
            <p className='text-muted-foreground mt-1 text-xs'>{t('model', { model: aiModel })}</p>
          ) : null}
          {!agentMode ? (
            <div className='mt-3 flex flex-col gap-2'>
              <div className='flex items-center justify-between gap-2'>
                <div className='flex items-center gap-2'>
                  <Checkbox
                    id='deep-think'
                    checked={deepThink}
                    disabled={loading || voiceRealtime}
                    onCheckedChange={(v) => setDeepThink(v === true)}
                  />
                  <Label
                    htmlFor='deep-think'
                    className='flex items-center gap-1 text-sm font-normal'
                  >
                    <Brain className='size-4' />
                    {t('deepThink')}
                  </Label>
                </div>
                <span className='text-muted-foreground max-w-[55%] text-right text-xs leading-snug'>
                  {t('deepThinkHint')}
                </span>
              </div>
              {voiceSupported ? (
                <div className='flex items-center justify-between gap-2'>
                  <button
                    type='button'
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors',
                      voiceRealtime
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'hover:bg-muted/60'
                    )}
                    disabled={loading || aiReady === false}
                    onClick={toggleVoiceRealtime}
                  >
                    <MicVocal className='size-3.5' />
                    {voiceRealtime ? t('voiceRealtimeActive') : t('voiceRealtime')}
                  </button>
                  <span className='text-muted-foreground max-w-[55%] text-right text-xs leading-snug'>
                    {t('voiceRealtimeHint')}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}
        </SheetHeader>

        <div className='flex min-h-0 flex-1'>
          {showHistory && (
            <aside className='flex w-44 shrink-0 flex-col border-r bg-muted/20 sm:w-52'>
              <div className='border-b px-2 py-2'>
                <p className='text-xs font-medium'>{t('sessionList')}</p>
              </div>
              <ScrollArea className='max-h-[38%] flex-1'>
                <div className='space-y-0.5 p-1'>
                  {store.sessions.length === 0 ? (
                    <p className='text-muted-foreground px-2 py-3 text-xs'>{t('noSessions')}</p>
                  ) : (
                    store.sessions.map((s) => (
                      <button
                        key={s.id}
                        type='button'
                        className={cn(
                          'hover:bg-muted/80 group flex w-full items-start gap-1 rounded-md px-2 py-1.5 text-left text-xs',
                          s.id === store.activeSessionId && 'bg-muted'
                        )}
                        onClick={() => handleSwitchSession(s.id)}
                      >
                        <span className='min-w-0 flex-1'>
                          <span className='line-clamp-2 font-medium leading-snug'>{s.title}</span>
                          <span className='text-muted-foreground block text-[10px]'>
                            {formatSessionTime(s.updatedAt)}
                          </span>
                        </span>
                        {store.sessions.length > 1 && (
                          <span
                            role='button'
                            tabIndex={0}
                            className='text-muted-foreground hover:text-destructive shrink-0 opacity-0 group-hover:opacity-100'
                            onClick={(e) => handleDeleteSession(s.id, e)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleDeleteSession(s.id, e as unknown as React.MouseEvent)
                            }}
                          >
                            <X className='size-3' />
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
              <div className='border-t px-2 py-2'>
                <p className='text-xs font-medium'>{t('questionNav')}</p>
              </div>
              <ScrollArea className='flex-1'>
                <div className='space-y-0.5 p-1'>
                  {userQuestions.length === 0 ? (
                    <p className='text-muted-foreground px-2 py-2 text-[10px]'>{t('noQuestions')}</p>
                  ) : (
                    userQuestions.map((q, i) => (
                      <button
                        key={q.id}
                        type='button'
                        className='hover:bg-muted/80 w-full rounded-md px-2 py-1.5 text-left text-[10px] leading-snug'
                        onClick={() => scrollToMessage(q.id)}
                      >
                        <span className='text-muted-foreground mr-1'>{i + 1}.</span>
                        <span className='line-clamp-2'>{q.content}</span>
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </aside>
          )}

          <div className='flex min-h-0 min-w-0 flex-1 flex-col px-4'>
            <div ref={chatScrollRef} className='flex-1 space-y-3 overflow-y-auto py-4'>
              {renderMessages()}
            </div>
            <div className='border-t py-3'>
              {loadingContext && (
                <p className='text-muted-foreground mb-2 flex items-center gap-1.5 text-xs'>
                  <Loader2 className='size-3 animate-spin' />
                  {t('loadingContext')}
                </p>
              )}
              {lastFailed && !loading && (
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  className='mb-2 w-full'
                  onClick={retryLast}
                >
                  <RotateCcw className='mr-1 size-3.5' />
                  {t('retry')}
                </Button>
              )}
              {(listening || voiceInterim || speaking) && (
                <p
                  className={cn(
                    'mb-2 flex items-center gap-1.5 text-xs',
                    listening ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                  )}
                >
                  {listening ? (
                    <span className='relative flex size-2'>
                      <span className='absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75' />
                      <span className='relative inline-flex size-2 rounded-full bg-emerald-500' />
                    </span>
                  ) : (
                    <Loader2 className='size-3 animate-spin' />
                  )}
                  {speaking
                    ? t('voiceSpeak')
                    : voiceRealtime
                      ? t('voiceRealtimeActive')
                      : t('voiceListening')}
                  {voiceInterim ? `：${voiceInterim}` : null}
                </p>
              )}
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={voiceRealtime ? t('voiceRealtimeActive') : t('placeholder')}
                rows={3}
                className='resize-none'
                disabled={loading || loadingContext || aiReady === false || voiceRealtime}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send()
                  }
                }}
              />
              <div className='mt-2 flex items-center justify-between gap-2'>
                <div className='flex gap-1'>
                  {voiceSupported ? (
                    <Button
                      type='button'
                      variant={listening ? 'destructive' : 'outline'}
                      size='sm'
                      disabled={loading || loadingContext || aiReady === false || voiceRealtime}
                      title={listening ? t('voiceInputStop') : t('voiceInput')}
                      onClick={toggleVoiceInput}
                    >
                      {listening ? (
                        <MicOff className='size-4' />
                      ) : (
                        <Mic className='size-4' />
                      )}
                    </Button>
                  ) : null}
                  {ttsSupported ? (
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      disabled={loading || messages.every((m) => m.role !== 'assistant')}
                      title={speaking ? t('voiceSpeakStop') : t('voiceSpeak')}
                      onClick={() => void toggleSpeakLast()}
                    >
                      {speaking ? (
                        <VolumeX className='size-4' />
                      ) : (
                        <Volume2 className='size-4' />
                      )}
                    </Button>
                  ) : null}
                </div>
                <div className='flex gap-2'>
                {loading ? (
                  <Button type='button' variant='outline' size='sm' onClick={stop}>
                    <Square className='mr-1 size-3' />
                    {t('stop')}
                  </Button>
                ) : null}
                <Button
                  type='button'
                  size='sm'
                  disabled={
                    loading ||
                    loadingContext ||
                    (!voiceRealtime && !input.trim()) ||
                    aiReady === false
                  }
                  onClick={send}
                >
                  {loading ? (
                    <Loader2 className='mr-1 size-4 animate-spin' />
                  ) : (
                    <Send className='mr-1 size-4' />
                  )}
                  {t('send')}
                </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
