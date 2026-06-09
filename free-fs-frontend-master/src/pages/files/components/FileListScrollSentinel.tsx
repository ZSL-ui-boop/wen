/**
 * 文件列表滚动哨兵
 * 置于列表底部，通过 IntersectionObserver 触发无限滚动加载
 */
import { useEffect, useRef } from 'react'

/** 滚动哨兵组件 props */
interface FileListScrollSentinelProps {
  /** 实际滚动的祖先容器 ref */
  scrollRootRef: React.RefObject<HTMLElement | null>
  /** 是否还有更多页可加载 */
  hasMore: boolean
  /** 进入可视区域时的加载回调 */
  onLoadMore: () => void
}

/**
 * 列表底部哨兵元素
 * 进入 scrollRoot 可视范围时触发 onLoadMore；重复触发由 useFileList.loadMore 内部防抖
 */
export function FileListScrollSentinel({
  scrollRootRef,
  hasMore,
  onLoadMore,
}: FileListScrollSentinelProps) {
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!hasMore) return
    const root = scrollRootRef.current
    const el = sentinelRef.current
    if (!root || !el) return

    // 提前 120px 预加载下一页，减少滚动到底部的等待感
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        onLoadMore()
      },
      { root, rootMargin: '120px 0px', threshold: 0 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [scrollRootRef, hasMore, onLoadMore])

  if (!hasMore) return null

  return (
    <div
      ref={sentinelRef}
      className='h-2 w-full shrink-0'
      aria-hidden
    />
  )
}
