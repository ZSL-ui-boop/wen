package com.xddcodec.fs.file.controller;

import com.xddcodec.fs.file.domain.qry.FileHomeUsedBytesQry;
import com.xddcodec.fs.file.domain.vo.FileDashboardVO;
import com.xddcodec.fs.file.domain.vo.FileHomeVO;
import com.xddcodec.fs.file.service.FileHomeService;
import com.xddcodec.fs.framework.common.domain.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 文件首页控制器
 * <p>聚合工作空间存储用量、最近文件、分享统计及数据大屏指标。</p>
 *
 * @author xddcode
 */
@Validated
@Slf4j
@RestController
@RequestMapping("/apis/home")
@Tag(name = "文件首页", description = "首页")
public class FileHomeController {

    @Autowired
    private FileHomeService fileHomeService;

    @GetMapping("/info")
    @Operation(summary = "查询首页信息", description = "查询首页信息")
    public Result<FileHomeVO> getHomes(FileHomeUsedBytesQry qry) {
        FileHomeVO homeVO = fileHomeService.getFileHomes(qry);
        return Result.ok(homeVO);
    }

    @GetMapping("/dashboard")
    @Operation(summary = "数据大屏指标", description = "工作空间文件与存储聚合，供可视化大屏轮播")
    public Result<FileDashboardVO> getDashboard(FileHomeUsedBytesQry qry) {
        return Result.ok(fileHomeService.getDashboard(qry));
    }
}
