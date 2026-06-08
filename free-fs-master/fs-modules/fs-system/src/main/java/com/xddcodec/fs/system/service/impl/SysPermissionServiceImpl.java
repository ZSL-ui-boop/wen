package com.xddcodec.fs.system.service.impl;

import com.mybatisflex.spring.service.impl.ServiceImpl;
import com.xddcodec.fs.system.domain.SysPermission;
import com.xddcodec.fs.system.domain.vo.SysPermissionVO;
import com.xddcodec.fs.system.mapper.SysPermissionMapper;
import com.xddcodec.fs.system.service.SysPermissionService;
import io.github.linpeilie.Converter;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 权限服务实现类
 *
 * @Author: xddcode
 * @Date: 2026/3/30 10:11
 */
@Service
@RequiredArgsConstructor
public class SysPermissionServiceImpl extends ServiceImpl<SysPermissionMapper, SysPermission> implements SysPermissionService {

    private final Converter converter;

    @Override
    @Cacheable(value = "permissions", key = "'all'")
    public List<SysPermission> getAll() {
        return this.list();
    }

    @Override
    public List<SysPermissionVO> getList() {
        List<SysPermission> list = this.list();
        return converter.convert(list, SysPermissionVO.class);
    }
}
