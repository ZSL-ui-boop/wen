import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  getHomeInfo,
  HOME_INFO_REFETCH_INTERVAL_MS,
  type HomeUsedBytesDateType,
  type HomeUsedBytesUnit,
} from '@/api/home'
import { formatHomeStorageNumber } from '@/utils/format'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group'
import { Skeleton } from '@/components/ui/skeleton'
import {
  bigscreenGlowBottom,
  bigscreenGlowTop,
  bigscreenPanelClass,
} from '@/pages/big-screen/bigscreen-theme'

const UNIT_LABELS: Record<HomeUsedBytesUnit, string> = {
  1: 'KB',
  2: 'MB',
  3: 'GB',
}

const Y_AXIS_WIDTH: Record<HomeUsedBytesUnit, number> = {
  1: 64,
  2: 56,
  3: 52,
}

function timeRangeToDateType(range: string): HomeUsedBytesDateType {
  if (range === '30d') return 1
  if (range === '7d') return 2
  return 0
}

type ChartAreaInteractiveProps = {
  className?: string
  /** 由首页提升状态，与存储概览等单位联动 */
  unit: HomeUsedBytesUnit
  onUnitChange: (unit: HomeUsedBytesUnit) => void
  /** 文件大屏深色样式 */
  variant?: 'default' | 'bigscreen'
}

export function ChartAreaInteractive({
  className,
  unit,
  onUnitChange,
  variant = 'default',
}: ChartAreaInteractiveProps) {
  const isBigScreen = variant === 'bigscreen'
  const { t, i18n } = useTranslation('home')
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState('90d')
  const dateLocale = i18n.language?.startsWith('zh') ? 'zh-CN' : 'en-US'

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange('7d')
    }
  }, [isMobile])

  const { data: home, isLoading, isError } = useQuery({
    queryKey: ['homeInfo', 'chart', timeRange, unit],
    queryFn: () =>
      getHomeInfo({
        unit,
        dateType: timeRangeToDateType(timeRange),
      }),
    /** 切换单位/时间范围后需重新请求，避免命中旧缓存不发起网络请求 */
    staleTime: 0,
    refetchInterval: HOME_INFO_REFETCH_INTERVAL_MS,
  })

  const unitLabel = home?.unit ?? UNIT_LABELS[unit]

  const chartConfig = React.useMemo(
    () =>
      ({
        used: {
          label: t('chart.seriesLabel', { unit: unitLabel }),
          color: isBigScreen ? '#22d3ee' : 'var(--chart-1)',
        },
      }) satisfies ChartConfig,
    [unitLabel, t, isBigScreen]
  )

  const chartData = React.useMemo(() => {
    const rawList = home?.usedBytes
    if (!rawList?.length) return []
    return rawList.map((row) => ({
      date: row.date,
      used: Number(row.usedBytes),
    }))
  }, [home?.usedBytes])

  const maxUsed = React.useMemo(
    () => chartData.reduce((m, d) => Math.max(m, d.used), 0),
    [chartData]
  )

  const areaStrokeWidth =
    unit >= 2 && maxUsed > 0 && maxUsed < 0.05 ? 2.5 : 1.5

  const fillGradientId = isBigScreen ? 'fillUsedBigscreen' : 'fillUsed'
  const axisTickStyle = isBigScreen
    ? { fill: 'rgba(165, 243, 252, 0.75)', fontSize: 11 }
    : undefined

  return (
    <Card
      className={cn(
        '@container/card relative flex h-full min-h-0 flex-col gap-3 overflow-hidden py-4',
        isBigScreen && cn(bigscreenPanelClass, '!gap-3 !py-5 !shadow-none'),
        className
      )}
    >
      {isBigScreen ? (
        <>
          <div className={bigscreenGlowTop} />
          <div className={bigscreenGlowBottom} />
        </>
      ) : null}
      <CardHeader
        className={cn(
          'relative z-10 shrink-0 space-y-1.5 pb-0',
          isBigScreen && '!px-5'
        )}
      >
        <CardTitle className={cn(isBigScreen && 'text-cyan-100')}>
          {t('chart.title')}
        </CardTitle>
        <CardDescription className={cn(isBigScreen && 'text-cyan-300/70')}>
          <span className='hidden @[540px]/card:block'>
            {t('chart.descDesktop', { unit: unitLabel })}
          </span>
          <span className='@[540px]/card:hidden'>
            {t('chart.descMobile')}
          </span>
        </CardDescription>
        <CardAction className='flex flex-wrap items-center justify-end gap-2'>
          <ToggleGroup
            type='single'
            value={timeRange}
            onValueChange={(v) => v && setTimeRange(v)}
            variant='outline'
            className={cn(
              'hidden @[767px]/card:flex [&>button]:px-4',
              isBigScreen &&
                'border-cyan-500/30 [&>button]:border-cyan-500/30 [&>button]:text-cyan-100 [&>button[data-state=on]]:bg-cyan-500/20'
            )}
          >
            <ToggleGroupItem value='90d'>{t('chart.range90d')}</ToggleGroupItem>
            <ToggleGroupItem value='30d'>{t('chart.range30d')}</ToggleGroupItem>
            <ToggleGroupItem value='7d'>{t('chart.range7d')}</ToggleGroupItem>
          </ToggleGroup>
          <Select
            value={String(unit)}
            onValueChange={(v) =>
              onUnitChange(Number(v) as HomeUsedBytesUnit)
            }
          >
            <SelectTrigger
              className={cn(
                'h-8 w-22 shrink-0',
                isBigScreen && 'border-cyan-500/30 bg-slate-900/60 text-cyan-100'
              )}
              size='sm'
              aria-label={t('chart.unitAria')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              className={cn(
                'rounded-xl',
                isBigScreen && 'border-cyan-500/30 bg-slate-950 text-cyan-100'
              )}
            >
              <SelectItem value='1' className='rounded-lg'>
                KB
              </SelectItem>
              <SelectItem value='2' className='rounded-lg'>
                MB
              </SelectItem>
              <SelectItem value='3' className='rounded-lg'>
                GB
              </SelectItem>
            </SelectContent>
          </Select>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className={cn(
                'flex w-40 @[767px]/card:hidden',
                isBigScreen && 'border-cyan-500/30 bg-slate-900/60 text-cyan-100'
              )}
              size='sm'
              aria-label={t('chart.timeRangeAria')}
            >
              <SelectValue placeholder={t('chart.range90d')} />
            </SelectTrigger>
            <SelectContent
              className={cn(
                'rounded-xl',
                isBigScreen && 'border-cyan-500/30 bg-slate-950 text-cyan-100'
              )}
            >
              <SelectItem value='90d' className='rounded-lg'>
                {t('chart.range90d')}
              </SelectItem>
              <SelectItem value='30d' className='rounded-lg'>
                {t('chart.range30d')}
              </SelectItem>
              <SelectItem value='7d' className='rounded-lg'>
                {t('chart.range7d')}
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent
        className={cn(
          'relative z-10 flex min-h-0 flex-1 flex-col px-2 pb-3 pt-0 sm:px-6 sm:pb-4',
          isBigScreen && '!px-5 !pb-5'
        )}
      >
        {isLoading ? (
          <Skeleton className='min-h-[220px] w-full flex-1 rounded-lg sm:min-h-[260px]' />
        ) : isError ? (
          <div
            className={cn(
              'flex min-h-[220px] flex-1 items-center justify-center rounded-lg border border-dashed text-sm sm:min-h-[260px]',
              isBigScreen
                ? 'border-cyan-500/20 text-cyan-300/60'
                : 'text-muted-foreground'
            )}
          >
            {t('chart.loadFailed')}
          </div>
        ) : chartData.length === 0 ? (
          <div
            className={cn(
              'flex min-h-[220px] flex-1 items-center justify-center rounded-lg border border-dashed text-sm sm:min-h-[260px]',
              isBigScreen
                ? 'border-cyan-500/20 text-cyan-300/60'
                : 'text-muted-foreground'
            )}
          >
            {t('chart.noData')}
          </div>
        ) : (
        <ChartContainer
          config={chartConfig}
          className={cn(
            'aspect-auto min-h-[220px] w-full flex-1 text-xs sm:min-h-[260px] [&_.recharts-responsive-container]:!h-full [&_.recharts-responsive-container]:min-h-[inherit]',
            isBigScreen &&
              '[&_.recharts-cartesian-grid_line]:stroke-cyan-500/12'
          )}
        >
          <AreaChart
            data={chartData}
            margin={{ top: 8, right: 8, bottom: 0, left: 12 }}
          >
            <defs>
              <linearGradient id={fillGradientId} x1='0' y1='0' x2='0' y2='1'>
                <stop
                  offset='5%'
                  stopColor='var(--color-used)'
                  stopOpacity={isBigScreen ? 0.55 : 0.9}
                />
                <stop
                  offset='95%'
                  stopColor='var(--color-used)'
                  stopOpacity={isBigScreen ? 0.02 : 0.08}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              strokeDasharray='3 6'
              className={cn(
                isBigScreen ? 'stroke-cyan-500/15' : 'stroke-border/60'
              )}
            />
            <YAxis
              domain={[
                0,
                (max: number) => (Number.isFinite(max) && max > 0 ? max * 1.12 : 1),
              ]}
              tickLine={false}
              axisLine={false}
              tickMargin={6}
              width={Y_AXIS_WIDTH[unit]}
              tick={axisTickStyle}
              tickFormatter={(v) =>
                typeof v === 'number'
                  ? formatHomeStorageNumber(v, unit)
                  : String(v)
              }
            />
            <XAxis
              dataKey='date'
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={28}
              tick={axisTickStyle}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleDateString(dateLocale, {
                  month: 'short',
                  day: 'numeric',
                })
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  className={
                    isBigScreen
                      ? 'border-cyan-500/30 bg-slate-950/95 text-cyan-50'
                      : undefined
                  }
                  labelFormatter={(value) => {
                    const d = new Date(value as string)
                    if (Number.isNaN(d.getTime())) return String(value)
                    return d.toLocaleDateString(dateLocale, {
                      month: 'short',
                      day: 'numeric',
                    })
                  }}
                  formatter={(value, name) => (
                    <div className='flex w-full items-center justify-between gap-2'>
                      <span
                        className={cn(
                          isBigScreen ? 'text-cyan-300/80' : 'text-muted-foreground'
                        )}
                      >
                        {name}
                      </span>
                      <span
                        className={cn(
                          'font-mono font-medium tabular-nums',
                          isBigScreen ? 'text-cyan-100' : 'text-foreground'
                        )}
                      >
                        {typeof value === 'number'
                          ? formatHomeStorageNumber(value, unit)
                          : String(value)}{' '}
                        {unitLabel}
                      </span>
                    </div>
                  )}
                  indicator='dot'
                />
              }
            />
            <Area
              name={t('chart.areaName')}
              dataKey='used'
              type='linear'
              fill={`url(#${fillGradientId})`}
              stroke='var(--color-used)'
              strokeWidth={areaStrokeWidth}
            />
          </AreaChart>
        </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
