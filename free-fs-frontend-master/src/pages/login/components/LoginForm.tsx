/**
 * 登录表单容器（旧版）
 * 本地 state 切换登录/注册/忘记密码，新版登录页已改用 URL 参数
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ForgotPasswordContent from './ForgotPasswordContent'
import LoginFormContent from './LoginFormContent'
import RegisterFormContent from './RegisterFormContent'

/** 当前展示的表单类型 */
type FormType = 'login' | 'register' | 'forgotPassword'

/** 登录/注册/忘记密码表单切换容器 */
export default function LoginForm() {
  const { t } = useTranslation('login')
  const [currentForm, setCurrentForm] = useState<FormType>('login')

  // 各表单类型对应的标题文案
  const formTitles: Record<FormType, string> = {
    login: t('formTitleLogin'),
    register: t('formTitleRegister'),
    forgotPassword: t('formTitleForgotPassword'),
  }

  return (
    <div className='login-form-wrapper'>
      <div className='text-2xl leading-8 font-medium text-foreground'>
        {formTitles[currentForm]}
      </div>
      <div className='mt-2 mb-1'>
        <div className='text-[15px] leading-[22px] font-medium tracking-[0.5px] text-muted-foreground'>
          {t('tagline')}
        </div>
        <div className='mt-0.5 text-[13px] leading-5 text-muted-foreground/70'>
          {t('taglineSub')}
        </div>
      </div>

      {/* 按 currentForm 条件渲染对应表单 */}
      {currentForm === 'login' && (
        <LoginFormContent onSwitchForm={setCurrentForm} />
      )}
      {currentForm === 'register' && (
        <RegisterFormContent onSwitchForm={setCurrentForm} />
      )}
      {currentForm === 'forgotPassword' && (
        <ForgotPasswordContent onSwitchForm={setCurrentForm} />
      )}
    </div>
  )
}
