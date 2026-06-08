package com.xddcodec.fs.system.controller;

import com.xddcodec.fs.framework.common.domain.Result;
import com.xddcodec.fs.system.domain.dto.LoginCmd;
import com.xddcodec.fs.system.domain.vo.LoginResult;
import com.xddcodec.fs.system.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/apis/auth")
@RequiredArgsConstructor
@Tag(name = "认证管理")
public class AuthController {

    private final AuthService authService;

    @Operation(summary = "登录")
    @PostMapping("/login")
    public Result<?> doLogin(@Valid @RequestBody LoginCmd cmd) {
        LoginResult loginResult = authService.doLogin(cmd);
        return Result.ok(loginResult);
    }

    @Operation(summary = "登录-发送验证码")
    @PostMapping("/login/email-code")
    public Result<?> sendLoginEmailCode(@RequestParam String account) {
        authService.sendLoginEmailCode(account);
        return Result.ok();
    }

    @Operation(summary = "登出")
    @PostMapping("/logout")
    public Result<?> logout() {
        authService.logout();
        return Result.ok();
    }
}
