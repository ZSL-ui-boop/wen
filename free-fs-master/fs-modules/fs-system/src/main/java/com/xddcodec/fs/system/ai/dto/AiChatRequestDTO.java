package com.xddcodec.fs.system.ai.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class AiChatRequestDTO {

    @NotBlank
    private String message;

    /**
     * 深度思考：模型先在 &lt;thinking&gt; 中推理，再在 &lt;answer&gt; 中作答
     */
    private Boolean deepThink = Boolean.FALSE;

    /**
     * Agent 模式：结合 context 分步规划后作答（与 deepThink 互斥，优先 agent）
     */
    private Boolean agentMode = Boolean.FALSE;

    /**
     * Agent 模式下的工作空间实况（由前端从 dashboard 等接口组装）
     */
    private String context = "";

    private List<AiChatMessageDTO> history = new ArrayList<>();

    /**
     * 用户长期记忆（前端本地维护，注入 system 提示）
     */
    private List<String> memory = new ArrayList<>();
}
