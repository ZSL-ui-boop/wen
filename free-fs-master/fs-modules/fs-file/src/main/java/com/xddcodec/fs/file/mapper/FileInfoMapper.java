package com.xddcodec.fs.file.mapper;

import com.xddcodec.fs.file.domain.FileInfo;
import com.mybatisflex.core.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 文件资源Mapper接口
 *
 * @Author: xddcode
 * @Date: 2025/5/8 9:30
 */
@Mapper
public interface FileInfoMapper extends BaseMapper<FileInfo> {
}