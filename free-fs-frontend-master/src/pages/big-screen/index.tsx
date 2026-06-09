/**
 * 数据大屏页
 * 全屏展示存储用量、文件统计与增长趋势，30 秒自动刷新
 */
import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { HomeUsedBytesUnit } from '@/api/home'
import { getDashboard } from '@/api/dashboard'
import { useAuth } from '@/contexts/auth-context'
import { useWorkspaceStore, findBySlug } from '@/store/workspace'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ChartStorageGrowth } from '@/pages/home/components/chart-storage-growth'
import { StorageOverviewCard } from '@/pages/home/components/storage-usage-card'
import { cn } from '@/lib/utils'

/** 大屏指标卡片：标签 + 数值展示 */
function MetricCard({
  label,
  value,
  className,
}: {
  label: string
  value: string | number
  className?: string
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-slate-950/75 px-5 py-4 shadow-[0_0_32px_rgba(34,211,238,0.05)] backdrop-blur-xl',
        className
      )}
    >
      <div className='pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-cyan-500/10 blur-2xl' />
      <p className='relative text-xs tracking-widest text-cyan-300/75 uppercase'>
        {label}
      </p>
      <p className='relative mt-2 font-mono text-2xl font-semibold text-cyan-50 tabular-nums md:text-3xl'>
        {value}
      </p>
    </div>
  )
}

/** 数据可视化大屏主页面 */
export default function BigScreenPage() {
  const { t } = useTranslation('bigscreen')
  const { slug = '' } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isAuthenticated, isLoading, activateWorkspace } = useAuth()
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const [ready, setReady] = React.useState(false)
  const [storageUnit, setStorageUnit] = React.useState<HomeUsedBytesUnit>(2)

  // 进入大屏前确保对应工作空间已激活（加载角色权限）
  React.useEffect(() => {
    if (isLoading || !isAuthenticated || !slug) return
    const workspace = findBySlug(slug)
    if (!workspace) {
      setReady(true)
      return
    }
    const { currentWorkspaceId, currentRole } = useWorkspaceStore.getState()
    if (workspace.id === currentWorkspaceId && currentRole) {
      setReady(true)
      return
    }
    void activateWorkspace(workspace.id).then(() => setReady(true))
  }, [slug, isLoading, isAuthenticated, workspaces, activateWorkspace])

  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['dashboard', slug, storageUnit],
    queryFn: () => getDashboard({ unit: storageUnit }),
    enabled: ready,
    refetchInterval: 30_000,
  })

  const handleRefresh = () => {
    void refetchStats()
    void queryClient.invalidateQueries({ queryKey: ['homeInfo'] })
  }

  if (isLoading || !ready) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-slate-950 text-cyan-100'>
        …
      </div>
    )
  }

  if (!slug || !findBySlug(slug)) {
    return <NavigateReplace to='/' />
  }

  const unitLabel = stats?.unit ?? (storageUnit === 3 ? 'GB' : storageUnit === 1 ? 'KB' : 'MB')

  return (
    <div className='relative min-h-screen overflow-hidden bg-[#020617] text-cyan-50'>
      <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(34,211,238,0.15),_transparent_55%)]' />
      <div className='pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.06)_1px,transparent_1px)] bg-size-[48px_48px]' />

      <header className='relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-cyan-500/20 px-6 py-4'>
        <div>
          <h1 className='text-2xl font-bold tracking-wide text-cyan-100 md:text-3xl'>
            {t('title')}
          </h1>
          <p className='mt-1 text-sm text-cyan-300/70'>{t('subtitle')}</p>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          {stats?.updatedAt ? (
            <span className='text-xs text-cyan-400/60'>
              {t('updatedAt', { time: stats.updatedAt })}
            </span>
          ) : null}
          <Button
            variant='outline'
            size='sm'
            className='border-cyan-500/40 bg-slate-900/50 text-cyan-100 hover:bg-cyan-950'
            onClick={handleRefresh}
          >
            {t('refresh')}
          </Button>
          <Button
            variant='outline'
            size='sm'
            className='border-cyan-500/40 bg-slate-900/50 text-cyan-100 hover:bg-cyan-950'
            asChild
          >
            <Link to={`/w/${slug}/`}>{t('exit')}</Link>
          </Button>
        </div>
      </header>

      <main className='relative z-10 space-y-5 px-4 py-6 lg:px-8'>
        <section>
          <h2 className='mb-3 text-xs font-medium tracking-widest text-cyan-400/80 uppercase'>
            {t('metricsSection')}
          </h2>
          {statsError ? (
            <p className='text-sm text-red-300'>{t('loadFailed')}</p>
          ) : statsLoading ? (
            <div className='grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6'>
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className='h-[88px] rounded-2xl bg-cyan-500/10'
                />
              ))}
            </div>
          ) : (
            <div className='grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6'>
              <MetricCard
                label={t('metrics.usedStorage')}
                value={`${stats?.usedStorage ?? 0} ${unitLabel}`}
              />
              <MetricCard
                label={t('metrics.files')}
                value={stats?.fileCount ?? 0}
              />
              <MetricCard
                label={t('metrics.folders')}
                value={stats?.folderCount ?? 0}
              />
              <MetricCard
                label={t('metrics.shares')}
                value={stats?.shareCount ?? 0}
              />
              <MetricCard
                label={t('metrics.recycle')}
                value={stats?.recycleCount ?? 0}
              />
              <MetricCard
                label={t('metrics.uploadToday')}
                value={stats?.uploadTodayCount ?? 0}
              />
            </div>
          )}
        </section>

        <section>
          <h2 className='mb-3 text-xs font-medium tracking-widest text-cyan-400/80 uppercase'>
            {t('trendSection')}
          </h2>
          <div className='grid min-h-[min(58vh,560px)] grid-cols-1 gap-5 lg:grid-cols-[1fr_280px] lg:items-stretch'>
            <ChartStorageGrowth
              variant='bigscreen'
              unit={storageUnit}
              onUnitChange={setStorageUnit}
              className='min-h-[360px] min-w-0 lg:min-h-0 lg:h-full'
            />
            <StorageOverviewCard
              variant='bigscreen'
              storageUnit={storageUnit}
              className='min-h-[280px] w-full lg:min-h-0 lg:h-full'
            />
          </div>
        </section>
      </main>
    </div>
  )
}

/** 编程式 replace 导航（slug 无效时回退首页） */
function NavigateReplace({ to }: { to: string }) {
  const navigate = useNavigate()
  React.useEffect(() => {
    navigate(to, { replace: true })
  }, [navigate, to])
  return null
}
