/**
 * 全局搜索（命令面板）上下文
 *
 * 提供 Cmd/Ctrl+K 快捷键打开 CommandMenu，并在 Provider 内挂载命令菜单组件。
 */
import { createContext, useContext, useEffect, useState } from 'react'
import { CommandMenu } from '@/components/command-menu'

type SearchContextType = {
  /** 命令面板是否打开 */
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
}

const SearchContext = createContext<SearchContextType | null>(null)

type SearchProviderProps = {
  children: React.ReactNode
}

/** 搜索 Provider：监听快捷键并渲染 CommandMenu */
export function SearchProvider({ children }: SearchProviderProps) {
  const [open, setOpen] = useState(false)

  // Cmd/Ctrl + K 切换命令面板
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  return (
    <SearchContext.Provider value={{ open, setOpen }}>
      {children}
      <CommandMenu />
    </SearchContext.Provider>
  )
}

/** 获取搜索/命令面板上下文 */
// eslint-disable-next-line react-refresh/only-export-components
export const useSearch = () => {
  const searchContext = useContext(SearchContext)

  if (!searchContext) {
    throw new Error('useSearch has to be used within SearchProvider')
  }

  return searchContext
}
