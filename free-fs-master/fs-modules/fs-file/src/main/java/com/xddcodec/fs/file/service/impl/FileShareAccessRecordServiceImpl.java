package com.xddcodec.fs.file.service.impl;

import com.mybatisflex.core.query.QueryWrapper;
import com.mybatisflex.spring.service.impl.ServiceImpl;
import com.xddcodec.fs.file.domain.FileShareAccessRecord;
import com.xddcodec.fs.file.domain.dto.CreateFileShareAccessRecordCmd;
import com.xddcodec.fs.file.domain.vo.FileShareAccessRecordVO;
import com.xddcodec.fs.file.mapper.FileShareAccessRecordMapper;
import com.xddcodec.fs.file.service.FileShareAccessRecordService;
import com.xddcodec.fs.framework.common.utils.StringUtils;
import io.github.linpeilie.Converter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

import static com.xddcodec.fs.file.domain.table.FileShareAccessRecordTableDef.FILE_SHARE_ACCESS_RECORD;

/**
 * 分享访问记录服务实现
 *
 * @Author: xddcode
 * @Date: 2025/10/30 9:35
 */
@Service
@RequiredArgsConstructor
public class FileShareAccessRecordServiceImpl extends ServiceImpl<FileShareAccessRecordMapper, FileShareAccessRecord> implements FileShareAccessRecordService {

    private final Converter converter;

    @Override
    public List<FileShareAccessRecordVO> getListByShareId(String shareId) {
        List<FileShareAccessRecord> records = this.list(new QueryWrapper().where(FILE_SHARE_ACCESS_RECORD.SHARE_ID.eq(shareId)));
        return converter.convert(records, FileShareAccessRecordVO.class);
    }

    @Override
    public void addShareAccessRecord(CreateFileShareAccessRecordCmd cmd) {
        if (StringUtils.isEmpty(cmd.getShareId())) {
            return;
        }
        FileShareAccessRecord record = converter.convert(cmd, FileShareAccessRecord.class);
        record.setAccessTime(LocalDateTime.now());
        this.save(record);
    }
}
