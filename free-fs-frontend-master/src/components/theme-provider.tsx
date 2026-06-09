/**
 * @file 主题 Provider
 * @description 管理 light/dark/system 主题，支持 View Transition API 切换动画。
 */
import { createContext, useContext, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'

type Theme = 'dark' | 'light' | 'system'

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme, animated?: boolean) => void
}

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

/**
 * 主题上下文 Provider，将 theme 类名同步到 documentElement。
 */
export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  )

  useEffect(() => {
    const root = window.document.documentElement

    root.classList.remove('light', 'dark')

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'dark'
        : 'light'

      root.classList.add(systemTheme)
      return
    }

    root.classList.add(theme)
  }, [theme])

  const value = {
    theme,
    setTheme: async (newTheme: Theme, animated: boolean = true) => {
      // 如果不需要动画或浏览器不支持 View Transition API，直接切换
      if (!animated || !document.startViewTransition) {
        localStorage.setItem(storageKey, newTheme)
        setTheme(newTheme)
        return
      }

      // 使用 View Transition API 实现动画
      const transition = document.startViewTransition(() => {
        flushSync(() => {
          localStorage.setItem(storageKey, newTheme)
          setTheme(newTheme)
        })
      })

      await transition.ready

      // 从屏幕中心开始动画
      const x = window.innerWidth / 2
      const y = window.innerHeight / 2
      const maxRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      )

      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${maxRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 400,
          easing: 'ease-in-out',
          pseudoElement: '::view-transition-new(root)',
        }
      )
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

/** 获取当前主题与 setTheme，须在 ThemeProvider 内使用 */
export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider')

  return context
}
