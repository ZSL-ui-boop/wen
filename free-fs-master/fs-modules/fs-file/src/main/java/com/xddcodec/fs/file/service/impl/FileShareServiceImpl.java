package com.xddcodec.fs.file.service.impl;

import cn.dev33.satoken.stp.StpUtil;
import cn.hutool.core.collection.CollUtil;
import cn.hutool.core.util.RandomUtil;
import cn.hutool.core.util.StrUtil;
import com.mybatisflex.core.paginate.Page;
import com.mybatisflex.core.query.QueryWrapper;
import com.mybatisflex.spring.service.impl.ServiceImpl;
import com.xddcodec.fs.file.domain.FileInfo;
import com.xddcodec.fs.file.domain.FileShare;
import com.xddcodec.fs.file.domain.FileShareItem;
import com.xddcodec.fs.file.domain.dto.CreateFileShareAccessRecordCmd;
import com.xddcodec.fs.file.domain.dto.CreateShareCmd;
import com.xddcodec.fs.file.domain.dto.VerifyShareCodeCmd;
import com.xddcodec.fs.file.domain.event.CreateFileShareAccessRecordEvent;
import com.xddcodec.fs.file.domain.qry.FileShareQry;
import com.xddcodec.fs.file.domain.vo.FileDownloadVO;
import com.xddcodec.fs.file.domain.vo.FileShareThinVO;
import com.xddcodec.fs.file.domain.vo.FileShareVO;
import com.xddcodec.fs.file.domain.vo.FileVO;
import com.xddcodec.fs.file.domain.vo.ShareBreadcrumbVO;
import com.xddcodec.fs.file.mapper.FileShareMapper;
import com.xddcodec.fs.file.service.FileInfoService;
import com.xddcodec.fs.file.service.FileShareItemService;
import com.xddcodec.fs.file.service.FileShareService;
import com.xddcodec.fs.framework.common.context.WorkspaceContext;
import com.xddcodec.fs.framework.common.domain.PageResult;
import com.xddcodec.fs.framework.common.exception.BusinessException;
import com.xddcodec.fs.framework.common.utils.I18nUtils;
import com.xddcodec.fs.framework.common.utils.Ip2RegionUtils;
import com.xddcodec.fs.framework.common.utils.IpUtils;
import com.xddcodec.fs.framework.common.utils.StringUtils;
import com.xddcodec.fs.storage.facade.StorageServiceFacade;
import com.xddcodec.fs.storage.plugin.core.IStorageOperationService;
import io.github.linpeilie.Converter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.InputStreamResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.BufferedOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static com.xddcodec.fs.file.domain.table.FileShareTableDef.FILE_SHARE;

/**
 * 文件分享服务实现类
 *
 * @Author: xddcode
 * @Date: 2025/10/30 10:02
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FileShareServiceImpl extends ServiceImpl<FileShareMapper, FileShare> implements FileShareService {

    private final FileInfoService fileInfoService;

    private final FileShareItemService fileShareItemService;

    private final Converter converter;

    private final ApplicationEventPublisher eventPublisher;

    @Autowired
    private StorageServiceFacade storageServiceFacade;

    private static final String CACHE_NAME = "share";

    @Override
    public PageResult<FileShareVO> getPages(FileShareQry qry) {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        int page = qry.getPage() == null ? 1 : qry.getPage();
        int pageSize = qry.getPageSize() == null ? 10 : qry.getPageSize();

        Page<FileShare> p = new Page<>(page, pageSize);

        QueryWrapper wrapper = new QueryWrapper();
        wrapper.where(FILE_SHARE.WORKSPACE_ID.eq(workspaceId));

        if (StringUtils.isNotEmpty(qry.getKeyword())) {
            String keyword = "%" + qry.getKeyword().trim() + "%";
            wrapper.and(FILE_SHARE.SHARE_NAME.like(keyword));
        }
        if (StringUtils.isEmpty(qry.getOrderBy()) || StringUtils.isEmpty(qry.getOrderDirection())) {
            wrapper.orderBy(FILE_SHARE.CREATED_AT.desc());
        } else {
            String orderBy = StrUtil.toUnderlineCase(qry.getOrderBy());
            boolean isAsc = "ASC".equalsIgnoreCase(qry.getOrderDirection());
            wrapper.orderBy(orderBy, isAsc);
        }
        this.page(p, wrapper);
        List<FileShare> fileShares = p.getRecords();
        List<FileShareVO> fileShareVOS = converter.convert(fileShares, FileShareVO.class);

        return PageResult.success(fileShareVOS, p.getTotalRow());
    }

    @Override
//    @Cacheable(value = CACHE_NAME, key = "#shareId", unless = "#result == null", sync = true)
    public FileShareVO getDetail(String shareId) {
        FileShare share = this.getById(shareId);
        if (share == null) {
            throw new BusinessException(I18nUtils.getMessage("share.not.exist"));
        }
        return buildShareVO(share);
    }

    /**
     * 构建分享VO
     */
    private FileShareVO buildShareVO(FileShare share) {
        FileShareVO vo = converter.convert(share, FileShareVO.class);
        // 是否永久有效
        vo.setIsPermanent(share.getExpireTime() == null);
        // 查询有几个文件
        vo.setFileCount(fileShareItemService.countByShareId(share.getId()));
        // 判断是否到期
        return vo;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public FileShareVO createShare(CreateShareCmd cmd) {
        String userId = StpUtil.getLoginIdAsString();
        String workspaceId = WorkspaceContext.getWorkspaceId();
        FileShare share = new FileShare();
        share.setUserId(userId);
        share.setWorkspaceId(workspaceId);
        share.setViewCount(0);
        share.setDownloadCount(0);

        if (StrUtil.isNotBlank(cmd.getShareName())) {
            share.setShareName(cmd.getShareName());
        } else {
            FileInfo fileInfo = fileInfoService.getById(cmd.getFileIds().getFirst());
            // 默认取第一个文件名，如果是多个文件则显示第一个文件名+"等{数量}"文件
            if (cmd.getFileIds().size() > 1) {
                if (fileInfo != null) {
                    share.setShareName(fileInfo.getDisplayName() + "等" + cmd.getFileIds().size() + "个文件");
                }
            } else {
                if (fileInfo != null) {
                    share.setShareName(fileInfo.getDisplayName());
                }
            }
        }
        if (cmd.getExpireType() == 4) {
            share.setExpireTime(null);
        } else if (cmd.getExpireType() == 3) {
            share.setExpireTime(cmd.getExpireTime());
        } else {
            share.setExpireTime(calculateExpireTime(cmd.getExpireType()));
        }

        if (cmd.getNeedShareCode()) {
            share.setShareCode(RandomUtil.randomString(4));
        }

        share.setScope(cmd.getScope());
        share.setMaxViewCount(cmd.getMaxViewCount());
        share.setMaxDownloadCount(cmd.getMaxDownloadCount());

        if (StringUtils.isEmpty(share.getWorkspaceId()) && CollUtil.isNotEmpty(cmd.getFileIds())) {
            FileInfo anchor = fileInfoService.getById(cmd.getFileIds().getFirst());
            if (anchor != null && StrUtil.isNotBlank(anchor.getWorkspaceId())) {
                share.setWorkspaceId(anchor.getWorkspaceId());
            }
        }

        this.save(share);

        fileShareItemService.saveShareItems(share.getId(), cmd.getFileIds());

        // 更新被分享文件的访问时间
        updateFileLastAccessTime(cmd.getFileIds());

        return buildShareVO(share);
    }


    /**
     * 更新文件最后访问时间
     *
     * @param fileIds 文件ID列表
     */
    private void updateFileLastAccessTime(List<String> fileIds) {
        if (fileIds == null || fileIds.isEmpty()) {
            return;
        }
        LocalDateTime now = LocalDateTime.now();
        fileIds.forEach(fileId -> {
            FileInfo fileInfo = new FileInfo();
            fileInfo.setId(fileId);
            fileInfo.setLastAccessTime(now);
            fileInfoService.updateById(fileInfo);
        });
    }

    /**
     * 计算过期时间
     */
    private static LocalDateTime calculateExpireTime(Integer expireType) {
        LocalDateTime now = LocalDateTime.now();
        return switch (expireType) {
            case 1 -> now.plusDays(7);
            case 2 -> now.plusDays(30);
            default -> now.plusDays(7);
        };
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void cancelShares(List<String> ids) {
        if (CollUtil.isEmpty(ids)) {
            return;
        }
        this.removeByIds(ids);
        fileShareItemService.remove(new QueryWrapper().in(FileShareItem::getShareId, ids));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void cancelAllShares() {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        List<FileShare> shareIds = this.list(new QueryWrapper().where(FILE_SHARE.WORKSPACE_ID.eq(workspaceId)));
        List<String> shareIdList = shareIds.stream().map(FileShare::getId).toList();
        this.cancelShares(shareIdList);
    }

    @Override
    public boolean verifyShareCode(VerifyShareCodeCmd cmd) {
        // 故意延迟200ms，增加暴力破解成本
        try {
            Thread.sleep(200);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        FileShareVO share = this.getDetail(cmd.getShareId());
        if (share == null) {
            throw new BusinessException(I18nUtils.getMessage("share.not.exist"));
        }

        if (!share.getShareCode().equals(cmd.getShareCode())) {
            throw new BusinessException(I18nUtils.getMessage("share.code.incorrect"));
        }
        return true;
    }

    @Override
    public FileShareThinVO getFileShareThinVO(String shareId) {
        FileShare fileShare = this.getById(shareId);
        if (fileShare == null) {
            throw new BusinessException(I18nUtils.getMessage("share.not.exist"));
        }
        FileShareThinVO vo = converter.convert(fileShare, FileShareThinVO.class);
        vo.setHasCheckCode(StringUtils.isNotEmpty(fileShare.getShareCode()));
        // 查询有几个文件
        vo.setFileCount(fileShareItemService.countByShareId(shareId));
        // 判断是否到期
        LocalDateTime expireTime = fileShare.getExpireTime();
        if (expireTime == null) {
            // 永久有效
            vo.setIsExpire(false);
        } else {
            LocalDateTime now = LocalDateTime.now();
            vo.setIsExpire(now.isAfter(expireTime));
        }
        return vo;
    }

    @Override
    public List<FileVO> getShareFileItems(String shareId, String parentId) {
        parentId = StrUtil.trim(parentId);
        FileShare fileShare = this.getById(shareId);
        if (fileShare == null) {
            throw new BusinessException(I18nUtils.getMessage("share.not.exist.or.deleted"));
        }
        List<String> shareRootIds = fileShareItemService.getShareFileIds(shareId);
        recordShareAccessLog(shareId);

        String listWorkspaceId = resolveShareListWorkspaceId(fileShare, shareRootIds, parentId);
        if (StringUtils.isEmpty(parentId)) {
            List<FileVO> items = fileInfoService.getByFileIds(shareRootIds);
            fillFolderAggregateSizes(items);
            return items;
        }
        if (!isUnderSharedTree(shareRootIds, parentId, listWorkspaceId)) {
            throw new BusinessException(I18nUtils.getMessage("share.file.not.in.share"));
        }
        List<FileVO> items = fileInfoService.listChildrenByParentIdLenient(parentId);
        fillFolderAggregateSizes(items);
        return items;
    }

    @Override
    public List<ShareBreadcrumbVO> getShareBreadcrumb(String shareId, String parentId) {
        parentId = StrUtil.trim(parentId);
        if (StringUtils.isEmpty(parentId)) {
            return List.of();
        }
        FileShare fileShare = this.getById(shareId);
        if (fileShare == null) {
            throw new BusinessException(I18nUtils.getMessage("share.not.exist.or.deleted"));
        }
        List<String> shareRootIds = fileShareItemService.getShareFileIds(shareId);
        String listWorkspaceId = resolveShareListWorkspaceId(fileShare, shareRootIds, parentId);
        if (!isUnderSharedTree(shareRootIds, parentId, listWorkspaceId)) {
            throw new BusinessException(I18nUtils.getMessage("share.file.not.in.share"));
        }
        LinkedList<FileInfo> chain = new LinkedList<>();
        String cursor = parentId;
        for (int depth = 0; depth < 1000 && StrUtil.isNotBlank(cursor); depth++) {
            FileInfo node = fileInfoService.getById(cursor);
            if (node == null) {
                break;
            }
            chain.addFirst(node);
            if (shareRootIds.contains(node.getId())) {
                break;
            }
            if (StringUtils.isEmpty(node.getParentId())) {
                break;
            }
            cursor = node.getParentId();
        }
        if (chain.isEmpty() || !shareRootIds.contains(chain.getFirst().getId())) {
            throw new BusinessException(I18nUtils.getMessage("share.file.not.in.share"));
        }
        List<ShareBreadcrumbVO> out = new ArrayList<>(chain.size());
        for (FileInfo n : chain) {
            ShareBreadcrumbVO vo = new ShareBreadcrumbVO();
            vo.setId(n.getId());
            vo.setName(StrUtil.blankToDefault(n.getDisplayName(), n.getOriginalName()));
            out.add(vo);
        }
        return out;
    }

    /**
     * 分享列表/子目录查询使用的工作空间：优先当前目录节点上的 workspace（与 file_info 一致），
     * 避免 file_shares.workspace_id 为空或与文件表不一致时 listChildren 恒为空。
     */
    private String resolveShareListWorkspaceId(FileShare fileShare, List<String> shareRootIds, String parentId) {
        if (StrUtil.isNotBlank(parentId)) {
            FileInfo parent = fileInfoService.getById(parentId);
            if (parent != null && StrUtil.isNotBlank(parent.getWorkspaceId())) {
                return parent.getWorkspaceId();
            }
        }
        if (StrUtil.isNotBlank(fileShare.getWorkspaceId())) {
            return fileShare.getWorkspaceId();
        }
        if (CollUtil.isNotEmpty(shareRootIds)) {
            FileInfo anchor = fileInfoService.getById(shareRootIds.getFirst());
            if (anchor != null && StrUtil.isNotBlank(anchor.getWorkspaceId())) {
                return anchor.getWorkspaceId();
            }
        }
        return "";
    }

    private void fillFolderAggregateSizes(List<FileVO> items) {
        if (CollUtil.isEmpty(items)) {
            return;
        }
        for (FileVO vo : items) {
            if (!Boolean.TRUE.equals(vo.getIsDir())) {
                continue;
            }
            try {
                vo.setSize(fileInfoService.sumFileSizesUnderDirectoryTree(vo.getId()));
            } catch (Exception e) {
                log.warn("分享列表：统计文件夹大小失败 folderId={}", vo.getId(), e);
            }
        }
    }

    /**
     * 判断 fileId 是否落在分享根目录及其子树内（分享表只存根条目 ID）
     */
    private boolean isUnderSharedTree(List<String> shareRootIds, String fileId, String workspaceId) {
        if (CollUtil.isEmpty(shareRootIds) || StringUtils.isEmpty(fileId)) {
            return false;
        }
        if (shareRootIds.contains(fileId)) {
            return true;
        }
        FileInfo node = fileInfoService.getById(fileId);
        for (int depth = 0; node != null && depth < 1000; depth++) {
            if (Boolean.TRUE.equals(node.getIsDeleted())) {
                return false;
            }
            // 仅当两端 workspace 都有值且不一致时判越界；任一端为 null 时不因 workspace 误判（历史数据/导入）
            if (StrUtil.isNotBlank(workspaceId) && StrUtil.isNotBlank(node.getWorkspaceId())
                    && !workspaceId.equals(node.getWorkspaceId())) {
                return false;
            }
            if (shareRootIds.contains(node.getId())) {
                return true;
            }
            if (StringUtils.isEmpty(node.getParentId())) {
                return false;
            }
            node = fileInfoService.getById(node.getParentId());
        }
        return false;
    }

    @Override
    public FileDownloadVO downloadFiles(String shareId, String fileId) {
        FileShare fileShare = this.getById(shareId);
        if (fileShare == null) {
            throw new BusinessException(I18nUtils.getMessage("share.not.exist.or.deleted"));
        }
        List<String> shareRootIds = fileShareItemService.getShareFileIds(shareId);
        FileInfo fileInfo = fileInfoService.getById(fileId);
        if (fileInfo == null) {
            throw new BusinessException(I18nUtils.getMessage("file.download.failed.not.exist"));
        }
        String treeWorkspaceId = StrUtil.isNotBlank(fileInfo.getWorkspaceId())
                ? fileInfo.getWorkspaceId()
                : resolveShareListWorkspaceId(fileShare, shareRootIds, fileInfo.getParentId());
        if (StrUtil.isBlank(treeWorkspaceId)) {
            treeWorkspaceId = fileShare.getWorkspaceId();
        }
        if (!isUnderSharedTree(shareRootIds, fileId, treeWorkspaceId)) {
            throw new BusinessException(I18nUtils.getMessage("share.file.not.in.share"));
        }
        if (Boolean.TRUE.equals(fileInfo.getIsDir())) {
            return buildShareFolderZipDownload(fileInfo);
        }

        IStorageOperationService storageService = storageServiceFacade.getStorageService(fileInfo.getStoragePlatformSettingId());

        if (!storageService.isFileExist(fileInfo.getObjectKey())) {
            throw new BusinessException(I18nUtils.getMessage("file.download.failed.not.exist"));
        }

        InputStream inputStream = storageService.downloadFile(fileInfo.getObjectKey());
        InputStreamResource resource = new InputStreamResource(inputStream);

        FileDownloadVO downloadVO = new FileDownloadVO();
        downloadVO.setFileName(fileInfo.getDisplayName());
        downloadVO.setFileSize(fileInfo.getSize());
        downloadVO.setResource(resource);
        return downloadVO;
    }

    /**
     * 分享链接下载文件夹：在内存中同步打成 ZIP，避免管道流 + 守护线程与 Spring 响应顺序竞态导致空/损坏压缩包。
     */
    private FileDownloadVO buildShareFolderZipDownload(FileInfo rootFolder) {
        List<FileInfo> descendants = fileInfoService.listAllDescendants(rootFolder.getId());
        Map<String, FileInfo> byId = new HashMap<>(descendants.size() + 1);
        byId.put(rootFolder.getId(), rootFolder);
        for (FileInfo n : descendants) {
            byId.put(n.getId(), n);
        }
        List<FileInfo> allFiles = new ArrayList<>();
        for (FileInfo n : descendants) {
            if (!Boolean.TRUE.equals(n.getIsDir())) {
                allFiles.add(n);
            }
        }
        List<FileInfo> packable = new ArrayList<>();
        for (FileInfo f : allFiles) {
            if (StrUtil.isBlank(f.getObjectKey())) {
                continue;
            }
            IStorageOperationService storageService = storageServiceFacade.getStorageService(f.getStoragePlatformSettingId());
            if (storageService.isFileExist(f.getObjectKey())) {
                packable.add(f);
            } else {
                log.warn("分享打包跳过缺失对象 fileId={}", f.getId());
            }
        }
        if (CollUtil.isEmpty(packable)) {
            throw new BusinessException(I18nUtils.getMessage("share.folder.zip.empty"));
        }

        String baseName = StrUtil.blankToDefault(rootFolder.getDisplayName(), "folder");
        String zipFileName = baseName.toLowerCase().endsWith(".zip") ? baseName + "_files.zip" : baseName + ".zip";

        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream(65536);
            try (BufferedOutputStream bos = new BufferedOutputStream(baos);
                 ZipOutputStream zos = new ZipOutputStream(bos, StandardCharsets.UTF_8)) {
                writeShareZipEntries(rootFolder, packable, byId, zos);
            }
            byte[] zipBytes = baos.toByteArray();

            FileDownloadVO downloadVO = new FileDownloadVO();
            downloadVO.setFileName(zipFileName);
            downloadVO.setFileSize((long) zipBytes.length);
            downloadVO.setResource(new ByteArrayResource(zipBytes));
            return downloadVO;
        } catch (IOException e) {
            log.error("分享目录打包失败 folderId={}", rootFolder.getId(), e);
            throw new BusinessException(I18nUtils.getMessage("file.download.failed.not.exist"));
        }
    }

    private void writeShareZipEntries(FileInfo rootFolder, List<FileInfo> files, Map<String, FileInfo> byId, ZipOutputStream zos)
            throws IOException {
        Set<String> usedEntryNames = new HashSet<>();
        for (FileInfo file : files) {
            if (StrUtil.isBlank(file.getObjectKey())) {
                continue;
            }
            IStorageOperationService storageService = storageServiceFacade.getStorageService(file.getStoragePlatformSettingId());
            String entryName = uniquifyZipEntry(buildZipEntryRelativePath(rootFolder, file, byId), usedEntryNames);
            zos.putNextEntry(new ZipEntry(entryName));
            try (InputStream in = storageService.downloadFile(file.getObjectKey())) {
                in.transferTo(zos);
            }
            zos.closeEntry();
        }
    }

    private static String sanitizeZipSegment(String name) {
        if (StrUtil.isBlank(name)) {
            return "unnamed";
        }
        String s = name.trim().replace('\\', '_').replace('/', '_');
        if (".".equals(s) || "..".equals(s)) {
            return "invalid";
        }
        return s;
    }

    private static String buildZipEntryRelativePath(FileInfo rootFolder, FileInfo file, Map<String, FileInfo> byId) {
        LinkedList<String> segments = new LinkedList<>();
        FileInfo cur = file;
        int guard = 0;
        while (cur != null && !rootFolder.getId().equals(cur.getId()) && guard++ < 500) {
            segments.addFirst(sanitizeZipSegment(cur.getDisplayName()));
            String pid = cur.getParentId();
            cur = StrUtil.isBlank(pid) ? null : byId.get(pid);
        }
        if (segments.isEmpty()) {
            return sanitizeZipSegment(file.getDisplayName());
        }
        return String.join("/", segments);
    }

    private static String uniquifyZipEntry(String base, Set<String> used) {
        if (!used.contains(base)) {
            used.add(base);
            return base;
        }
        int dot = base.lastIndexOf('.');
        String stem = dot > 0 ? base.substring(0, dot) : base;
        String ext = dot > 0 ? base.substring(dot) : "";
        int i = 1;
        String candidate;
        do {
            candidate = stem + "(" + i + ")" + ext;
            i++;
        } while (used.contains(candidate));
        used.add(candidate);
        return candidate;
    }

    /**
     * 记录分享访问日志
     *
     * @param shareId 分享ID
     */
    private void recordShareAccessLog(String shareId) {
        String ip = IpUtils.getIpAddr();
        String address = Ip2RegionUtils.search(ip);
        String browser = IpUtils.getBrowser();
        String os = IpUtils.getOs();
        CreateFileShareAccessRecordCmd cmd = new CreateFileShareAccessRecordCmd();
        cmd.setShareId(shareId);
        cmd.setAccessIp(ip);
        cmd.setAccessAddress(address);
        cmd.setBrowser(browser);
        cmd.setOs(os);
        eventPublisher.publishEvent(new CreateFileShareAccessRecordEvent(this, cmd));
    }

    /**
     * 原子递增访问次数
     */
//    private void incrementViewCount(String shareId) {
//        String key = VIEW_COUNT_KEY + shareId;
//        Long count = redisTemplate.opsForValue().increment(key);
//
//        if (count == null) {
//            return;
//        }
//        // 第一次访问时设置过期时间（与分享有效期一致，或者永不过期）
//        if (count == 1) {
//            // 选项1: 永不过期
//            // redisTemplate.persist(key);
//
//            // 选项2: 与分享有效期同步（推荐）
//            setExpireTimeByShareExpiry(shareId, key);
//        }
//    }
}
