package com.xddcodec.fs.file.service.impl;

import cn.hutool.core.collection.CollUtil;
import com.mybatisflex.core.query.QueryWrapper;
import com.xddcodec.fs.file.domain.FileInfo;
import com.xddcodec.fs.file.domain.qry.FileHomeUsedBytesQry;
import com.xddcodec.fs.file.domain.qry.FileQry;
import com.xddcodec.fs.file.domain.vo.FileDashboardVO;
import com.xddcodec.fs.file.domain.vo.FileHomeUsedBytesVO;
import com.xddcodec.fs.file.domain.vo.FileHomeVO;
import com.xddcodec.fs.file.domain.vo.FileVO;
import com.xddcodec.fs.file.service.FileHomeService;
import com.xddcodec.fs.file.service.FileInfoService;
import com.xddcodec.fs.file.service.FileShareService;
import com.xddcodec.fs.framework.common.context.WorkspaceContext;
import com.xddcodec.fs.framework.common.domain.PageResult;
import com.xddcodec.fs.storage.plugin.core.context.StoragePlatformContextHolder;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static com.xddcodec.fs.file.domain.table.FileInfoTableDef.FILE_INFO;
import static com.xddcodec.fs.file.domain.table.FileShareTableDef.FILE_SHARE;

@Service
@RequiredArgsConstructor
public class FileHomeServiceImpl implements FileHomeService {

    private final FileInfoService fileInfoService;
    private final FileShareService fileShareService;

    @Override
    public FileHomeVO getFileHomes(FileHomeUsedBytesQry qry) {
        FileHomeVO fileHomeVO = new FileHomeVO();
        Long usedStorageBytes = fileInfoService.calculateUsedStorage();
        fileHomeVO.setUsedStorage(formatValue(usedStorageBytes, qry.getUnit()));
        fileHomeVO.setUnit(unitLabel(qry.getUnit()));

        //查询用户最近使用的文件
        FileQry fileQry = new FileQry();
        fileQry.setIsRecents(Boolean.TRUE);
        PageResult<FileVO> recentFiles = fileInfoService.getList(fileQry);
        fileHomeVO.setRecentFiles(recentFiles.getData().getRecords());

        List<FileHomeUsedBytesVO> usedBytes = getFileHomeUsedBytes(qry);
        fileHomeVO.setUsedBytes(usedBytes);
        return fileHomeVO;
    }

    @Override
    public FileDashboardVO getDashboard(FileHomeUsedBytesQry qry) {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        String storageId = StoragePlatformContextHolder.getConfigId();
        Integer unit = qry.getUnit() != null ? qry.getUnit() : 2;

        FileDashboardVO vo = new FileDashboardVO();
        Long usedStorageBytes = fileInfoService.calculateUsedStorage();
        vo.setUsedStorage(formatValue(usedStorageBytes, unit));
        vo.setUnit(unitLabel(unit));

        vo.setFileCount(countFiles(workspaceId, storageId, false, false));
        vo.setFolderCount(countFiles(workspaceId, storageId, true, false));
        vo.setRecycleCount(countFiles(workspaceId, storageId, null, true));
        vo.setShareCount(fileShareService.count(QueryWrapper.create()
                .where(FILE_SHARE.WORKSPACE_ID.eq(workspaceId))));
        vo.setUploadTodayCount(countUploadToday(workspaceId, storageId));

        FileHomeUsedBytesQry trendQry = new FileHomeUsedBytesQry();
        trendQry.setUnit(2);
        trendQry.setDateType(2);
        vo.setTrend7d(getFileHomeUsedBytes(trendQry));
        vo.setUpdatedAt(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
        return vo;
    }

    private long countFiles(String workspaceId, String storageId, Boolean isDir, boolean deleted) {
        QueryWrapper qw = QueryWrapper.create()
                .where(FILE_INFO.WORKSPACE_ID.eq(workspaceId))
                .and(FILE_INFO.STORAGE_PLATFORM_SETTING_ID.eq(storageId))
                .and(FILE_INFO.IS_DELETED.eq(deleted));
        if (isDir != null) {
            qw.and(FILE_INFO.IS_DIR.eq(isDir));
        }
        return fileInfoService.count(qw);
    }

    private long countUploadToday(String workspaceId, String storageId) {
        LocalDateTime start = LocalDateTime.now().with(LocalTime.MIN);
        LocalDateTime end = LocalDateTime.now().with(LocalTime.MAX);
        return fileInfoService.count(QueryWrapper.create()
                .where(FILE_INFO.WORKSPACE_ID.eq(workspaceId))
                .and(FILE_INFO.STORAGE_PLATFORM_SETTING_ID.eq(storageId))
                .and(FILE_INFO.IS_DIR.eq(false))
                .and(FILE_INFO.IS_DELETED.eq(false))
                .and(FILE_INFO.UPLOAD_TIME.between(start, end)));
    }

    public List<FileHomeUsedBytesVO> getFileHomeUsedBytes(FileHomeUsedBytesQry qry) {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        String storageId = StoragePlatformContextHolder.getConfigId();

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime endTime = now.with(LocalTime.MAX);
        LocalDateTime startTime = calculateStartTime(qry.getDateType(), now);

        QueryWrapper queryWrapper = QueryWrapper.create()
                .select(FILE_INFO.UPLOAD_TIME, FILE_INFO.SIZE)
                .where(FILE_INFO.WORKSPACE_ID.eq(workspaceId))
                .and(FILE_INFO.STORAGE_PLATFORM_SETTING_ID.eq(storageId))
                .and(FILE_INFO.IS_DIR.eq(false))
                .and(FILE_INFO.IS_DELETED.eq(false))
                .and(FILE_INFO.UPLOAD_TIME.between(startTime, endTime));

        List<FileInfo> files = fileInfoService.list(queryWrapper);
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd");
        Map<String, Long> sizeByDate = new java.util.HashMap<>();
        Map<String, Long> countByDate = new java.util.HashMap<>();
        if (CollUtil.isNotEmpty(files)) {
            for (FileInfo f : files) {
                if (f.getUploadTime() == null) {
                    continue;
                }
                String day = f.getUploadTime().format(fmt);
                sizeByDate.merge(day, f.getSize() != null ? f.getSize() : 0L, Long::sum);
                countByDate.merge(day, 1L, Long::sum);
            }
        }
        return buildFinalResult(startTime, endTime, sizeByDate, countByDate, fmt, qry.getUnit());
    }

    private List<FileHomeUsedBytesVO> buildFinalResult(
            LocalDateTime start,
            LocalDateTime end,
            Map<String, Long> sizeByDate,
            Map<String, Long> countByDate,
            DateTimeFormatter fmt,
            Integer unit) {
        List<FileHomeUsedBytesVO> result = new ArrayList<>();
        long days = ChronoUnit.DAYS.between(start.toLocalDate(), end.toLocalDate());
        for (int i = 0; i <= days; i++) {
            String currentDay = start.plusDays(i).format(fmt);
            long rawBytes = sizeByDate.getOrDefault(currentDay, 0L);

            FileHomeUsedBytesVO vo = new FileHomeUsedBytesVO();
            vo.setDate(currentDay);
            vo.setUsedBytes(formatValue(rawBytes, unit));
            vo.setUploadCount(countByDate.getOrDefault(currentDay, 0L));
            result.add(vo);
        }
        return result;
    }

    /**
     * 1=KB, 2=MB, 3=GB；null 默认 MB。
     */
    private static double unitDivisor(Integer unit) {
        return Math.pow(1024, unitToPower(unit));
    }

    private static int unitToPower(Integer unit) {
        if (unit == null) {
            return 2;
        }
        return switch (unit) {
            case 1 -> 1;
            case 2 -> 2;
            case 3 -> 3;
            default -> 2;
        };
    }

    private static String unitLabel(Integer unit) {
        if (unit == null) {
            return "MB";
        }
        return switch (unit) {
            case 1 -> "KB";
            case 2 -> "MB";
            case 3 -> "GB";
            default -> "MB";
        };
    }

    private LocalDateTime calculateStartTime(Integer dateType, LocalDateTime now) {
        if (dateType == null) return now.minusDays(30).with(LocalTime.MIN);
        return switch (dateType) {
            case 0 -> now.minusMonths(3).with(LocalTime.MIN);
            case 2 -> now.minusDays(7).with(LocalTime.MIN);
            default -> now.minusDays(30).with(LocalTime.MIN);
        };
    }

    /**
     * 统一转换字节数为对应单位的数值
     *
     * @param rawBytes 原始字节数
     * @param unit     单位类型：1=KB, 2=MB, 3=GB
     * @return 转换后的小数
     */
    private double formatValue(Long rawBytes, Integer unit) {
        if (rawBytes == null || rawBytes == 0L) {
            return 0.0;
        }
        double divisor = unitDivisor(unit);
        int scale = (unit != null && unit == 3) ? 4 : 2;
        return BigDecimal.valueOf(rawBytes)
                .divide(BigDecimal.valueOf(divisor), scale, RoundingMode.HALF_UP)
                .doubleValue();
    }
}
