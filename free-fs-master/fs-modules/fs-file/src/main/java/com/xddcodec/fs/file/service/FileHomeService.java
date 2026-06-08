package com.xddcodec.fs.file.service;

import com.xddcodec.fs.file.domain.qry.FileHomeUsedBytesQry;
import com.xddcodec.fs.file.domain.vo.FileDashboardVO;
import com.xddcodec.fs.file.domain.vo.FileHomeVO;

public interface FileHomeService {

    /**
     * 获取文件仪表盘信息
     *
     * @return 文件仪表盘信息
     */
    FileHomeVO getFileHomes(FileHomeUsedBytesQry qry);

    /**
     * 数据大屏聚合指标
     */
    FileDashboardVO getDashboard(FileHomeUsedBytesQry qry);
}
