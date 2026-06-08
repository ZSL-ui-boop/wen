package com.xddcodec.fs.file.mapper;

import com.mybatisflex.core.BaseMapper;
import com.xddcodec.fs.file.domain.FileShareItem;
import org.apache.ibatis.annotations.Mapper;

/**
 * 分享文件关联数据访问层接口
 *
 * @Author: xddcode
 * @Date: 2025/10/29 15:13
 */
@Mapper
public interface FileShareItemMapper extends BaseMapper<FileShareItem> {
}
