package com.xddcodec.fs.system.domain.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 设置密码DTO
 *
 * @Author: xddcode
 * @Date: 2024/6/17 17:31
 */
@Data
public class PasswordAddCmd {

    @NotBlank(message = "newPassword不能为空")
    private String newPassword;

    @NotBlank(message = "confirmPassword不能为空")
    private String confirmPassword;
}
