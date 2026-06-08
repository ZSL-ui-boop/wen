package com.xddcodec.fs.framework.preview.converter.impl;

import com.xddcodec.fs.framework.preview.converter.IConverter;
import com.xddcodec.fs.framework.preview.office.OfficeToPdfConfig;
import com.xddcodec.fs.framework.preview.queue.OfficeTaskQueueHandler;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jodconverter.core.DocumentConverter;
import org.jodconverter.core.office.OfficeException;
import org.jodconverter.core.office.OfficeManager;
import org.jodconverter.local.LocalConverter;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import java.util.concurrent.*;

@Slf4j
@RequiredArgsConstructor
public class OfficeToPdfConverter implements IConverter {

    private final OfficeManager officeManager;
    private final OfficeToPdfConfig config;
    private final OfficeTaskQueueHandler queueHandler;

    @Override
    public String getTargetExtension() {
        return "pdf";
    }

    @Override
    public InputStream convert(InputStream sourceStream, String sourceExtension) {

        return queueHandler.submitAndWait(sourceStream, sourceExtension, this::doActualConvert);
    }

    /**
     * 真正的转换逻辑
     *
     * @param sourceStream    源文件输入流
     * @param sourceExtension 源文件扩展名
     * @return PDF 格式的输出流
     */
    private InputStream doActualConvert(InputStream sourceStream, String sourceExtension) {
        Path tempInputFile = null;
        Path tempOutputFile = null;

        try {
            String baseName = UUID.randomUUID().toString();
            tempInputFile = createTempFile(baseName, sourceExtension);
            tempOutputFile = createTempFile(baseName, "pdf");

            // 写入源文件
            try (OutputStream out = Files.newOutputStream(tempInputFile)) {
                sourceStream.transferTo(out);
            }

            // 转换
            DocumentConverter converter = LocalConverter.builder()
                    .officeManager(officeManager)
                    .build();

            converter.convert(tempInputFile.toFile())
                    .to(tempOutputFile.toFile())
                    .execute();

            // 读取结果
            byte[] pdfData = Files.readAllBytes(tempOutputFile);
            log.info("Office文件转换成功: {} -> PDF, size={}KB",
                    sourceExtension, pdfData.length / 1024);

            return new ByteArrayInputStream(pdfData);

        } catch (OfficeException e) {
            log.error("Office转换失败: {}", e.getMessage(), e);
            throw new RuntimeException("文件转换失败: " + e.getMessage(), e);
        } catch (IOException e) {
            log.error("文件IO错误", e);
            throw new RuntimeException("文件读写错误", e);
        } finally {
            cleanupTempFiles(tempInputFile, tempOutputFile);
        }
    }

    private Path createTempFile(String baseName, String extension) throws IOException {
        Path cacheDir = Path.of(config.getCachePath());
        if (!Files.exists(cacheDir)) {
            Files.createDirectories(cacheDir);
        }
        return cacheDir.resolve(baseName + "." + extension);
    }

    private void cleanupTempFiles(Path... files) {
        for (Path file : files) {
            if (file != null && Files.exists(file)) {
                try {
                    Files.delete(file);
                } catch (IOException e) {
                    log.warn("临时文件删除失败: {}", file, e);
                }
            }
        }
    }
}
