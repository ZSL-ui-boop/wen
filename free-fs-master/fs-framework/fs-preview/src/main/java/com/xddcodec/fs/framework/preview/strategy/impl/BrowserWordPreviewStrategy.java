package com.xddcodec.fs.framework.preview.strategy.impl;

import com.xddcodec.fs.framework.common.enums.FileTypeEnum;
import com.xddcodec.fs.framework.preview.core.PreviewContext;
import com.xddcodec.fs.framework.preview.strategy.AbstractPreviewStrategy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.ui.Model;

/**
 * 在未启用 LibreOffice 转 PDF 时，于浏览器内直接渲染 .docx（Open XML）文档。
 * <p>
 * 需在配置中关闭 Office 转换：{@code fs.preview.office.enabled=false}
 */
@Slf4j
@Component
@ConditionalOnProperty(prefix = "fs.preview.office", name = "enabled", havingValue = "false")
public class BrowserWordPreviewStrategy extends AbstractPreviewStrategy {

    @Override
    public boolean support(FileTypeEnum fileType) {
        return fileType == FileTypeEnum.WORD;
    }

    @Override
    public String getTemplatePath() {
        return "preview/docx-browser";
    }

    @Override
    protected void fillSpecificModel(PreviewContext context, Model model) {
        log.debug("使用浏览器端 Word 预览: {}", context.getFileName());
    }
}
