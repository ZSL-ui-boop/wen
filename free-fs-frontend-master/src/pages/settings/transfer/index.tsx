/**
 * 传输偏好设置页
 * 上传并发数、分片大小等传输相关配置
 */
import { useTranslation } from 'react-i18next'
import {
  SettingsPageDescription,
  SettingsPageTitle,
} from '../components/settings-page-header'
import { TransferForm } from './transfer-form'

/** 设置 - 传输偏好面板 */
export function SettingsTransfer() {
  const { t } = useTranslation('settings')
  return (
    <div className='flex flex-1 flex-col'>
      <header className='flex-none'>
        <SettingsPageTitle>{t('transfer.pageTitle')}</SettingsPageTitle>
        <SettingsPageDescription>
          {t('transfer.pageDescription')}
        </SettingsPageDescription>
      </header>
      <div className='mt-8 flex-1'>
        <TransferForm />
      </div>
    </div>
  )
}
