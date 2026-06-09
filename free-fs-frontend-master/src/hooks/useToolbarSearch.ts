/**
 * 工具栏搜索 Hook
 *
 * 统一管理搜索输入框与 URL query 的同步：
 * - searchInput：随按键变化，不触发列表请求
 * - searchKeyword：回车/提交后生效，用于接口查询
 * - commitSearch：写入 URL 并与浏览器前进/后退同步
 */
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom'

/**
 * 工具栏搜索状态与提交逻辑
 *
 * @param paramName URL query 参数名，默认 keyword
 */
export function useToolbarSearch(paramName = 'keyword') {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const urlValue = searchParams.get(paramName) || ''
  const [searchInput, setSearchInput] = useState(urlValue)
  const [searchKeyword, setSearchKeyword] = useState(urlValue)

  // URL 变化（如浏览器后退）时同步本地状态
  useEffect(() => {
    setSearchKeyword(urlValue)
    setSearchInput(urlValue)
  }, [urlValue])

  /**
   * 提交搜索：更新 keyword 状态并写入 URL（replace 避免堆叠历史）
   *
   * @param keyword 搜索关键词，空字符串时删除 query 参数
   */
  const commitSearch = useCallback(
    (keyword: string) => {
      setSearchKeyword(keyword)
      setSearchInput(keyword)
      const params = new URLSearchParams(searchParams)
      if (keyword) {
        params.set(paramName, keyword)
      } else {
        params.delete(paramName)
      }
      navigate(`${pathname}?${params.toString()}`, { replace: true })
    },
    [searchParams, navigate, pathname, paramName]
  )

  return {
    searchInput,
    setSearchInput,
    searchKeyword,
    commitSearch,
  }
}
