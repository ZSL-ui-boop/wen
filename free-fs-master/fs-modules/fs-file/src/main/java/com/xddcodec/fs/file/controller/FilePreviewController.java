package com.xddcodec.fs.file.controller;

import com.xddcodec.fs.file.preview.PreviewService;
import com.xddcodec.fs.framework.common.constant.RedisKey;
import com.xddcodec.fs.framework.common.domain.Result;
import com.xddcodec.fs.framework.common.utils.I18nUtils;
import com.xddcodec.fs.framework.redis.repository.RedisRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import java.util.UUID;

/**
 * 文件在线预览控制器（服务端渲染）
 * <p>负责签发短时预览 token 并渲染预览页面；实际文件流由 {@link FileStreamController} 提供。
 * token 写入 Redis，预览页与流请求需经 {@link com.xddcodec.fs.interceptor.PreviewInterceptor} 校验。</p>
 *
 * @author xddcode
 */
@Slf4j
@Controller
@RequiredArgsConstructor
public class FilePreviewController {

    private final PreviewService previewService;

    private final RedisRepository redisRepository;

    /**
     * 获取预览token
     * <p>【核心亮点-预览防盗链】短时 token 写入 Redis，预览页/stream 请求需携带。</p>
     */
    @ResponseBody
    @PostMapping("/preview/token/{fileId}")
    public Result<String> previewToken(@PathVariable String fileId) {
        String token = UUID.randomUUID().toString().replace("-", "");
        redisRepository.setExpire(
                RedisKey.getPreviewTokenKey(token),
                fileId,
                RedisKey.PREVIEW_TOKEN_EXPIRE
        );
        return Result.ok(token);
    }

    /**
     * 文件预览入口
     */
    @GetMapping("/preview/{fileId}")
    public String preview(@PathVariable String fileId, Model model) {
        log.info("收到预览请求: fileId={}", fileId);

        try {
            return previewService.preview(fileId, model);
        } catch (Exception e) {
            log.error("预览过程发生未捕获异常: fileId={}", fileId, e);
            model.addAttribute("errorMessage", I18nUtils.getMessage("preview.system.error"));
            model.addAttribute("errorDetail", I18nUtils.getMessage("preview.unexpected.error"));
            return "preview/error";
        }
    }

    @GetMapping("/preview/error")
    public String previewError(HttpServletRequest request, Model model) {
        Object errorMessage = request.getAttribute("errorMessage");
        Object errorDetail = request.getAttribute("errorDetail");
        model.addAttribute("errorMessage",
                errorMessage != null ? errorMessage : I18nUtils.getMessage("preview.failed"));
        model.addAttribute("errorDetail",
                errorDetail != null ? errorDetail : I18nUtils.getMessage("preview.retry"));
        return "preview/error";
    }
}
