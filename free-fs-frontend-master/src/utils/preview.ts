/**
 * 文件预览工具
 *
 * 通过短时预览令牌在新标签页打开预览页，避免直接暴露长期有效的访问凭证。
 */
import { toast } from 'sonner'
import { getPreviewToken } from '@/api/file'
import i18n from '@/i18n'

/**
 * 获取预览令牌并在新窗口打开预览页
 *
 * 流程：先打开空白页（避免弹窗拦截）→ 请求 previewToken → 跳转至预览 URL。
 * 任一步失败时关闭窗口并提示用户。
 *
 * @param fileId 文件 ID
 * @param previewBaseUrl 预览服务根地址（不含路径）
 */
export async function openFilePreviewWithToken(
  fileId: string,
  previewBaseUrl: string
) {
  // 同步打开空白页，降低被浏览器拦截的概率
  const previewWindow = window.open('', '_blank')

  if (!previewWindow) {
    toast.error(i18n.t('common:preview.popupBlocked'))
    return
  }

  try {
    const token = await getPreviewToken(fileId)
    const previewUrl = `${previewBaseUrl}/preview/${fileId}?previewToken=${encodeURIComponent(token)}`
    previewWindow.location.href = previewUrl
  } catch (error) {
    previewWindow.close()
    toast.error(i18n.t('common:preview.tokenFailed'))
  }
}
