package com.xddcodec.fs.system.domain.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 修改密码DTO
 *
 * @Author: xddcode
 * @Date: 2024/6/17 17:31
 */
@Data
public class PasswordEditCmd{

    @NotBlank(message = "oldPassword不能为空")
    private String oldPassword;

    @NotBlank(message = "newPassword不能为空")
    private String newPassword;

    @NotBlank(message = "confirmPassword不能为空")
    private String confirmPassword;
}
