package com.xddcodec.fs.system.service.impl;

import cn.dev33.satoken.stp.SaTokenInfo;
import cn.dev33.satoken.stp.StpUtil;
import cn.hutool.core.util.RandomUtil;
import com.xddcodec.fs.framework.common.constant.CommonConstant;
import com.xddcodec.fs.framework.common.constant.RedisKey;
import com.xddcodec.fs.framework.common.exception.BusinessException;
import com.xddcodec.fs.framework.common.utils.I18nUtils;
import com.xddcodec.fs.framework.notify.mail.MailService;
import com.xddcodec.fs.framework.notify.mail.domain.Mail;
import com.xddcodec.fs.framework.redis.repository.RedisRepository;
import com.xddcodec.fs.log.annotation.LoginLog;
import com.xddcodec.fs.system.auth.LoginStrategy;
import com.xddcodec.fs.system.auth.LoginStrategyFactory;
import com.xddcodec.fs.system.domain.SysUser;
import com.xddcodec.fs.system.domain.dto.LoginCmd;
import com.xddcodec.fs.system.domain.vo.LoginResult;
import com.xddcodec.fs.system.service.AuthService;
import com.xddcodec.fs.system.service.SysUserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

/**
 * 认证服务实现
 * <p>【核心亮点-安全可靠】登录策略工厂 + Sa-Token 会话；登录邮箱验证码见 {@link #sendLoginEmailCode(String)}。</p>
 * <p>说明：README 中的「JWT」为产品表述，本仓库会话令牌由 Sa-Token 签发。</p>
 *
 * @Author: xddcode
 * @Date: 2024/10/16 14:26
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    /** 开发调试用：邮件正常发出时仍在控制台打印验证码（勿在生产环境开启） */
    @Value("${fs.mail.log-verification-code:false}")
    private boolean logVerificationCode;

    private final LoginStrategyFactory loginStrategyFactory;
    private final SysUserService sysUserService;
    private final RedisRepository redisRepository;
    private final MailService mailService;

    @Override
    @LoginLog()
    public LoginResult doLogin(LoginCmd cmd) {
        LoginStrategy strategy = loginStrategyFactory.getStrategy(cmd.getLoginType());
        LoginResult result = strategy.authenticate(cmd);

        StpUtil.login(result.getId(), cmd.getIsRemember());
        SaTokenInfo tokenInfo = StpUtil.getTokenInfo();
        result.setAccessToken(tokenInfo.getTokenValue());
        //修改最后登录时间
        SysUser user = new SysUser();
        user.setId(result.getId());
        user.setLastLoginAt(LocalDateTime.now());
        sysUserService.updateById(user);
        return result;
    }

    @Override
    public void logout() {
        StpUtil.logout();
    }

    @Override
    public void sendLoginEmailCode(String account) {
        // 【核心亮点-认证】登录用邮箱验证码：Redis 暂存 + MailService 发信（失败回滚 Redis）
        SysUser user = sysUserService.getByMail(account);
        if (user == null) {
            throw new BusinessException(I18nUtils.getMessage("user.not.exist"));
        }

        // 生成验证码
        String code = RandomUtil.randomNumbers(CommonConstant.VERIFY_CODE_LENGTH);
        String redisKey = RedisKey.getLoginKey(account);
        redisRepository.setExpire(redisKey, code, RedisKey.VERIFY_CODE_EXPIRE_SECONDS);

        // 同步发送邮件：失败须让接口报错，并撤销已写入的验证码，避免前端显示已发送却收不到信
        Mail mail = Mail.buildVerifyCodeMail(user.getEmail(), user.getNickname(), code);
        try {
            mailService.sendHtmlMail(mail);
        } catch (Exception e) {
            redisRepository.del(redisKey);
            throw e;
        }

        if (logVerificationCode) {
            log.warn(
                    "[fs.mail] 登录验证码（fs.mail.log-verification-code=true） account={} code={}",
                    account,
                    code);
        }
    }
}
