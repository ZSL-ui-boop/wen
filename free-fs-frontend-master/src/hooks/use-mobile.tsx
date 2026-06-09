/**
 * 移动端视口检测 Hook
 *
 * 基于 matchMedia 监听窗口宽度，判断当前是否为移动端布局（<768px）。
 */
import * as React from 'react'

/** 移动端断点（px），宽度小于此值视为 mobile */
const MOBILE_BREAKPOINT = 768

/**
 * 返回当前是否为移动端视口
 *
 * 首次渲染可能为 undefined，最终统一转为 boolean（undefined 视为 false）。
 *
 * @returns 视口宽度 < MOBILE_BREAKPOINT 时为 true
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener('change', onChange)
    // 挂载时立即计算一次当前宽度
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return !!isMobile
}
