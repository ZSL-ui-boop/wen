/**
 * 应用入口模块
 * 挂载 React 根节点，注入 React Query、主题 Provider 与全局样式
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@/i18n'
import App from './app'
import { ThemeProvider } from './components/theme-provider'
import './styles/index.css'

/** 全局 React Query 客户端：关闭窗口聚焦自动刷新，失败最多重试 1 次 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme='system' storageKey='theme'>
        <App />
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>
)
