/**
 * 国际化（i18n）配置
 *
 * 使用 i18next + react-i18next，聚合中英文各模块文案；
 * 语言选择持久化到 localStorage，并通过 getRequestLangHeader 同步到 API 请求头。
 */
import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import enAi from '@/locales/en/ai.json'
import enBigscreen from '@/locales/en/bigscreen.json'
import enCommon from '@/locales/en/common.json'
import enFiles from '@/locales/en/files.json'
import enHome from '@/locales/en/home.json'
import enLayout from '@/locales/en/layout.json'
import enLogin from '@/locales/en/login.json'
import enInvite from '@/locales/en/invite.json'
import enSettings from '@/locales/en/settings.json'
import enShare from '@/locales/en/share.json'
import enStorage from '@/locales/en/storage.json'
import enTransfer from '@/locales/en/transfer.json'
import enWorkspace from '@/locales/en/workspace.json'
import zhAi from '@/locales/zh/ai.json'
import zhBigscreen from '@/locales/zh/bigscreen.json'
import zhCommon from '@/locales/zh/common.json'
import zhFiles from '@/locales/zh/files.json'
import zhHome from '@/locales/zh/home.json'
import zhLayout from '@/locales/zh/layout.json'
import zhLogin from '@/locales/zh/login.json'
import zhInvite from '@/locales/zh/invite.json'
import zhSettings from '@/locales/zh/settings.json'
import zhShare from '@/locales/zh/share.json'
import zhStorage from '@/locales/zh/storage.json'
import zhTransfer from '@/locales/zh/transfer.json'
import zhWorkspace from '@/locales/zh/workspace.json'

/** 应用内简化的语言代码 */
export type AppLang = 'zh' | 'en'

/** 与后端约定的 BCP 47 语言码，用于请求头 `lang` */
export type ApiLang = 'zh-CN' | 'en-US'

/** 获取当前应用语言（zh / en） */
export function getAppLang(): AppLang {
  const lng = i18n.resolvedLanguage || i18n.language || 'zh'
  if (lng.startsWith('zh')) return 'zh'
  if (lng.startsWith('en')) return 'en'
  return 'zh'
}

/** 转换为 API 请求头使用的语言码 */
export function getRequestLangHeader(): ApiLang {
  return getAppLang() === 'en' ? 'en-US' : 'zh-CN'
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        ai: enAi,
        bigscreen: enBigscreen,
        common: enCommon,
        files: enFiles,
        home: enHome,
        layout: enLayout,
        login: enLogin,
        invite: enInvite,
        settings: enSettings,
        share: enShare,
        storage: enStorage,
        transfer: enTransfer,
        workspace: enWorkspace,
      },
      zh: {
        ai: zhAi,
        bigscreen: zhBigscreen,
        common: zhCommon,
        files: zhFiles,
        home: zhHome,
        layout: zhLayout,
        login: zhLogin,
        invite: zhInvite,
        settings: zhSettings,
        share: zhShare,
        storage: zhStorage,
        transfer: zhTransfer,
        workspace: zhWorkspace,
      },
    },
    /** 默认中文；勿设置 `lng`，否则会覆盖 localStorage 里用户选的语言 */
    fallbackLng: 'zh',
    supportedLngs: ['zh', 'en'],
    load: 'languageOnly',
    ns: [
      'ai',
      'bigscreen',
      'common',
      'files',
      'home',
      'layout',
      'login',
      'invite',
      'settings',
      'share',
      'storage',
      'transfer',
      'workspace',
    ],
    defaultNS: 'login',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
  })

export default i18n
