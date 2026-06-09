/**
 * @file 主内容区容器
 * @description 包裹页面主体，支持固定高度布局与最大宽度限制。
 */
import { cn } from '@/lib/utils'

type MainProps = React.HTMLAttributes<HTMLElement> & {
  fixed?: boolean
  fluid?: boolean
  ref?: React.Ref<HTMLElement>
}

/**
 * 主内容 `<main>` 容器。
 * @param fixed - 为 true 时使用 flex 纵向布局并隐藏溢出，适配固定顶栏场景
 * @param fluid - 为 false 时在宽屏下限制最大宽度
 */
export function Main({ fixed, className, fluid, ...props }: MainProps) {
  return (
    <main
      data-layout={fixed ? 'fixed' : 'auto'}
      className={cn(
        // fixed 布局：主区域 flex 撑满剩余高度
        fixed && 'flex grow flex-col overflow-hidden',

        // 非 fluid：超宽屏居中并限制 max-width
        !fluid &&
          '@7xl/content:mx-auto @7xl/content:w-full @7xl/content:max-w-7xl',
        className
      )}
      {...props}
    />
  )
}
