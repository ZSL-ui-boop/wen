/**
 * 公开分享页（匿名访问）
 * 支持提取码验证、目录浏览、文件预览与 blob 下载
 */
import { useState, useEffect, useCallback, Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import type { FileItem } from '@/types/file'
import type { ShareThin } from '@/types/share'
import {
  Clock,
  Lock,
  RefreshCw,
  XCircle,
  FileText,
  List,
  LayoutGrid,
  Share2,
} from 'lucide-react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  getShareDetail,
  validateShareCode,
  getShareItemList,
  getShareBreadcrumb,
  downloadShareFile,
  parseShareDownloadResponse,
  extractShareDownloadError,
} from '@/api/share'
import { getAvatarFallback } from '@/utils/avatar'
import { openFilePreviewWithToken } from '@/utils/preview'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { FileIcon } from '@/components/file-icon'
import { ShareFileListView, ShareFileGridView } from './components'

type ViewMode = 'list' | 'grid'

interface BreadcrumbItem {
  name: string
  id: string
}

/** 分享链接访问页面，路由参数 shareToken 标识分享 */
export default function SharePage() {
  const { t } = useTranslation('share')
  const { shareToken } = useParams<{ shareToken: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [isVerified, setIsVerified] = useState(false)
  const [accessCode, setAccessCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [shareData, setShareData] = useState<ShareThin>({
    id: '',
    shareName: '',
    expireTime: '',
    hasCheckCode: false,
    isExpire: false,
  })
  const [fileList, setFileList] = useState<FileItem[]>([])
  const [bodyLoading, setBodyLoading] = useState(false)
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>(
    (searchParams.get('viewMode') as ViewMode) || 'list'
  )

  const parentId = searchParams.get('parentId') || undefined

  // 验证提取码
  const handleVerify = async () => {
    if (!accessCode.trim()) {
      toast.warning(t('toast.enterCode'))
      return
    }
    setVerifying(true)
    try {
      const result = await validateShareCode({
        shareId: shareToken!,
        shareCode: accessCode,
      })
      if (result) {
        setIsVerified(true)
        const params = new URLSearchParams(searchParams)
        params.set('shareCode', accessCode)
        navigate(`/s/${shareToken}?${params.toString()}`, { replace: true })
      } else {
        toast.error(t('toast.codeWrong'))
      }
    } finally {
      setVerifying(false)
    }
  }

  // 获取分享信息
  const fetchShare = async () => {
    setIsLoading(true)
    setHasError(false)
    setErrorMessage('')

    try {
      const data = await getShareDetail(shareToken!)
      setShareData(data)

      if (data.isExpire) {
        setIsLoading(false)
        return
      }

      if (!data.hasCheckCode) {
        setIsVerified(true)
      } else {
        const urlCode = searchParams.get('shareCode')
        if (urlCode) {
          setAccessCode(urlCode)
          handleVerify()
        }
      }
    } catch (error: any) {
      setHasError(true)
      if (
        error.message?.includes('Network Error') ||
        error.code === 'ERR_NETWORK'
      ) {
        setErrorMessage(t('errors.network'))
      } else if (error.response?.status === 404) {
        setErrorMessage(t('errors.notFound'))
      } else if (error.response?.status >= 500) {
        setErrorMessage(t('errors.server'))
      } else {
        setErrorMessage(error.message || t('errors.generic'))
      }
    } finally {
      setIsLoading(false)
    }
  }

  /** 同步面包屑 + 拉取当前目录文件列表（刷新、直达带 parentId 的链接时与 URL 一致） */
  const loadShareBrowse = useCallback(async () => {
    if (!shareToken || !isVerified) return
    setBodyLoading(true)
    try {
      if (parentId) {
        try {
          const path = await getShareBreadcrumb(shareToken, parentId)
          setBreadcrumbs(path.map((p) => ({ id: p.id, name: p.name ?? '' })))
        } catch {
          setBreadcrumbs([])
        }
      } else {
        setBreadcrumbs([])
      }
      const data = await getShareItemList(shareToken, parentId)
      setFileList(Array.isArray(data) ? data : [])
    } catch {
      setFileList([])
      toast.error(t('errors.generic'))
    } finally {
      setBodyLoading(false)
    }
  }, [shareToken, isVerified, parentId, t])

  // 处理文件点击
  const handleFileClick = (file: FileItem) => {
    if (!file.isDir || !shareToken) return
    const params = new URLSearchParams(searchParams)
    params.set('parentId', file.id)
    params.set('viewMode', viewMode)
    navigate(`/s/${shareToken}?${params.toString()}`)
  }

  const handleGoShareRoot = () => {
    if (!shareToken) return
    const params = new URLSearchParams(searchParams)
    params.delete('parentId')
    params.set('viewMode', viewMode)
    navigate(`/s/${shareToken}?${params.toString()}`)
  }

  const navigateToShareFolder = (folderId: string) => {
    if (!shareToken) return
    const params = new URLSearchParams(searchParams)
    params.set('parentId', folderId)
    params.set('viewMode', viewMode)
    navigate(`/s/${shareToken}?${params.toString()}`)
  }

  // 格式化到期时间
  const formatExpireTime = useCallback(
    (expireTime: string | null) => {
      if (!expireTime) return t('expire.permanent')

      const expireDate = new Date(expireTime)
      const now = new Date()
      const diffTime = expireDate.getTime() - now.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      if (diffDays < 0) return t('expire.expired')
      if (diffDays === 0) return t('expire.today')
      if (diffDays === 1) return t('expire.tomorrow')
      if (diffDays <= 7) return t('expire.inDays', { days: diffDays })

      const year = expireDate.getFullYear()
      const month = String(expireDate.getMonth() + 1).padStart(2, '0')
      const day = String(expireDate.getDate()).padStart(2, '0')
      return t('expire.onDate', { date: `${year}/${month}/${day}` })
    },
    [t]
  )

  // 处理预览（文件夹：进入目录浏览；文件：打开预览页）
  const handlePreview = async (file: FileItem) => {
    if (file.isDir) {
      handleFileClick(file)
      return
    }
    await openFilePreviewWithToken(file.id, import.meta.env.VITE_API_BASE_URL)
  }

  // 处理下载（分享接口已匿名放行，使用 blob 下载，避免把 Token 拼进 URL）
  const handleDownload = async (file: FileItem) => {
    if (!shareToken) return
    try {
      const res = await downloadShareFile(shareToken, file.id)
      const blob = await parseShareDownloadResponse(res)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const base = file.originalName || file.displayName || 'download'
      link.download = file.isDir
        ? `${base.replace(/\.zip$/i, '')}.zip`
        : base
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success(t('toast.downloadStart'))
    } catch (err: unknown) {
      const apiMsg = await extractShareDownloadError(err)
      if (apiMsg) {
        toast.error(apiMsg)
        return
      }
      if (err instanceof Error && err.message === 'EMPTY_BLOB') {
        toast.error(t('toast.downloadEmpty'))
        return
      }
      toast.error(t('toast.downloadFail'))
    }
  }

  useEffect(() => {
    if (shareToken) {
      fetchShare()
    }
  }, [shareToken])

  useEffect(() => {
    if (!isVerified || !shareToken) return
    loadShareBrowse()
  }, [isVerified, shareToken, parentId, loadShareBrowse])

  // 加载中状态
  if (isLoading) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-gray-50'>
        <div className='text-center'>
          <div className='mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary'></div>
          <p className='text-muted-foreground'>{t('loading.fetching')}</p>
        </div>
      </div>
    )
  }

  // 错误状态
  if (hasError) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-gray-50 p-4'>
        <div className='w-full max-w-md rounded-2xl bg-white p-12 text-center shadow-lg'>
          <XCircle className='mx-auto mb-6 h-20 w-20 text-destructive opacity-80' />
          <h2 className='mb-3 text-2xl font-semibold'>{errorMessage}</h2>
          <p className='mb-6 text-muted-foreground'>{t('errorState.hint')}</p>
          <Button onClick={fetchShare}>
            <RefreshCw className='mr-2 h-4 w-4' />
            {t('errorState.reload')}
          </Button>
        </div>
      </div>
    )
  }

  // 已过期状态
  if (shareData.isExpire) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-gray-50 p-4'>
        <div className='w-full max-w-md rounded-2xl bg-white p-12 text-center shadow-lg'>
          <Clock className='mx-auto mb-6 h-20 w-20 text-muted-foreground opacity-60' />
          <h2 className='mb-3 text-2xl font-semibold'>{t('expired.title')}</h2>
          <p className='mb-6 text-muted-foreground'>{t('expired.desc')}</p>
          <div className='space-y-3 rounded-lg bg-muted p-5'>
            <div className='flex items-center justify-center gap-2 text-sm'>
              <Share2 className='h-4 w-4' />
              <span>{shareData.shareName}</span>
            </div>
            {shareData.expireTime && (
              <div className='flex items-center justify-center gap-2 text-sm text-muted-foreground'>
                <Clock className='h-4 w-4' />
                <span>
                  {t('expired.at', { time: shareData.expireTime })}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // 需要验证码状态
  if (!isVerified) {
    const avatarFallback = getAvatarFallback(
      shareData.shareName || t('verify.defaultBrand')
    )

    return (
      <div className='flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-gray-50 p-4'>
        <div className='w-full max-w-md rounded-2xl bg-white p-10 shadow-lg'>
          <div className='mb-8 text-center'>
            <Avatar className='mx-auto mb-4 h-16 w-16'>
              <AvatarFallback className='bg-sidebar-accent text-xl font-semibold text-sidebar-accent-foreground'>
                {avatarFallback}
              </AvatarFallback>
            </Avatar>
            <h2 className='mb-2 text-xl font-semibold'>
              {t('verify.title', {
                name: shareData.shareName || t('verify.defaultBrand'),
              })}
            </h2>
            <p className='text-muted-foreground'>{t('verify.needCode')}</p>
          </div>
          <div className='space-y-4'>
            <div className='relative'>
              <Lock className='absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
              <Input
                type='text'
                placeholder={t('verify.placeholder')}
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                className='pl-10'
              />
            </div>
            <Button
              className='w-full'
              onClick={handleVerify}
              disabled={verifying}
            >
              {verifying ? t('verify.verifying') : t('verify.submit')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // 文件浏览状态
  return (
    <div className='flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-gray-50 p-4'>
      <div
        className='flex w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-lg'
        style={{ maxHeight: '85vh', minHeight: '500px' }}
      >
        {/* 头部 */}
        <div className='flex items-center justify-between border-b bg-muted/30 px-8 py-6'>
          <div className='flex items-center gap-3'>
            <div className='rounded-xl bg-primary/10 p-3'>
              <Share2 className='h-8 w-8 text-primary' />
            </div>
            <div>
              <div className='text-lg font-semibold'>{shareData.shareName}</div>
              <div className='flex items-center gap-4 text-sm text-muted-foreground'>
                <span>
                  {parentId
                    ? t('browse.totalFiles', { count: fileList.length })
                    : t('browse.shareItemCount', {
                        count: shareData.fileCount ?? 1,
                      })}
                </span>
                {shareData.expireTime && (
                  <span className='flex items-center gap-1 rounded bg-muted px-2 py-0.5'>
                    <Clock className='h-3.5 w-3.5' />
                    {formatExpireTime(shareData.expireTime)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 面包屑导航 */}
        <div className='border-b bg-white px-8 py-3'>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink
                  onClick={handleGoShareRoot}
                  className='flex cursor-pointer items-center gap-1.5'
                >
                  <FileIcon type='folder' size={16} />
                  {t('browse.root')}
                </BreadcrumbLink>
              </BreadcrumbItem>
              {breadcrumbs.map((item) => (
                <Fragment key={item.id}>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink
                      onClick={() => navigateToShareFolder(item.id)}
                      className='cursor-pointer'
                    >
                      {item.name}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                </Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* 工具栏 */}
        <div className='flex items-center justify-between border-b px-8 py-3'>
          <span className='text-sm text-muted-foreground'>
            {t('browse.totalFiles', { count: fileList.length })}
          </span>
          <div className='flex items-center gap-2'>
            <ToggleGroup
              type='single'
              value={viewMode}
              onValueChange={(value) => value && setViewMode(value as ViewMode)}
            >
              <ToggleGroupItem value='list' aria-label={t('browse.listView')} size='sm'>
                <List className='h-4 w-4' />
              </ToggleGroupItem>
              <ToggleGroupItem value='grid' aria-label={t('browse.gridView')} size='sm'>
                <LayoutGrid className='h-4 w-4' />
              </ToggleGroupItem>
            </ToggleGroup>
            <Button variant='outline' size='sm' onClick={() => loadShareBrowse()}>
              <RefreshCw className='h-4 w-4' />
            </Button>
          </div>
        </div>

        {/* 文件列表 */}
        <div className='flex-1 overflow-auto p-4'>
          {bodyLoading ? (
            <div className='flex h-full items-center justify-center'>
              <div className='text-center'>
                <div className='mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary'></div>
                <p className='text-muted-foreground'>{t('loading.list')}</p>
              </div>
            </div>
          ) : fileList.length === 0 ? (
            <div className='flex h-full items-center justify-center'>
              <div className='text-center'>
                <FileText className='mx-auto mb-4 h-16 w-16 text-muted-foreground opacity-50' />
                <p className='text-muted-foreground'>{t('browse.empty')}</p>
                {parentId && (
                  <p className='mt-2 max-w-md text-sm text-muted-foreground/80'>
                    {t('browse.emptyFolderHint')}
                  </p>
                )}
              </div>
            </div>
          ) : viewMode === 'list' ? (
            <ShareFileListView
              fileList={fileList}
              scope={shareData.scope}
              onFileClick={handleFileClick}
              onPreview={handlePreview}
              onDownload={handleDownload}
            />
          ) : (
            <ShareFileGridView
              fileList={fileList}
              scope={shareData.scope}
              onFileClick={handleFileClick}
              onPreview={handlePreview}
              onDownload={handleDownload}
            />
          )}
        </div>

        {/* 底部 */}
        <div className='border-t bg-muted/20 px-8 py-3 text-center text-xs text-muted-foreground'>
          {t('browse.footer')}
        </div>
      </div>
    </div>
  )
}
