import type { HomeUsedBytesUnit } from '@/api/home'
import { ChartAreaInteractive } from '@/components/chart-area-interactive'
import { cn } from '@/lib/utils'

type ChartStorageGrowthProps = {
  className?: string
  unit: HomeUsedBytesUnit
  onUnitChange: (unit: HomeUsedBytesUnit) => void
  variant?: 'default' | 'bigscreen'
}

export function ChartStorageGrowth({
  className,
  unit,
  onUnitChange,
  variant = 'default',
}: ChartStorageGrowthProps) {
  return (
    <ChartAreaInteractive
      unit={unit}
      onUnitChange={onUnitChange}
      variant={variant}
      className={cn(
        'h-full min-h-0 bg-transparent shadow-none',
        className
      )}
    />
  )
}
