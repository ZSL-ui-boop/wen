package com.xddcodec.fs.system.domain.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 忘记密码-修改密码DTO
 *
 * @Author: xddcode
 * @Date: 2024/6/17 17:31
 */
@Data
public class PasswordForgetEditCmd {

    @NotBlank(message = "mail不能为空")
    private String mail;

    @NotBlank(message = "code不能为空")
    private String code;

    @NotBlank(message = "newPassword不能为空")
    private String newPassword;

    @NotBlank(message = "confirmPassword不能为空")
    private String confirmPassword;
}
