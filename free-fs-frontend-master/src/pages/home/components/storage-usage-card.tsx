/**
 * 存储用量概览卡片
 * 展示已用/总量空间与快捷跳转，支持大屏主题变体
 */
import { HardDrive } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import {
  getHomeInfo,
  HOME_INFO_REFETCH_INTERVAL_MS,
  type HomeUsedBytesUnit,
} from '@/api/home'
import { formatHomeStorageDisplay } from '@/utils/format'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  bigscreenGlowBottom,
  bigscreenGlowTop,
  bigscreenPanelClass,
} from '@/pages/big-screen/bigscreen-theme'

/** 存储概览：仅展示服务端已用空间（无总额度时不造百分比）；unit 与图表联动 */
export function StorageOverviewCard({
  className,
  storageUnit,
  variant = 'default',
}: {
  className?: string
  storageUnit: HomeUsedBytesUnit
  variant?: 'default' | 'bigscreen'
}) {
  const isBigScreen = variant === 'bigscreen'
  const { t } = useTranslation('home')
  const { slug } = useParams<{ slug: string }>()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['homeInfo', 'summary', slug, storageUnit],
    queryFn: () => getHomeInfo({ unit: storageUnit }),
    staleTime: 30_000,
    refetchInterval: HOME_INFO_REFETCH_INTERVAL_MS,
  })

  const usedStorage = data?.usedStorage
  const unitLabel = data?.unit ?? ''

  const panelBase = isBigScreen
    ? cn(bigscreenPanelClass, '!gap-0 !py-5 !shadow-none')
    : 'relative overflow-hidden rounded-xl border-border/40 bg-linear-to-br from-card via-card to-card/50 shadow-sm backdrop-blur-sm'

  if (isLoading) {
    return (
      <Card
        className={cn(
          'relative flex min-h-[240px] flex-col p-5 sm:min-h-[260px] lg:min-h-0 lg:h-full',
          panelBase,
          className
        )}
      >
        {isBigScreen ? (
          <>
            <div className={bigscreenGlowTop} />
            <div className={bigscreenGlowBottom} />
          </>
        ) : (
          <>
            <div className='absolute top-0 right-0 h-32 w-32 rounded-full bg-linear-to-br from-primary/10 to-transparent blur-3xl' />
            <div className='absolute bottom-0 left-0 h-24 w-24 rounded-full bg-linear-to-tr from-purple-500/10 to-transparent blur-3xl' />
          </>
        )}
        <div className='relative z-10 space-y-4'>
          <Skeleton
            className={cn('h-5 w-28', isBigScreen && 'bg-cyan-500/10')}
          />
          <div className='flex flex-col items-center gap-4 py-2'>
            <Skeleton
              className={cn('size-20 rounded-full', isBigScreen && 'bg-cyan-500/10')}
            />
            <Skeleton
              className={cn('h-10 w-36', isBigScreen && 'bg-cyan-500/10')}
            />
            <Skeleton
              className={cn('h-4 w-16', isBigScreen && 'bg-cyan-500/10')}
            />
          </div>
          <Skeleton
            className={cn('h-9 w-full rounded-lg', isBigScreen && 'bg-cyan-500/10')}
          />
        </div>
      </Card>
    )
  }

  return (
    <Card
      className={cn(
        'relative flex h-full min-h-0 min-w-0 flex-col p-5 lg:min-h-0',
        panelBase,
        className
      )}
    >
      {isBigScreen ? (
        <>
          <div className={bigscreenGlowTop} />
          <div className={bigscreenGlowBottom} />
        </>
      ) : (
        <>
          <div className='pointer-events-none absolute top-0 right-0 h-32 w-32 rounded-full bg-linear-to-br from-primary/10 to-transparent blur-3xl' />
          <div className='pointer-events-none absolute bottom-0 left-0 h-24 w-24 rounded-full bg-linear-to-tr from-purple-500/10 to-transparent blur-3xl' />
        </>
      )}

      <div className='relative flex min-h-0 flex-1 flex-col'>
        <h3
          className={cn(
            'mb-4 text-base font-bold',
            isBigScreen && 'text-cyan-100'
          )}
        >
          {t('storageCard.title')}
        </h3>

        <div className='flex flex-1 flex-col items-center justify-center gap-3 py-2'>
          <div
            className={cn(
              'flex size-20 shrink-0 items-center justify-center rounded-full ring-1',
              isBigScreen
                ? 'bg-cyan-500/10 ring-cyan-400/30'
                : 'bg-linear-to-br from-indigo-500/15 via-violet-500/10 to-blue-500/15 ring-sidebar-primary/20'
            )}
            aria-hidden
          >
            <HardDrive
              className={cn(
                'size-9',
                isBigScreen ? 'text-cyan-400' : 'text-sidebar-primary'
              )}
              strokeWidth={1.5}
            />
          </div>
          <div className='flex min-h-11 flex-col items-center justify-center gap-1 text-center'>
            <span
              className={cn(
                'max-w-full break-all text-2xl font-bold leading-tight tabular-nums sm:text-3xl',
                isBigScreen
                  ? 'bg-linear-to-br from-cyan-200 via-cyan-400 to-teal-400 bg-clip-text text-transparent'
                  : 'bg-linear-to-br from-purple-500 via-blue-500 to-blue-600 bg-clip-text text-transparent'
              )}
              title={
                isError || usedStorage === undefined
                  ? undefined
                  : formatHomeStorageDisplay(
                      usedStorage,
                      unitLabel,
                      storageUnit
                    )
              }
            >
              {isError || usedStorage === undefined
                ? '—'
                : formatHomeStorageDisplay(
                    usedStorage,
                    unitLabel,
                    storageUnit
                  )}
            </span>
            <span
              className={cn(
                'text-xs font-medium text-muted-foreground',
                isBigScreen && 'text-cyan-300/70'
              )}
            >
              {t('storageCard.usedLabel')}
            </span>
          </div>
        </div>

        <Button
          className={cn(
            'mt-4 h-9 w-full rounded-lg text-sm font-semibold transition-all',
            isBigScreen
              ? 'border border-cyan-400/50 bg-cyan-500/20 text-cyan-100 shadow-[0_0_20px_rgba(34,211,238,0.15)] hover:bg-cyan-500/35 hover:text-white'
              : 'shadow-sm hover:shadow-md'
          )}
          asChild
        >
          <Link to={`/w/${slug}/storage`}>{t('storageCard.manage')}</Link>
        </Button>
      </div>
    </Card>
  )
}
