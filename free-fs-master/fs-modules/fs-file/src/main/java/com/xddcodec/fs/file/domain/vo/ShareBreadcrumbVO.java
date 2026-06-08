package com.xddcodec.fs.file.domain.vo;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;

/**
 * 分享页面包屑节点（匿名可访问）
 */
@Data
public class ShareBreadcrumbVO implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    private String id;

    /** 展示名 */
    private String name;
}
