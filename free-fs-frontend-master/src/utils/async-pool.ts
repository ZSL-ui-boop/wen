/**
 * 异步任务并发池
 *
 * 限制同时执行的 Promise 数量，避免一次性 Promise.all 压垮主线程
 * 与浏览器同源连接数上限。适用于批量上传、批量校验等场景。
 */

/**
 * 以固定并发度执行异步任务，并保持结果顺序与输入一致
 *
 * @template T 输入项类型
 * @template R 输出结果类型
 * @param concurrency 最大并发 worker 数（至少为 1）
 * @param items 待处理的任务列表
 * @param fn 对每个任务执行的异步函数
 * @returns 与 items 等长、同序的结果数组
 */
export async function pool<T, R>(
  concurrency: number,
  items: readonly T[],
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  // 空列表直接返回，避免创建无意义的 worker
  if (items.length === 0) return []

  const limit = Math.max(1, concurrency)
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  /** 单个 worker：原子地领取下一个索引并执行 fn，直到任务耗尽 */
  async function worker(): Promise<void> {
    while (true) {
      const i = nextIndex
      if (i >= items.length) break
      nextIndex += 1
      results[i] = await fn(items[i], i)
    }
  }

  // 实际 worker 数不超过并发上限与任务总数
  const workerCount = Math.min(limit, items.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}
