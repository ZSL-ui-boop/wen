package com.xddcodec.fs.framework.sse.dto;

import lombok.Builder;
import lombok.Data;

/**
 * 状态事件数据传输对象
 * 
 * @author xddcodec
 */
@Data
@Builder
public class StatusEventDTO {
    
    /**
     * 任务ID
     */
    private String taskId;
    
    /**
     * 任务状态
     */
    private String status;
    
    /**
     * 状态消息
     */
    private String message;
}
