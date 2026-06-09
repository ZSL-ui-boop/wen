/**
 * 设置弹窗全局状态
 *
 * 控制设置对话框的开关与当前 Tab（个人资料、外观、传输、工作空间等），
 * 供侧边栏、命令菜单等任意位置打开指定设置面板。
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

/** 设置弹窗内可切换的面板 Tab */
export type SettingsTab =
  | 'profile'
  | 'appearance'
  | 'transfer'
  | 'workspace'
  | 'members'
  | 'roles'

type SettingsModalValue = {
  /** 弹窗是否打开 */
  open: boolean
  setOpen: (open: boolean) => void
  /** 当前选中的 Tab */
  tab: SettingsTab
  setTab: (tab: SettingsTab) => void
  /** 打开设置弹窗；可指定初始 Tab，默认个人资料 */
  openSettings: (tab?: SettingsTab) => void
}

const SettingsModalContext = createContext<SettingsModalValue | null>(null)

/** 设置弹窗 Provider */
export function SettingsModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<SettingsTab>('profile')

  const openSettings = useCallback((next?: SettingsTab) => {
    if (next) setTab(next)
    setOpen(true)
  }, [])

  const value = useMemo(
    () => ({
      open,
      setOpen,
      tab,
      setTab,
      openSettings,
    }),
    [open, tab, openSettings]
  )

  return (
    <SettingsModalContext.Provider value={value}>
      {children}
    </SettingsModalContext.Provider>
  )
}

/** 获取设置弹窗上下文 */
export function useSettingsModal() {
  const ctx = useContext(SettingsModalContext)
  if (!ctx) {
    throw new Error('useSettingsModal 须在 SettingsModalProvider 内使用')
  }
  return ctx
}
