package com.xddcodec.fs.file.listener;

import com.xddcodec.fs.file.domain.dto.CreateFileShareAccessRecordCmd;
import com.xddcodec.fs.file.domain.event.CreateFileShareAccessRecordEvent;
import com.xddcodec.fs.file.service.FileShareAccessRecordService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/**
 * 文件分享访问记录监听器
 *
 * @Author: xddcodec
 * @Date: 2025/9/25 14:35
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class FileShareEventListener {

    private final FileShareAccessRecordService shareAccessRecordService;

    /**
     * 监听创建分享访问记录
     */
    @Async
    @EventListener
    public void handleCreateFileShareAccessRecordEvent(CreateFileShareAccessRecordEvent event) {
        CreateFileShareAccessRecordCmd cmd = event.getCmd();
        shareAccessRecordService.addShareAccessRecord(cmd);
    }
}

