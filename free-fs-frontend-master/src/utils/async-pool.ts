/**
 * 限制并发执行异步任务，避免一次性 Promise.all 压垮主线程与浏览器连接数。
 */
export async function pool<T, R>(
  concurrency: number,
  items: readonly T[],
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return []

  const limit = Math.max(1, concurrency)
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (true) {
      const i = nextIndex
      if (i >= items.length) break
      nextIndex += 1
      results[i] = await fn(items[i], i)
    }
  }

  const workerCount = Math.min(limit, items.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}
