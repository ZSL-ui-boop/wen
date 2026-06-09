/**
 * @file 应用主布局
 * @description 组合侧边栏、顶栏、主内容区、设置弹窗与 AI 助手悬浮按钮，构成登录后的整体页面骨架。
 */
import { useMemo } from 'react'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { SettingsModalProvider } from '@/contexts/settings-modal-context'
import { SettingsDialog } from '@/pages/settings'
import { AppSidebar } from './app-sidebar'
import { Header } from './header'
import { Main } from './main'
import { AiAssistantFab } from '@/components/ai-assistant/ai-assistant-fab'

/** localStorage 中侧边栏展开/折叠状态的键名 */
export const LAYOUT_STORAGE_KEY = 'app-layout'

/**
 * 读取用户上次保存的侧边栏展开偏好。
 * SSR 环境下默认展开；值为 `compact` 时表示折叠为图标模式。
 */
export function getDefaultSidebarOpen(): boolean {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(LAYOUT_STORAGE_KEY) !== 'compact'
}

interface AppLayoutProps {
  children: React.ReactNode
}

/**
 * 应用根布局：SidebarProvider 包裹侧栏与内容区，并挂载全局设置与 AI 入口。
 */
export function AppLayout({ children }: AppLayoutProps) {
  const defaultOpen = useMemo(getDefaultSidebarOpen, [])
  return (
    <SettingsModalProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar />
        <SidebarInset>
          <Header fixed />
          <Main fixed>{children}</Main>
        </SidebarInset>
        {/* 与主侧栏同处 SidebarProvider，设置内外观表单的 useSidebar 才能取到主布局侧边栏 */}
        <SettingsDialog />
        <AiAssistantFab />
      </SidebarProvider>
    </SettingsModalProvider>
  )
}
