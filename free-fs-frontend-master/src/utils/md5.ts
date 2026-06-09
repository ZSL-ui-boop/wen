/**
 * 文件 MD5 / 指纹计算工具
 *
 * 大文件上传中用于：
 * 1. calculateFileMD5 — 上传前整文件校验（秒传检测）
 * 2. calculateBlobMD5 — 每个分片上传前的完整性校验
 *
 * 大文件（≥100MB）使用采样指纹而非全量 MD5，避免阻塞主线程过久。
 */
import SparkMD5 from 'spark-md5'

import i18n from '@/i18n'

/**
 * 快速指纹阈值（字节）
 * ≥100MB 的文件使用采样指纹，否则计算完整 MD5
 */
const FAST_FINGERPRINT_THRESHOLD = 100 * 1024 * 1024

/**
 * 让出主线程
 * MD5 计算是 CPU 密集型操作，定期 yield 避免页面「无响应」提示
 */
function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => resolve(), { timeout: 64 })
    } else {
      setTimeout(resolve, 0)
    }
  })
}

/**
 * 计算文件的快速指纹（采样策略）
 *
 * 对大文件只读取头/中/尾各 2MB 采样计算 MD5，再与文件大小、修改时间组合，
 * 速度远快于全量 MD5，用于秒传场景的近似匹配。
 *
 * @param file 待计算指纹的 File 对象
 * @returns 固定长度的 MD5 风格指纹字符串
 */
export function calculateFastFingerprint(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const sampleSize = 2 * 1024 * 1024 // 每个采样点 2MB
    const spark = new SparkMD5.ArrayBuffer()
    const fileReader = new FileReader()

    // 采样点列表：头部、中部（文件足够大时）、尾部（文件足够大时）
    const samples: { start: number; end: number }[] = []

    // 头部采样
    samples.push({ start: 0, end: Math.min(sampleSize, file.size) })

    // 中部采样（文件 > 6MB 时才有意义）
    if (file.size > sampleSize * 3) {
      const middle = Math.floor(file.size / 2)
      samples.push({
        start: middle - Math.floor(sampleSize / 2),
        end: middle + Math.floor(sampleSize / 2),
      })
    }

    // 尾部采样（文件 > 4MB 时）
    if (file.size > sampleSize * 2) {
      samples.push({
        start: Math.max(0, file.size - sampleSize),
        end: file.size,
      })
    }

    let currentSample = 0

    /** 顺序读取下一个采样点 */
    function loadNext() {
      if (currentSample >= samples.length) {
        // 所有采样完成：组合 文件大小 + 修改时间 + 采样MD5，再 hash 得到固定长度标识
        const sampledMd5 = spark.end()
        const fingerprint = `${file.size}-${file.lastModified}-${sampledMd5}`
        const finalMd5 = SparkMD5.hash(fingerprint)
        resolve(finalMd5)
        return
      }

      const sample = samples[currentSample]
      const chunk = file.slice(sample.start, sample.end)
      fileReader.readAsArrayBuffer(chunk)
    }

    fileReader.onload = (e) => {
      void (async () => {
        if (!e.target?.result) return
        spark.append(e.target.result as ArrayBuffer)
        currentSample += 1
        await yieldToMain() // 每读一个采样点让出主线程
        loadNext()
      })()
    }

    fileReader.onerror = () => {
      reject(new Error(i18n.t('common:fileErrors.readFailed')))
    }

    loadNext()
  })
}

/**
 * 计算文件的完整 MD5
 * 以 2MB 为步长逐块读取并追加到 SparkMD5，适用于小文件精确校验
 *
 * @param file 待计算的 File 对象
 * @returns 32 位十六进制 MD5 字符串
 */
export function calculateFullFileMD5(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const blobSlice = File.prototype.slice
    const chunkSize = 2097152 // 2MB
    const chunks = Math.ceil(file.size / chunkSize)
    let currentChunk = 0
    const spark = new SparkMD5.ArrayBuffer()
    const fileReader = new FileReader()

    function loadNext() {
      const start = currentChunk * chunkSize
      const end = Math.min(start + chunkSize, file.size)
      const chunk = blobSlice.call(file, start, end)
      fileReader.readAsArrayBuffer(chunk)
    }

    fileReader.onload = (e) => {
      void (async () => {
        if (!e.target?.result) return
        spark.append(e.target.result as ArrayBuffer)
        currentChunk += 1
        await yieldToMain()

        if (currentChunk < chunks) {
          loadNext()
        } else {
          const md5 = spark.end()
          resolve(md5)
        }
      })()
    }

    fileReader.onerror = () => {
      reject(new Error(i18n.t('common:fileErrors.readFailed')))
    }

    loadNext()
  })
}

/**
 * 智能选择 MD5 计算策略
 * - 小文件（< 100MB）：完整 MD5，精确匹配
 * - 大文件（≥ 100MB）：快速指纹，平衡速度与准确性
 *
 * @param file 待校验的 File 对象
 * @returns MD5 或快速指纹字符串
 */
export function calculateFileMD5(file: File): Promise<string> {
  if (file.size >= FAST_FINGERPRINT_THRESHOLD) {
    return calculateFastFingerprint(file)
  } else {
    return calculateFullFileMD5(file)
  }
}

/**
 * 计算 Blob（分片）的 MD5
 * 分片可能达 5MB+，内部再以 2MB 子块读取并定期 yield，避免卡死 UI
 *
 * @param blob 上传分片 Blob
 * @returns 分片 MD5 字符串
 */
export async function calculateBlobMD5(blob: Blob): Promise<string> {
  const innerChunk = 2 * 1024 * 1024
  const spark = new SparkMD5.ArrayBuffer()
  let offset = 0

  try {
    while (offset < blob.size) {
      const end = Math.min(offset + innerChunk, blob.size)
      const slice = blob.slice(offset, end)
      const buf = await slice.arrayBuffer()
      spark.append(buf)
      offset = end
      await yieldToMain()
    }
    return spark.end()
  } catch {
    throw new Error(i18n.t('common:fileErrors.chunkReadFailed'))
  }
}
