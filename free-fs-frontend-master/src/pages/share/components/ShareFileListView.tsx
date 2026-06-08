import { useTranslation } from 'react-i18next'
import type { FileItem } from '@/types/file'
import { Eye, Download } from 'lucide-react'
import { shareAllowsDownload, shareAllowsPreview } from '@/utils/share-scope'
import { cn } from '@/lib/utils'
import { formatFileSize, formatFileTime } from '@/utils/format'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { FileIcon } from '@/components/file-icon'

interface ShareFileListViewProps {
  fileList: FileItem[]
  scope?: string
  onFileClick: (file: FileItem) => void
  onPreview: (file: FileItem) => void
  onDownload: (file: FileItem) => void
}

export function ShareFileListView({
  fileList,
  scope,
  onFileClick,
  onPreview,
  onDownload,
}: ShareFileListViewProps) {
  const { t } = useTranslation('share')
  const hasPreviewPermission = () => shareAllowsPreview(scope)
  const hasDownloadPermission = () => shareAllowsDownload(scope)

  return (
    <div className='flex-1 overflow-auto'>
      <Table>
        <TableHeader>
          <TableRow className='bg-muted/50'>
            <TableHead className='font-medium text-muted-foreground'>
              {t('fileList.name')}
            </TableHead>
            <TableHead className='w-32 font-medium text-muted-foreground'>
              {t('fileList.size')}
            </TableHead>
            <TableHead className='w-48 font-medium text-muted-foreground'>
              {t('fileList.modified')}
            </TableHead>
            <TableHead className='w-40 text-center font-medium text-muted-foreground'>
              {t('fileList.actions')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fileList.map((file) => (
            <TableRow
              key={file.id}
              className={cn(
                'group transition-colors',
                file.isDir && 'cursor-pointer'
              )}
              onClick={() => {
                if (file.isDir) onFileClick(file)
              }}
            >
              <TableCell>
                <div className='flex items-center gap-3'>
                  <div className='flex h-8 w-8 items-center justify-center rounded'>
                    <FileIcon
                      type={file.isDir ? 'dir' : file.suffix || ''}
                      size={28}
                      className='shrink-0'
                    />
                  </div>
                  <span className='truncate text-sm font-normal text-foreground/90'>
                    {file.displayName}
                  </span>
                </div>
              </TableCell>
              <TableCell className='text-sm text-muted-foreground'>
                {formatFileSize(file.size ?? 0)}
              </TableCell>
              <TableCell className='text-sm text-muted-foreground'>
                {formatFileTime(file.updateTime)}
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <div className='flex items-center justify-center gap-1'>
                  {hasPreviewPermission() && (
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-8 w-8'
                      onClick={(e) => {
                        e.stopPropagation()
                        onPreview(file)
                      }}
                      title={
                        file.isDir
                          ? t('fileList.openFolder')
                          : t('fileList.preview')
                      }
                    >
                      <Eye className='h-4 w-4' />
                    </Button>
                  )}
                  {hasDownloadPermission() && (
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-8 w-8'
                      onClick={(e) => {
                        e.stopPropagation()
                        onDownload(file)
                      }}
                      title={t('fileList.download')}
                    >
                      <Download className='h-4 w-4' />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
