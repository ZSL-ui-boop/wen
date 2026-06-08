package com.xddcodec.fs.file.domain.vo;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.util.List;

/**
 * 数据大屏聚合指标（工作空间维度）
 */
@Data
public class FileDashboardVO implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    private Double usedStorage;
    private String unit;
    private Long fileCount;
    private Long folderCount;
    private Long shareCount;
    private Long recycleCount;
    private Long uploadTodayCount;
    private List<FileHomeUsedBytesVO> trend7d;
    /** 服务端生成时间，便于大屏展示刷新时刻 */
    private String updatedAt;
}
