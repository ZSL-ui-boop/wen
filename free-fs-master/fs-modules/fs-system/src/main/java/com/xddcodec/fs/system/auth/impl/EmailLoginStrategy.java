package com.xddcodec.fs.system.auth.impl;

import com.mybatisflex.core.query.QueryWrapper;
import com.xddcodec.fs.framework.common.constant.RedisKey;
import com.xddcodec.fs.framework.common.enums.LoginType;
import com.xddcodec.fs.framework.common.exception.BusinessException;
import com.xddcodec.fs.framework.common.utils.I18nUtils;
import com.xddcodec.fs.framework.redis.repository.RedisRepository;
import com.xddcodec.fs.system.auth.LoginStrategy;
import com.xddcodec.fs.system.domain.SysUser;
import com.xddcodec.fs.system.domain.dto.LoginCmd;
import com.xddcodec.fs.system.domain.vo.LoginResult;
import com.xddcodec.fs.system.mapper.SysUserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

import static com.xddcodec.fs.system.domain.table.SysUserTableDef.SYS_USER;

/**
 * 邮箱验证码登录策略
 * <p>【核心亮点-认证】验证码与 Redis 比对，通过后签发会话（在 AuthServiceImpl.doLogin 中统一 StpUtil.login）。</p>
 *
 * @Author: xddcode
 * @Date: 2026/4/2 09:59
 */
@Component
@RequiredArgsConstructor
public class EmailLoginStrategy implements LoginStrategy {

    private final SysUserMapper userMapper;
    private final RedisRepository redisRepository;

    @Override
    public LoginType getLoginType() {
        return LoginType.email_code;
    }

    @Override
    public LoginResult authenticate(LoginCmd cmd) {
        String account = cmd.getAccount();
        String code = cmd.getPassword();

        if (code == null || code.isBlank()) {
            throw new BusinessException(I18nUtils.getMessage("user.verification.code.required"));
        }

        String redisKey = RedisKey.getLoginKey(account);
        String cachedCode = (String) redisRepository.get(redisKey);

        if (cachedCode == null) {
            throw new BusinessException(I18nUtils.getMessage("user.verification.code.expired"));
        }
        if (!code.equals(cachedCode)) {
            throw new BusinessException(I18nUtils.getMessage("user.verification.code.incorrect"));
        }

        SysUser user = userMapper.selectOneByQuery(
                new QueryWrapper()
                        .where(SYS_USER.USERNAME.eq(account))
                        .or(SYS_USER.EMAIL.eq(account))
        );

        if (user == null) {
            throw new BusinessException(I18nUtils.getMessage("user.not.exist"));
        }

        redisRepository.del(redisKey);

        LoginResult loginResult = new LoginResult();
        loginResult.setId(user.getId());
        loginResult.setUsername(user.getUsername());
        //修改最后登录时间
        user.setLastLoginAt(LocalDateTime.now());
        userMapper.update(user);
        return loginResult;
    }
}
