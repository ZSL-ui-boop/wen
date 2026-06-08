package com.xddcodec.fs.system.ai;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * OpenAI 兼容接口配置（DeepSeek、通义、OpenAI 等均可）
 */
@Data
@ConfigurationProperties(prefix = "ai")
public class AiProperties {

    /**
     * 是否启用 AI 对话
     */
    private boolean enabled = false;

    /**
     * API 根地址，如 https://api.openai.com/v1
     */
    private String baseUrl = "https://api.openai.com/v1";

    private String apiKey = "";

    private String model = "gpt-4o-mini";

    /**
     * SSE 超时（秒）
     */
    private int timeoutSeconds = 120;
}
