/**
 * 工作空间首页
 * 展示欢迎区、文件分类快捷入口与最近访问文件列表
 */
import * as React from 'react'
import { BarChart3 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { RecentFilesTable } from './components/recent-files-table'
import {
  buildCategoryShortcuts,
  CategoryShortcutLink,
} from './components/section-cards'

/** 工作空间仪表盘首页 */
export default function HomePage() {
  const { t } = useTranslation('home')
  const { slug = '' } = useParams<{ slug: string }>()

  const categoryShortcuts = React.useMemo(
    () => buildCategoryShortcuts(slug, t),
    [slug, t]
  )

  return (
    <div className='flex flex-1 flex-col'>
      <div className='@container/main flex flex-1 flex-col gap-2'>
        <div className='flex flex-col gap-5 py-4 md:gap-6 md:py-6'>
          <div className='flex flex-col gap-4 px-4 lg:px-6'>
            <div className='flex flex-wrap items-end justify-between gap-3'>
              <div>
                <h1 className='text-xl font-semibold tracking-tight md:text-2xl'>
                  {t('welcome.title')}
                </h1>
                <p className='text-muted-foreground mt-1 text-sm'>
                  {t('welcome.subtitle')}
                </p>
              </div>
              <Button variant='outline' size='sm' className='shrink-0' asChild>
                <Link to={`/w/${slug}/big-screen`}>
                  <BarChart3 className='mr-1.5 size-4' />
                  {t('welcome.bigScreen')}
                </Link>
              </Button>
            </div>
            <div className='grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5 lg:gap-3'>
              {categoryShortcuts.map((item) => (
                <CategoryShortcutLink key={item.href} {...item} />
              ))}
            </div>
          </div>
          <RecentFilesTable unit={2} />
        </div>
      </div>
    </div>
  )
}
