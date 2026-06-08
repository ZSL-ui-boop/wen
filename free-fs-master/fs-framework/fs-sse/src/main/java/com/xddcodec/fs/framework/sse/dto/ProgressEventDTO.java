package com.xddcodec.fs.framework.sse.dto;

import lombok.Builder;
import lombok.Data;

/**
 * 进度事件数据传输对象
 * 
 * @author xddcodec
 */
@Data
@Builder
public class ProgressEventDTO {
    
    /**
     * 任务ID
     */
    private String taskId;
    
    /**
     * 已上传字节数
     */
    private Long uploadedBytes;
    
    /**
     * 总字节数
     */
    private Long totalBytes;
    
    /**
     * 已上传分片数
     */
    private Integer uploadedChunks;
    
    /**
     * 总分片数
     */
    private Integer totalChunks;
}
