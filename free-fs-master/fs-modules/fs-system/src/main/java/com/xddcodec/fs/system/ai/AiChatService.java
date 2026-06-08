package com.xddcodec.fs.system.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.xddcodec.fs.system.ai.dto.AiChatMessageDTO;
import com.xddcodec.fs.system.ai.dto.AiChatRequestDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiChatService {

    private static final String NORMAL_SYSTEM = """
            你是 Free-FS 企业网盘智能助手，擅长文件管理、存储规划、权限协作与传输优化。
            用简洁、专业的中文回答；涉及操作步骤时分点说明。""";

    private static final String DEEP_THINK_SYSTEM = """
            你是 Free-FS 企业网盘智能助手。用户已开启「深度思考」模式，你必须严格遵守：
            1. 先在 <thinking> 与 </thinking> 之间用中文逐步推理（可分多段，写清假设与取舍）
            2. 再在 <answer> 与 </answer> 之间给出简洁、可执行的最终回答
            3. 不要省略标签；thinking 中不要只写一句话敷衍
            主题范围：文件管理、存储、分享、权限、传输与网盘使用。""";

    private static final String AGENT_SYSTEM = """
            你是 Free-FS 网盘智能 Agent，能结合【当前工作空间实况】主动分析并给出可执行方案。
            你必须严格遵守输出格式（禁止省略 XML 标签，禁止把步骤直接写在标签外）：
            1. 先在 <plan> 与 </plan> 之间用中文列出 2～5 条执行步骤（可含检查项、操作路径、注意事项）
            2. 再在 <answer> 与 </answer> 之间给出结论、风险提醒与下一步建议（2～4 句即可）
            3. 若实况数据不足，在 plan 中说明需用户补充的信息
            示例：
            <plan>
            1. 进入侧栏「回收站」查看占用文件数量与体积
            2. 按删除时间筛选 30 天前的文件并批量清空
            </plan>
            <answer>
            建议先备份重要文件再清理；清理后可在首页确认已用存储是否下降。
            </answer>
            主题：文件管理、存储规划、分享权限、传输故障、回收站与协作。""";

    private final AiProperties aiProperties;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();

    public SseEmitter streamChat(AiChatRequestDTO request) {
        long timeoutMs = Math.max(30, aiProperties.getTimeoutSeconds()) * 1000L;
        SseEmitter emitter = new SseEmitter(timeoutMs);
        executor.execute(() -> runStream(request, emitter));
        return emitter;
    }

    private void runStream(AiChatRequestDTO request, SseEmitter emitter) {
        try {
            if (!aiProperties.isEnabled() || !StringUtils.hasText(aiProperties.getApiKey())) {
                sendEvent(emitter, "error", Map.of(
                        "message", "AI 未启用：请在配置中设置 ai.enabled=true 与 ai.api-key（可用环境变量 AI_API_KEY）"
                ));
                emitter.complete();
                return;
            }

            boolean agentMode = Boolean.TRUE.equals(request.getAgentMode());
            boolean deepThink = !agentMode && Boolean.TRUE.equals(request.getDeepThink());
            sendEvent(emitter, "meta", Map.of(
                    "deepThink", deepThink,
                    "agentMode", agentMode
            ));

            List<Map<String, String>> messages = buildMessages(request);
            String body = buildRequestBody(messages);

            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(trimTrailingSlash(aiProperties.getBaseUrl()) + "/chat/completions"))
                    .timeout(Duration.ofSeconds(aiProperties.getTimeoutSeconds()))
                    .header("Authorization", "Bearer " + aiProperties.getApiKey().trim())
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<java.io.InputStream> response = httpClient.send(
                    httpRequest, HttpResponse.BodyHandlers.ofInputStream());

            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                String errBody = new String(response.body().readAllBytes(), StandardCharsets.UTF_8);
                log.warn("AI upstream HTTP {}: {}", response.statusCode(), errBody);
                sendEvent(emitter, "error", Map.of(
                        "message", parseUpstreamError(errBody, response.statusCode())
                ));
                emitter.complete();
                return;
            }

            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(response.body(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    if (!line.startsWith("data:")) {
                        continue;
                    }
                    String data = line.substring(5).trim();
                    if ("[DONE]".equals(data)) {
                        break;
                    }
                    String delta = extractDeltaContent(data);
                    if (StringUtils.hasText(delta)) {
                        sendEvent(emitter, "delta", Map.of("text", delta));
                    }
                }
            }

            sendEvent(emitter, "done", Map.of("ok", true));
            emitter.complete();
        } catch (Exception e) {
            log.error("AI stream failed", e);
            try {
                sendEvent(emitter, "error", Map.of("message", e.getMessage() != null ? e.getMessage() : "AI 请求失败"));
                emitter.complete();
            } catch (Exception ignored) {
                emitter.completeWithError(e);
            }
        }
    }

    private List<Map<String, String>> buildMessages(AiChatRequestDTO request) {
        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of(
                "role", "system",
                "content", buildSystemContent(request)
        ));
        if (request.getHistory() != null) {
            for (AiChatMessageDTO item : request.getHistory()) {
                if (item == null || !StringUtils.hasText(item.getRole()) || !StringUtils.hasText(item.getContent())) {
                    continue;
                }
                messages.add(Map.of("role", item.getRole().trim(), "content", item.getContent().trim()));
            }
        }
        messages.add(Map.of("role", "user", "content", request.getMessage().trim()));
        return messages;
    }

    private String buildRequestBody(List<Map<String, String>> messages) throws Exception {
        ObjectNode root = objectMapper.createObjectNode();
        root.put("model", aiProperties.getModel());
        root.put("stream", true);
        ArrayNode msgArr = root.putArray("messages");
        for (Map<String, String> m : messages) {
            ObjectNode node = objectMapper.createObjectNode();
            node.put("role", m.get("role"));
            node.put("content", m.get("content"));
            msgArr.add(node);
        }
        return objectMapper.writeValueAsString(root);
    }

    private String extractDeltaContent(String data) throws Exception {
        JsonNode root = objectMapper.readTree(data);
        JsonNode choices = root.path("choices");
        if (!choices.isArray() || choices.isEmpty()) {
            return "";
        }
        return choices.get(0).path("delta").path("content").asText("");
    }

    private void sendEvent(SseEmitter emitter, String event, Object payload) throws Exception {
        emitter.send(SseEmitter.event()
                .name(event)
                .data(objectMapper.writeValueAsString(payload)));
    }

    private String buildSystemContent(AiChatRequestDTO request) {
        boolean agentMode = Boolean.TRUE.equals(request.getAgentMode());
        boolean deepThink = !agentMode && Boolean.TRUE.equals(request.getDeepThink());
        String base;
        if (agentMode) {
            base = AGENT_SYSTEM;
        } else if (deepThink) {
            base = DEEP_THINK_SYSTEM;
        } else {
            base = NORMAL_SYSTEM;
        }
        StringBuilder sb = new StringBuilder(base);
        String memoryBlock = formatMemoryBlock(request.getMemory());
        if (StringUtils.hasText(memoryBlock)) {
            sb.append("\n\n").append(memoryBlock);
        }
        if (agentMode && StringUtils.hasText(request.getContext())) {
            sb.append("\n\n【当前工作空间实况】\n").append(request.getContext().trim());
        }
        return sb.toString();
    }

    private static String formatMemoryBlock(List<String> memory) {
        if (memory == null || memory.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder("【用户长期记忆】请在后续回答中适当参考（勿逐条复述）：");
        for (String item : memory) {
            if (item != null && !item.isBlank()) {
                sb.append("\n- ").append(item.trim());
            }
        }
        return sb.toString();
    }

    private String parseUpstreamError(String errBody, int status) {
        if (!StringUtils.hasText(errBody)) {
            return "AI 服务返回错误 HTTP " + status;
        }
        try {
            JsonNode root = objectMapper.readTree(errBody);
            JsonNode err = root.path("error");
            String msg = err.path("message").asText(null);
            if (!StringUtils.hasText(msg)) {
                msg = root.path("message").asText(null);
            }
            if (StringUtils.hasText(msg)) {
                return "AI 服务错误：" + msg;
            }
        } catch (Exception ignored) {
            /* 非 JSON 响应 */
        }
        return "AI 服务返回错误 HTTP " + status;
    }

    private static String trimTrailingSlash(String url) {
        if (url == null) {
            return "";
        }
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
