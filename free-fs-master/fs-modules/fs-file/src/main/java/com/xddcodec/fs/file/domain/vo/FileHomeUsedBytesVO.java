package com.xddcodec.fs.file.domain.vo;

import lombok.Data;

@Data
public class FileHomeUsedBytesVO {

    private String date;

    private Double usedBytes;

    /** 当日上传文件个数（与体积无关，避免 0 字节文件导致曲线全空） */
    private Long uploadCount;
}
