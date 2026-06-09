/**
 * 上传任务页面离开保护 Hook
 *
 * 存在进行中的上传任务时，在用户刷新或关闭页面前触发浏览器原生确认对话框，
 * 由用户自行决定是否继续离开（离开将中断上传）。
 */
import { useEffect } from 'react'
import { useTransferStore } from '@/store/transfer'

/**
 * 注册 beforeunload 监听，在有上传中任务时提示用户
 */
export function useUploadGuard() {
  const { getUploadingTasks } = useTransferStore()

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      const uploadingTasks = getUploadingTasks()

      if (uploadingTasks.length > 0) {
        // 阻止默认行为，触发浏览器离开确认
        event.preventDefault()

        // 现代浏览器会忽略自定义文案，仅显示通用提示
        const message = `有 ${uploadingTasks.length} 个文件正在上传，刷新页面将取消所有上传任务`
        event.returnValue = message

        return message
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [getUploadingTasks])
}
