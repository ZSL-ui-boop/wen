package com.xddcodec.fs.storage.plugin.minio.config;

import com.xddcodec.fs.storage.plugin.minio.config.config.MinioConfig;
import com.xddcodec.fs.storage.plugin.core.annotation.StoragePlugin;
import com.xddcodec.fs.storage.plugin.core.config.StorageConfig;
import com.xddcodec.fs.storage.plugin.core.s3.AbstractS3CompatibleStorageService;

/**
 * MinIO 存储插件实现
 * <p>基于 S3 兼容协议，继承 {@link com.xddcodec.fs.storage.plugin.core.s3.AbstractS3CompatibleStorageService} 复用 AWS SDK 通用逻辑。</p>
 *
 * @author xddcode
 */
@StoragePlugin(
        identifier = "Minio",
        name = "Minio对象存储",
        description = "RustFS 是一个基于 Rust 构建的高性能分布式对象存储系统。Rust 是全球最受开发者喜爱的编程语言之一，RustFS 完美结合了 MinIO 的简洁性与 Rust 的内存安全及高性能优势。它提供完整的 S3 兼容性，完全开源，并专为数据湖、人工智能（AI）和大数据负载进行了优化。",
        icon = "icon-bendicunchu1",
        link = "https://github.com/rustfs/rustfs",
        schemaResource = "classpath:schema/rustfs-schema.json"
)
public class MinioStorageServiceImpl extends AbstractS3CompatibleStorageService<MinioConfig> {

    public MinioStorageServiceImpl() {
        super();
    }

    public MinioStorageServiceImpl(StorageConfig config) {
        super(config);
    }

    @Override
    protected Class<MinioConfig> getS3ConfigClass() {
        return MinioConfig.class;
    }
}
