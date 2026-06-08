import * as React from 'react'

export function useSpeechSynthesis(lang = 'zh-CN') {
  const supported =
    typeof window !== 'undefined' && 'speechSynthesis' in window
  const [speaking, setSpeaking] = React.useState(false)
  const utteranceRef = React.useRef<SpeechSynthesisUtterance | null>(null)

  const cancel = React.useCallback(() => {
    if (!supported) return
    window.speechSynthesis.cancel()
    utteranceRef.current = null
    setSpeaking(false)
  }, [supported])

  const speak = React.useCallback(
    (text: string): Promise<void> => {
      if (!supported || !text.trim()) return Promise.resolve()

      cancel()

      return new Promise((resolve) => {
        const utterance = new SpeechSynthesisUtterance(text.trim())
        utterance.lang = lang
        utterance.rate = 1
        utterance.pitch = 1

        const voices = window.speechSynthesis.getVoices()
        const voice =
          voices.find((v) => v.lang.startsWith(lang.split('-')[0])) ??
          voices.find((v) => v.lang.includes('zh')) ??
          voices[0]
        if (voice) utterance.voice = voice

        utterance.onstart = () => setSpeaking(true)
        utterance.onend = () => {
          setSpeaking(false)
          utteranceRef.current = null
          resolve()
        }
        utterance.onerror = () => {
          setSpeaking(false)
          utteranceRef.current = null
          resolve()
        }

        utteranceRef.current = utterance
        window.speechSynthesis.speak(utterance)
      })
    },
    [cancel, lang, supported]
  )

  React.useEffect(() => {
    if (!supported) return
    const loadVoices = () => window.speechSynthesis.getVoices()
    loadVoices()
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
      cancel()
    }
  }, [cancel, supported])

  return { supported, speaking, speak, cancel }
}
