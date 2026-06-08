package com.xddcodec.fs.log.controller;

import com.xddcodec.fs.framework.common.domain.PageResult;
import com.xddcodec.fs.log.domain.dto.LoginLogPageQry;
import com.xddcodec.fs.log.domain.vo.SysLoginLogVO;
import com.xddcodec.fs.log.service.SysLoginLogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 日志控制器
 *
 * @Author: xddcodec
 * @Date: 2025/9/25 16:16
 */
@Validated
@RestController
@RequestMapping("/apis/logs")
@RequiredArgsConstructor
@Tag(name = "日志管理")
public class LogController {

    private final SysLoginLogService loginLogService;

    @Operation(summary = "分页获取登录日志列表")
    @GetMapping("/login/pages")
    public PageResult<SysLoginLogVO> getPages(LoginLogPageQry qry) {
        return loginLogService.getPages(qry);
    }
}
