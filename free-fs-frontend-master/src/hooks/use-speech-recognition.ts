import * as React from 'react'

type SpeechRecognitionInstance = SpeechRecognition

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

export type UseSpeechRecognitionOptions = {
  lang?: string
  continuous?: boolean
  onInterim?: (text: string) => void
  /** 一段语音识别结束（含停顿结束）时触发 */
  onUtteranceEnd?: (text: string) => void
  onListeningChange?: (listening: boolean) => void
  onError?: (code: string) => void
}

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
  const wantListeningRef = React.useRef(false)
  const finalBufferRef = React.useRef('')
  const interimRef = React.useRef('')

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

  const stop = React.useCallback(() => {
    wantListeningRef.current = false
    recognitionRef.current?.stop()
    setListeningState(false)
  }, [setListeningState])

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

  const start = React.useCallback(() => {
    if (listening) return
    wantListeningRef.current = true
    startInternal()
  }, [listening, startInternal])

  React.useEffect(() => () => stop(), [stop])

  return { supported, listening, start, stop }
}
