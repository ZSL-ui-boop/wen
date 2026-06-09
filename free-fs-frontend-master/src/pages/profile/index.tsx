/**
 * 个人资料占位页（独立路由，当前由设置弹窗承载主要功能）
 */
import { useTranslation } from 'react-i18next'

/** 个人资料页面占位组件 */
export default function ProfilePage() {
  const { t } = useTranslation('common')
  return (
    <div className='p-6'>
      <h1 className='mb-4 text-2xl font-bold'>{t('profile.title')}</h1>
      <p className='text-muted-foreground'>{t('profile.description')}</p>
    </div>
  )
}
