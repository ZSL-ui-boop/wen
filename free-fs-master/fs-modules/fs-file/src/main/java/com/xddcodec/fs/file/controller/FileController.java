package com.xddcodec.fs.file.controller;

import cn.dev33.satoken.annotation.SaCheckPermission;
import com.xddcodec.fs.file.domain.FileInfo;
import com.xddcodec.fs.file.domain.dto.CreateDirectoryCmd;
import com.xddcodec.fs.file.domain.dto.MoveFileCmd;
import com.xddcodec.fs.file.domain.dto.RenameFileCmd;
import com.xddcodec.fs.file.domain.qry.FileQry;
import com.xddcodec.fs.file.domain.qry.FileRecycleQry;
import com.xddcodec.fs.file.domain.vo.FileDetailVO;
import com.xddcodec.fs.file.domain.vo.FileVO;
import com.xddcodec.fs.file.service.FileInfoService;
import com.xddcodec.fs.file.service.FileRecycleService;
import com.xddcodec.fs.file.service.FileUserFavoritesService;
import com.xddcodec.fs.framework.common.domain.PageResult;
import com.xddcodec.fs.framework.common.domain.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.Parameters;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 文件资源控制器
 *
 * @Author: xddcode
 * @Date: 2025/5/8 10:00
 */
@Validated
@Slf4j
@RestController
@RequestMapping("/apis/file")
@Tag(name = "文件管理", description = "文件上传、下载、管理等接口")
public class FileController {

    @Autowired
    private FileInfoService fileInfoService;

    @Autowired
    private FileRecycleService fileRecycleService;

    @Autowired
    private FileUserFavoritesService fileUserFavoritesService;

    @GetMapping("/list")
    @Operation(summary = "查询所有文件列表", description = "支持关键词搜索和文件类型筛选的列表查询")
    public PageResult<FileVO> getList(FileQry qry) {
        return fileInfoService.getList(qry);
    }

    @GetMapping("/{fileId}")
    @Operation(summary = "查询文件详情", description = "查询文件详情")
    public Result<FileDetailVO> getFileDetails(@PathVariable String fileId) {
        FileDetailVO details = fileInfoService.getFileDetails(fileId);
        return Result.ok(details);
    }

    @GetMapping("/dirs")
    @Operation(summary = "查询目录列表", description = "查询目录列表")
    public Result<List<FileVO>> getDirs(String parentId) {
        List<FileVO> list = fileInfoService.getDirs(parentId);
        return Result.ok(list);
    }

    @GetMapping("/url/{fileId}")
    @Operation(summary = "获取文件URL", description = "获取文件的访问URL")
    @Parameters(value = {@Parameter(name = "fileId", description = "文件ID", required = true), @Parameter(name = "expireSeconds", description = "URL有效时间（秒），如果不支持或永久有效可为null")})
    public Result<String> getFileUrl(@PathVariable("fileId") String fileId, @RequestParam(value = "expireSeconds", required = false) Integer expireSeconds) {

        String url = fileInfoService.getFileUrl(fileId, expireSeconds);
        return Result.ok(url);
    }

    @DeleteMapping()
    @Operation(summary = "移到回收站", description = "将文件移动到回收站")
    @SaCheckPermission("file:write")
    public Result<?> deleteFiles(@RequestBody List<String> fileIds) {
        fileInfoService.moveFilesToRecycleBin(fileIds);
        return Result.ok();
    }

    @PostMapping("/directory")
    @Operation(summary = "创建目录", description = "在指定目录下创建新目录")
    @SaCheckPermission("file:write")
    public Result<FileInfo> createDirectory(@RequestBody @Validated CreateDirectoryCmd cmd) {
        FileInfo fileInfo = fileInfoService.createDirectory(cmd);
        return Result.ok(fileInfo);
    }

    @PutMapping("/{fileId}/rename")
    @Operation(summary = "文件重命名", description = "文件重命名")
    @SaCheckPermission("file:write")
    public Result<?> createDirectory(@PathVariable String fileId, @RequestBody @Validated RenameFileCmd cmd) {
        fileInfoService.renameFile(fileId, cmd);
        return Result.ok();
    }

    @PutMapping("/moves")
    @Operation(summary = "文件移动", description = "文件移动")
    @SaCheckPermission("file:write")
    public Result<?> createDirectory(@RequestBody @Validated MoveFileCmd cmd) {
        fileInfoService.moveFile(cmd);
        return Result.ok();
    }

    @GetMapping("/directory/{dirId}/path")
    @Operation(summary = "获取目录层级", description = "根据目录ID获取目录层级")
    public Result<List<FileVO>> createDirectory(@PathVariable String dirId) {
        List<FileVO> fileVOS = fileInfoService.getDirectoryTreePath(dirId);
        return Result.ok(fileVOS);
    }

    @GetMapping("/recycle/pages")
    @Operation(summary = "分页获取回收站列表", description = "分页获取回收站列表")
    public PageResult<?> getRecyclePages(FileRecycleQry qry) {
        return fileRecycleService.getRecyclePages(qry);
    }

    @PutMapping("/recycles")
    @Operation(summary = "恢复文件", description = "从回收站批量恢复文件")
    @SaCheckPermission("file:write")
    public Result<?> restoreFile(@RequestBody List<String> fileIds) {
        fileRecycleService.restoreFiles(fileIds);
        return Result.ok();
    }

    @DeleteMapping("/recycles")
    @Operation(summary = "永久删除文件", description = "永久删除文件，不可恢复")
    @SaCheckPermission("file:write")
    public Result<?> permanentlyDeleteFiles(@RequestBody List<String> fileIds) {
        fileRecycleService.permanentlyDeleteFiles(fileIds);
        return Result.ok();
    }

    @DeleteMapping("/recycles/clear")
    @Operation(summary = "清空回收站", description = "清空回收站，永久删除所有文件")
    @SaCheckPermission("file:write")
    public Result<?> clearRecycles() {
        fileRecycleService.clearRecycles();
        return Result.ok();
    }

    @PostMapping("/favorites")
    @Operation(summary = "收藏文件", description = "收藏文件")
    @SaCheckPermission("file:write")
    public Result<?> favoritesFile(@RequestBody List<String> fileIds) {
        fileUserFavoritesService.favoritesFile(fileIds);
        return Result.ok();
    }

    @DeleteMapping("/favorites")
    @Operation(summary = "取消收藏文件", description = "取消收藏文件")
    @SaCheckPermission("file:write")
    public Result<?> unFavoritesFile(@RequestBody List<String> fileIds) {
        fileUserFavoritesService.unFavoritesFile(fileIds);
        return Result.ok();
    }
}