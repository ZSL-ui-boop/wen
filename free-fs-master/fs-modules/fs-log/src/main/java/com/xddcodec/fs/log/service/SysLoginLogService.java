package com.xddcodec.fs.log.service;

import com.mybatisflex.core.service.IService;
import com.xddcodec.fs.framework.common.domain.PageResult;
import com.xddcodec.fs.log.domain.SysLoginLog;
import com.xddcodec.fs.log.domain.dto.LoginLogPageQry;
import com.xddcodec.fs.log.domain.vo.SysLoginLogVO;

/**
 * 登录日志表 Service
 *
 * @Author: xddcodec
 * @Date: 2025/9/25 14:39
 */
public interface SysLoginLogService extends IService<SysLoginLog> {

    /**
     * 分页查询登录日志
     *
     * @param qry
     * @return
     */
    PageResult<SysLoginLogVO> getPages(LoginLogPageQry qry);
}
