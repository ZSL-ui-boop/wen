/**
 * 浏览器语音合成（TTS）Hook
 *
 * 封装 Web Speech API 的 speechSynthesis，提供 speak / cancel 及 speaking 状态，
 * 自动选择合适的中文语音并在卸载时停止播放。
 */
import * as React from 'react'

/**
 * 语音朗读 Hook
 *
 * @param lang 朗读语言，默认 zh-CN
 * @returns supported 是否支持 TTS；speaking 是否正在朗读；speak / cancel 控制方法
 */
export function useSpeechSynthesis(lang = 'zh-CN') {
  const supported =
    typeof window !== 'undefined' && 'speechSynthesis' in window
  const [speaking, setSpeaking] = React.useState(false)
  const utteranceRef = React.useRef<SpeechSynthesisUtterance | null>(null)

  /** 停止当前朗读并清空 utterance 引用 */
  const cancel = React.useCallback(() => {
    if (!supported) return
    window.speechSynthesis.cancel()
    utteranceRef.current = null
    setSpeaking(false)
  }, [supported])

  /**
   * 朗读指定文本；会先 cancel 上一次，朗读结束或出错时 resolve
   *
   * @param text 待朗读文本
   */
  const speak = React.useCallback(
    (text: string): Promise<void> => {
      if (!supported || !text.trim()) return Promise.resolve()

      cancel()

      return new Promise((resolve) => {
        const utterance = new SpeechSynthesisUtterance(text.trim())
        utterance.lang = lang
        utterance.rate = 1
        utterance.pitch = 1

        // 优先匹配 lang 前缀，其次任意中文语音，最后系统默认
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
    // 预加载语音列表；部分浏览器需 voiceschanged 后才可用
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
