/**
 * 应用根组件
 * 组装认证上下文、SSE/上传守卫、路由、导航进度条与全局 Toast
 */
import { AuthProvider } from '@/contexts/auth-context'
import { router } from '@/router'
import { RouterProvider } from 'react-router-dom'
import { useSSEConnection } from '@/hooks/useSSEConnection'
import { useUploadGuard } from '@/hooks/useUploadGuard'
import { Toaster } from '@/components/ui/sonner'
import { NavigationProgress } from '@/components/navigation-progress'

/**
 * SSE 与上传守卫初始化（必须在 AuthProvider 内部，依赖登录态）
 */
function SSEInitializer() {
  useSSEConnection()
  useUploadGuard()
  return null
}

/** 应用根组件：Provider 包裹 + 路由出口 */
export default function App() {
  return (
    <AuthProvider>
      <SSEInitializer />
      <NavigationProgress />
      <RouterProvider router={router} />
      <Toaster />
    </AuthProvider>
  )
}
