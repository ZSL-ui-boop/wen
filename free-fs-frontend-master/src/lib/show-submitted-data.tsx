/**
 * 表单调试工具
 * 以 Toast 形式展示提交的 JSON 数据，常用于开发调试
 */
import { toast } from 'sonner'

/**
 * 弹出 Toast 展示表单提交数据
 * @param data - 待展示的任意数据（会 JSON 序列化）
 * @param title - Toast 标题
 */
export function showSubmittedData(
  data: unknown,
  title: string = 'You submitted the following values:'
) {
  toast.message(title, {
    description: (
      // w-[340px]
      <pre className='mt-2 w-full overflow-x-auto rounded-md bg-slate-950 p-4'>
        <code className='text-white'>{JSON.stringify(data, null, 2)}</code>
      </pre>
    ),
  })
}
