/**
 * @file 表格批量操作栏
 * @description 选中行时在页面底部固定显示的操作工具栏，支持键盘导航与读屏播报。
 */
import { useState, useEffect, useRef } from 'react'
import { type Table } from '@tanstack/react-table'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type DataTableBulkActionsProps<TData> = {
  table: Table<TData>
  entityName: string
  children: React.ReactNode
}

/**
 * 表格批量操作浮动工具栏；无选中行时不渲染。
 *
 * @param table - TanStack Table 实例
 * @param entityName - 实体名称，用于无障碍文案（如 task、user）
 * @param children - 自定义批量操作按钮
 */
export function DataTableBulkActions<TData>({
  table,
  entityName,
  children,
}: DataTableBulkActionsProps<TData>): React.ReactNode | null {
  const selectedRows = table.getFilteredSelectedRowModel().rows
  const selectedCount = selectedRows.length
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [announcement, setAnnouncement] = useState('')

  /** 选中数量变化时向屏幕阅读器播报 */
  useEffect(() => {
    if (selectedCount > 0) {
      const message = `${selectedCount} ${entityName}${selectedCount > 1 ? 's' : ''} selected. Bulk actions toolbar is available.`

      queueMicrotask(() => {
        setAnnouncement(message)
      })

      const timer = setTimeout(() => setAnnouncement(''), 3000)
      return () => clearTimeout(timer)
    }
  }, [selectedCount, entityName])

  const handleClearSelection = () => {
    table.resetRowSelection()
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const buttons = toolbarRef.current?.querySelectorAll('button')
    if (!buttons) return

    const currentIndex = Array.from(buttons).findIndex(
      (button) => button === document.activeElement
    )

    switch (event.key) {
      case 'ArrowRight': {
        event.preventDefault()
        const nextIndex = (currentIndex + 1) % buttons.length
        buttons[nextIndex]?.focus()
        break
      }
      case 'ArrowLeft': {
        event.preventDefault()
        const prevIndex =
          currentIndex === 0 ? buttons.length - 1 : currentIndex - 1
        buttons[prevIndex]?.focus()
        break
      }
      case 'Home':
        event.preventDefault()
        buttons[0]?.focus()
        break
      case 'End':
        event.preventDefault()
        buttons[buttons.length - 1]?.focus()
        break
      case 'Escape': {
        const target = event.target as HTMLElement
        const activeElement = document.activeElement as HTMLElement

        const isFromDropdownTrigger =
          target?.getAttribute('data-slot') === 'dropdown-menu-trigger' ||
          activeElement?.getAttribute('data-slot') ===
            'dropdown-menu-trigger' ||
          target?.closest('[data-slot="dropdown-menu-trigger"]') ||
          activeElement?.closest('[data-slot="dropdown-menu-trigger"]')

        const isFromDropdownContent =
          activeElement?.closest('[data-slot="dropdown-menu-content"]') ||
          target?.closest('[data-slot="dropdown-menu-content"]')

        if (isFromDropdownTrigger || isFromDropdownContent) {
          return
        }

        event.preventDefault()
        handleClearSelection()
        break
      }
    }
  }

  if (selectedCount === 0) {
    return null
  }

  return (
    <>
      <div
        aria-live='polite'
        aria-atomic='true'
        className='sr-only'
        role='status'
      >
        {announcement}
      </div>

      <div
        ref={toolbarRef}
        role='toolbar'
        aria-label={`Bulk actions for ${selectedCount} selected ${entityName}${selectedCount > 1 ? 's' : ''}`}
        aria-describedby='bulk-actions-description'
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={cn(
          'fixed bottom-6 left-1/2 z-50 isolate -translate-x-1/2',
          'flex items-center gap-3 rounded-xl border border-input bg-background px-3 py-2 shadow-xs',
          'transition-all delay-100 duration-300 ease-out hover:scale-105',
          'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='outline'
              size='icon'
              onClick={handleClearSelection}
              className='size-6 shrink-0 rounded-full'
              aria-label='Clear selection'
              title='Clear selection (Escape)'
            >
              <X />
              <span className='sr-only'>Clear selection</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Clear selection (Escape)</p>
          </TooltipContent>
        </Tooltip>

        <Separator
          className='h-5'
          orientation='vertical'
          aria-hidden='true'
        />

        <div
          className='flex min-w-0 items-center gap-2 text-sm text-foreground'
          id='bulk-actions-description'
        >
          <span
            className='inline-flex min-w-7 items-center justify-center rounded-xl bg-primary px-2 py-0.5 text-xs font-semibold tabular-nums text-primary-foreground'
            aria-label={`${selectedCount} selected`}
          >
            {selectedCount}
          </span>
          <span className='text-muted-foreground'>
            <span className='hidden sm:inline'>
              {entityName}
              {selectedCount > 1 ? 's' : ''}{' '}
            </span>
            selected
          </span>
        </div>

        <Separator
          className='h-5'
          orientation='vertical'
          aria-hidden='true'
        />

        <div className='flex items-center gap-1.5'>{children}</div>
      </div>
    </>
  )
}
