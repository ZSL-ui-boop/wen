package com.xddcodec.fs.system.ai.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AiChatMessageDTO {

    @NotBlank
    private String role;

    @NotBlank
    private String content;
}
