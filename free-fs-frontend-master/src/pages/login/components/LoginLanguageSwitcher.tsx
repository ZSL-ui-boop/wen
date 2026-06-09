/**
 * 登录页语言切换器
 * 中英文快速切换
 */
import { useTranslation } from 'react-i18next'
import { getAppLang } from '@/i18n'
import { cn } from '@/lib/utils'

/** 登录页右上角语言切换按钮组 */
export function LoginLanguageSwitcher() {
  const { i18n } = useTranslation()
  const lang = getAppLang()

  return (
    <div className='flex items-center gap-2 text-xs text-slate-400'>
      <button
        type='button'
        onClick={() => void i18n.changeLanguage('zh')}
        className={cn(
          'transition-colors hover:text-slate-600',
          lang === 'zh' && 'font-medium text-slate-700'
        )}
      >
        中文
      </button>
      <span aria-hidden className='text-slate-300'>
        |
      </span>
      <button
        type='button'
        onClick={() => void i18n.changeLanguage('en')}
        className={cn(
          'transition-colors hover:text-slate-600',
          lang === 'en' && 'font-medium text-slate-700'
        )}
      >
        English
      </button>
    </div>
  )
}
