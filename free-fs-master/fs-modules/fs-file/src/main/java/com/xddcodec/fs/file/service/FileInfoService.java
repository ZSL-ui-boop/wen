package com.xddcodec.fs.file.service;

import com.xddcodec.fs.file.domain.FileInfo;
import com.xddcodec.fs.file.domain.dto.CreateDirectoryCmd;
import com.xddcodec.fs.file.domain.dto.MoveFileCmd;
import com.xddcodec.fs.file.domain.dto.RenameFileCmd;
import com.xddcodec.fs.file.domain.qry.FileQry;
import com.mybatisflex.core.service.IService;
import com.xddcodec.fs.file.domain.vo.FileDetailVO;
import com.xddcodec.fs.file.domain.vo.FileVO;
import com.xddcodec.fs.framework.common.domain.PageResult;

import java.io.InputStream;
import java.util.List;

/**
 * 文件资源服务接口
 *
 * @Author: xddcode
 * @Date: 2025/5/8 9:35
 */
public interface FileInfoService extends IService<FileInfo> {

    /**
     * 下载文件
     *
     * @param fileId 文件ID
     * @return 文件输入流
     */
    InputStream downloadFile(String fileId);

    /**
     * 获取文件访问URL
     *
     * @param fileId        文件ID
     * @param expireSeconds URL有效时间（秒），如果不支持或永久有效可为null或0
     * @return 文件访问URL
     */
    String getFileUrl(String fileId, Integer expireSeconds);

    /**
     * 放入回收站
     *
     * @param fileIds 文件ID集合
     * @return 是否删除成功
     */
    void moveFilesToRecycleBin(List<String> fileIds);

    /**
     * 创建目录
     *
     * @param cmd 创建目录请求参数
     * @return
     */
    FileInfo createDirectory(CreateDirectoryCmd cmd);

    /**
     * 生成唯一的文件名（处理重名冲突）
     * <p>
     * - 如果不存在重名：返回原名称
     * - 如果存在重名：自动添加 (1), (2), (3)... 后缀
     *
     * @param userId                   用户ID
     * @param parentId                 父目录ID
     * @param desiredName              期望的文件名
     * @param isDir                    是否是文件夹
     * @param excludeFileId            排除的文件ID（可选，用于重命名场景）
     * @param storagePlatformSettingId 存储平台设置ID
     * @return 唯一的文件名
     */
    String generateUniqueName(String workspaceId, String parentId,
                              String desiredName, Boolean isDir,
                              String excludeFileId, String storagePlatformSettingId);

    /**
     * 重命名文件
     *
     * @param fileId 文件ID
     * @param cmd    重命名请求参数
     */
    void renameFile(String fileId, RenameFileCmd cmd);

    /**
     * 移动文件到指定目录
     *
     * @param cmd 移动文件请求参数
     */
    void moveFile(MoveFileCmd cmd);

    /**
     * 获取目录层级
     *
     * @param dirId 目录ID
     * @return
     */
    List<FileVO> getDirectoryTreePath(String dirId);

    /**
     * 查询文件列表
     *
     * @param qry 查询参数（包含关键词、文件类型、分页参数等）
     * @return 分页结果
     */
    PageResult<FileVO> getList(FileQry qry);

    /**
     * 计算已使用的存储空间
     *
     * @return
     */
    Long calculateUsedStorage();

    /**
     * 查询文件详情
     *
     * @param fileId 文件ID
     * @return
     */
    FileDetailVO getFileDetails(String fileId);

    /**
     * 根据父目录ID查询目录列表
     *
     * @param parentId
     * @return
     */
    List<FileVO> getDirs(String parentId);

    /**
     * 根据文件ID列表查询文件信息
     *
     * @param fileIds
     * @return
     */
    List<FileVO> getByFileIds(List<String> fileIds);

    /**
     * 分享页等场景：按父目录列出子项（不依赖当前登录用户与工作空间拦截器上下文）
     *
     * @param parentId    父目录 ID
     * @param workspaceId 工作空间 ID（与分享所属空间一致）
     */
    List<FileVO> listChildrenByParentId(String parentId, String workspaceId);

    /**
     * 递归列出目录下的全部子节点（不含该目录自身），不含已删除项。
     * 用于分享打包下载等场景。
     */
    List<FileInfo> listAllDescendants(String parentId);

    /**
     * 统计某目录下所有后代文件的字节大小之和（不含目录节点、不含已删除）。
     */
    long sumFileSizesUnderDirectory(String directoryId, String workspaceId);

    /**
     * 分享场景：仅按 parent_id 列出未删除子项（不按 workspace 过滤），避免子项 workspace 与父目录不一致时列表为空。
     */
    List<FileVO> listChildrenByParentIdLenient(String parentId);

    /**
     * 按目录树（parent_id 链）汇总目录下所有后代文件大小，不按 workspace 过滤。
     * 与 {@link #listAllDescendants(String)} 范围一致，用于分享列表展示文件夹大小。
     */
    long sumFileSizesUnderDirectoryTree(String directoryId);
}