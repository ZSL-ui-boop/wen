package com.xddcodec.fs.file.mapper;

import com.mybatisflex.core.BaseMapper;
import com.xddcodec.fs.file.domain.FileTransferTask;
import com.xddcodec.fs.file.enums.TransferTaskStatus;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

/**
 * 上传任务 mapper 接口
 *
 * @Author: xddcode
 * @Date: 2025/11/06 15:22
 */
public interface FileTransferTaskMapper extends BaseMapper<FileTransferTask> {

    /**
     * 原子更新状态（仅当当前状态为指定状态时才更新）
     * 用于防止重复合并
     */
    @Update("UPDATE file_transfer_task " +
            "SET status = #{newStatus}, updated_at = NOW() " +
            "WHERE task_id = #{taskId} AND status = #{currentStatus}")
    int updateStatusByTaskIdAndStatus(
            @Param("taskId") String taskId,
            @Param("newStatus") TransferTaskStatus newStatus,
            @Param("currentStatus") TransferTaskStatus currentStatus
    );
}
