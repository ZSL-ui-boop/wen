package com.xddcodec.fs.system.controller;

import com.xddcodec.fs.framework.common.domain.Result;
import com.xddcodec.fs.system.ai.AiChatService;
import com.xddcodec.fs.system.ai.AiProperties;
import com.xddcodec.fs.system.ai.dto.AiChatRequestDTO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.util.StringUtils;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Map;

@Validated
@RestController
@RequiredArgsConstructor
@RequestMapping("/apis/ai")
@Tag(name = "AI 助手", description = "网盘智能问答（SSE 流式）")
public class AiChatController {

    private final AiChatService aiChatService;
    private final AiProperties aiProperties;

    @GetMapping("/status")
    @Operation(summary = "AI 可用状态", description = "检查是否已配置并启用 AI")
    public Result<Map<String, Object>> status() {
        boolean ready = aiProperties.isEnabled() && StringUtils.hasText(aiProperties.getApiKey());
        return Result.ok(Map.of(
                "enabled", ready,
                "model", ready ? aiProperties.getModel() : ""
        ));
    }

    @PostMapping(value = "/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "流式对话", description = "支持对话、深度思考与 Agent 模式；需配置 ai.enabled 与 ai.api-key")
    public SseEmitter chat(@RequestBody @Valid AiChatRequestDTO request) {
        return aiChatService.streamChat(request);
    }
}
