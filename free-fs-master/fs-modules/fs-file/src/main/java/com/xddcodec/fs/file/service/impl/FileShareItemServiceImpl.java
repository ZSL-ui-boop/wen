package com.xddcodec.fs.file.service.impl;

import com.mybatisflex.core.query.QueryWrapper;
import com.mybatisflex.spring.service.impl.ServiceImpl;
import com.xddcodec.fs.file.domain.FileShareItem;
import com.xddcodec.fs.file.mapper.FileShareItemMapper;
import com.xddcodec.fs.file.service.FileShareItemService;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

import static com.xddcodec.fs.file.domain.table.FileShareItemTableDef.FILE_SHARE_ITEM;

@Service
public class FileShareItemServiceImpl extends ServiceImpl<FileShareItemMapper, FileShareItem> implements FileShareItemService {

    @Override
    public void saveShareItems(String shareId, List<String> fileIds) {
        for (String fileId : fileIds) {
            FileShareItem fileShareItem = new FileShareItem();
            fileShareItem.setShareId(shareId);
            fileShareItem.setFileId(fileId);
            fileShareItem.setCreatedAt(LocalDateTime.now());
            save(fileShareItem);
        }
    }

    @Override
    public void removeByShareId(String shareId) {
        this.remove(new QueryWrapper().where(FILE_SHARE_ITEM.SHARE_ID.eq(shareId)));
    }

    @Override
    public Long countByShareId(String shareId) {
        return this.count(new QueryWrapper().where(FILE_SHARE_ITEM.SHARE_ID.eq(shareId)));
    }

    @Override
    public List<String> getShareFileIds(String shareId) {
        return this.listAs(new QueryWrapper()
                .select(FILE_SHARE_ITEM.FILE_ID)
                .where(FILE_SHARE_ITEM.SHARE_ID.eq(shareId)), String.class);
    }

    @Override
    public boolean isFileInShare(String shareId, String fileId) {
        return this.count(new QueryWrapper()
                .where(FILE_SHARE_ITEM.SHARE_ID.eq(shareId))
                .and(FILE_SHARE_ITEM.FILE_ID.eq(fileId))) > 0;
    }
}
