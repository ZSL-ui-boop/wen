package com.xddcodec.fs.log.domain.dto;

import com.xddcodec.fs.framework.common.domain.PageQuery;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 登录日志分页查询对象
 *
 * @Author: xddcodec
 * @Date: 2025/9/25 16:06
 */
@EqualsAndHashCode(callSuper = true)
@Data
public class LoginLogPageQry extends PageQuery {

    private String keyword;

    private Integer status;
}
