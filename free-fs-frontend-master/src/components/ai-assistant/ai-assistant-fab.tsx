import * as React from 'react'
import { Bot } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { AiChatPanel } from './ai-chat-panel'

export function AiAssistantFab() {
  const { t } = useTranslation('ai')
  const [open, setOpen] = React.useState(false)

  return (
    <>
      {!open && (
        <Button
          type='button'
          size='icon'
          className='fixed right-6 bottom-6 z-50 size-12 rounded-full shadow-lg'
          aria-label={t('title')}
          onClick={() => setOpen(true)}
        >
          <Bot className='size-5' />
        </Button>
      )}
      <AiChatPanel open={open} onOpenChange={setOpen} />
    </>
  )
}
