package com.xddcodec.fs.storage.service.impl;

import com.xddcodec.fs.storage.domain.StoragePlatform;
import com.xddcodec.fs.storage.domain.vo.StoragePlatformVO;
import com.xddcodec.fs.storage.mapper.StoragePlatformMapper;
import com.xddcodec.fs.storage.service.StoragePlatformService;
import com.mybatisflex.core.query.QueryWrapper;
import com.mybatisflex.spring.service.impl.ServiceImpl;
import io.github.linpeilie.Converter;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.List;

import static com.xddcodec.fs.storage.domain.table.StoragePlatformTableDef.STORAGE_PLATFORM;

/**
 * 存储平台业务接口实现
 *
 * @Author: xddcode
 * @Date: 2024/10/25 14:38
 */
@Service
@RequiredArgsConstructor
public class StoragePlatformServiceImpl extends ServiceImpl<StoragePlatformMapper, StoragePlatform> implements StoragePlatformService {

    private final Converter converter;


    @Override
    public List<StoragePlatformVO> getList() {
        List<StoragePlatform> storagePlatforms = this.list();
        return converter.convert(storagePlatforms, StoragePlatformVO.class);
    }


    @Override
    @Cacheable(value = "storagePlatform", key = "#identifier", unless = "#result == null")
    public StoragePlatform getStoragePlatformByIdentifier(String identifier) {
        return this.getOne(new QueryWrapper().where(STORAGE_PLATFORM.IDENTIFIER.eq(identifier)));
    }
}
