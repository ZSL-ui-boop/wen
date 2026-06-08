package com.xddcodec.fs.file.service;

import com.mybatisflex.core.service.IService;
import com.xddcodec.fs.file.domain.FileShareAccessRecord;
import com.xddcodec.fs.file.domain.dto.CreateFileShareAccessRecordCmd;
import com.xddcodec.fs.file.domain.vo.FileShareAccessRecordVO;

import java.util.List;

/**
 * 分享访问记录服务接口
 *
 * @Author: xddcode
 * @Date: 2025/10/30 9:35
 */
public interface FileShareAccessRecordService extends IService<FileShareAccessRecord> {

    /**
     * 根据分享ID获取访问记录列表
     *
     * @param shareId
     * @return
     */
    List<FileShareAccessRecordVO> getListByShareId(String shareId);


    /**
     * 新增分享访问记录
     *
     * @param cmd
     */
    void addShareAccessRecord(CreateFileShareAccessRecordCmd cmd);
}
