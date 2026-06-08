import { getDashboard } from '@/api/dashboard'

import { getHomeInfo } from '@/api/home'



export type AgentContextResult = {

  text: string

  loaded: boolean

}



function formatSize(bytes: number): string {

  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`

  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`

  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`

  return `${bytes} B`

}



/** 为 Agent 模式拉取当前工作空间摘要，注入模型上下文 */

export async function buildAgentContext(): Promise<AgentContextResult> {

  try {

    const [dash, home] = await Promise.all([

      getDashboard({ unit: 2 }),

      getHomeInfo({ unit: 2, dateType: 2 }),

    ])

    const unit = dash.unit ?? home.unit ?? 'MB'

    const lines: string[] = [

      `已用存储：${dash.usedStorage ?? home.usedStorage ?? 0} ${unit}`,

      `文件数：${dash.fileCount ?? 0}，文件夹：${dash.folderCount ?? 0}`,

      `分享数：${dash.shareCount ?? 0}，回收站：${dash.recycleCount ?? 0}`,

      `今日上传：${dash.uploadTodayCount ?? 0} 个`,

    ]



    const trend = dash.trend7d ?? home.usedBytes ?? []

    if (trend.length > 0) {

      lines.push('近7日存储趋势：')

      for (const p of trend.slice(-7)) {

        lines.push(`- ${p.date}: ${p.usedBytes} ${unit}`)

      }

    }



    const recent = home.recentFiles?.slice(0, 8) ?? []

    if (recent.length > 0) {

      lines.push('最近文件：')

      for (const f of recent) {

        const name = f.displayName || f.originalName || '未命名'

        const type = f.isDir ? '文件夹' : f.suffix ? `.${f.suffix}` : '文件'

        const size = typeof f.size === 'number' ? formatSize(f.size) : ''

        lines.push(`- ${name}（${type}${size ? `, ${size}` : ''}）`)

      }

    }



    if (dash.updatedAt) {

      lines.push(`数据更新时间：${dash.updatedAt}`)

    }



    return { text: lines.join('\n'), loaded: lines.length > 0 }

  } catch {

    return { text: '', loaded: false }

  }

}


