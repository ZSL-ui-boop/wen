/**
 * 浏览器语音识别 Hook
 *
 * 封装 SpeechRecognition / webkitSpeechRecognition，
 * 支持 interim 实时预览、utterance 结束回调及 continuous 模式下自动重连。
 */
import * as React from 'react'

type SpeechRecognitionInstance = SpeechRecognition

/**
 * 获取浏览器 SpeechRecognition 构造函数
 * Chrome 等使用 webkit 前缀
 */
function getSpeechRecognitionCtor():
  | (new () => SpeechRecognitionInstance)
  | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionInstance
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

/** useSpeechRecognition 的配置项 */
export type UseSpeechRecognitionOptions = {
  /** 识别语言，默认 zh-CN */
  lang?: string
  /** 是否连续识别（onend 后自动 restart） */
  continuous?: boolean
  /** 识别过程中的 interim + final 合并预览 */
  onInterim?: (text: string) => void
  /** 一段语音识别结束（含停顿结束）时触发 */
  onUtteranceEnd?: (text: string) => void
  /** listening 状态变化回调 */
  onListeningChange?: (listening: boolean) => void
  /** 错误回调（aborted / no-speech 不触发） */
  onError?: (code: string) => void
}

/**
 * 语音识别 Hook
 *
 * @param options 语言、连续模式及各类事件回调
 * @returns supported / listening / start / stop
 */
export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
  const {
    lang = 'zh-CN',
    continuous = false,
    onInterim,
    onUtteranceEnd,
    onListeningChange,
    onError,
  } = options

  const supported = React.useMemo(() => Boolean(getSpeechRecognitionCtor()), [])
  const [listening, setListening] = React.useState(false)
  const recognitionRef = React.useRef<SpeechRecognitionInstance | null>(null)
  /** 用户意图：为 true 时 onend 后会自动 restart（continuous 场景） */
  const wantListeningRef = React.useRef(false)
  /** 已确认的 final 文本累积 */
  const finalBufferRef = React.useRef('')
  /** 当前 interim 片段 */
  const interimRef = React.useRef('')

  // 回调放入 ref，避免 recognition 事件闭包过期
  const callbacksRef = React.useRef({
    onInterim,
    onUtteranceEnd,
    onListeningChange,
    onError,
  })
  callbacksRef.current = {
    onInterim,
    onUtteranceEnd,
    onListeningChange,
    onError,
  }

  const setListeningState = React.useCallback((value: boolean) => {
    setListening(value)
    callbacksRef.current.onListeningChange?.(value)
  }, [])

  /** 停止识别并清除「希望继续监听」标志 */
  const stop = React.useCallback(() => {
    wantListeningRef.current = false
    recognitionRef.current?.stop()
    setListeningState(false)
  }, [setListeningState])

  /** 创建 Recognition 实例并绑定事件（可被 onend 内 restart 复用） */
  const startInternal = React.useCallback(() => {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      callbacksRef.current.onError?.('unsupported')
      return
    }

    finalBufferRef.current = ''
    interimRef.current = ''

    const recognition = new Ctor()
    recognition.lang = lang
    recognition.continuous = continuous
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => setListeningState(true)

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = result[0]?.transcript?.trim() ?? ''
        if (!text) continue
        if (result.isFinal) {
          // final 结果追加到缓冲区
          finalBufferRef.current = finalBufferRef.current
            ? `${finalBufferRef.current} ${text}`.trim()
            : text
          interimRef.current = ''
        } else {
          interim = interim ? `${interim} ${text}` : text
          interimRef.current = interim
        }
      }

      const preview = [finalBufferRef.current, interimRef.current]
        .filter(Boolean)
        .join(' ')
        .trim()
      if (preview) callbacksRef.current.onInterim?.(preview)
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // 用户主动停止或无语音输入时不视为错误
      if (event.error === 'aborted' || event.error === 'no-speech') return
      callbacksRef.current.onError?.(event.error)
      wantListeningRef.current = false
      setListeningState(false)
    }

    recognition.onend = () => {
      setListeningState(false)
      recognitionRef.current = null

      const text = [finalBufferRef.current, interimRef.current]
        .filter(Boolean)
        .join(' ')
        .trim()
      finalBufferRef.current = ''
      interimRef.current = ''

      if (text) {
        callbacksRef.current.onUtteranceEnd?.(text)
      }

      // continuous 且用户未 stop：短延迟后自动重启
      if (wantListeningRef.current) {
        window.setTimeout(() => {
          if (wantListeningRef.current) startInternal()
        }, 200)
      }
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch {
      wantListeningRef.current = false
      setListeningState(false)
      callbacksRef.current.onError?.('start-failed')
    }
  }, [continuous, lang, setListeningState])

  /** 开始识别（已在 listening 时忽略） */
  const start = React.useCallback(() => {
    if (listening) return
    wantListeningRef.current = true
    startInternal()
  }, [listening, startInternal])

  // 组件卸载时停止识别
  React.useEffect(() => () => stop(), [stop])

  return { supported, listening, start, stop }
}
