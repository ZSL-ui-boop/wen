package com.xddcodec.fs.system.auth;

import com.xddcodec.fs.framework.common.enums.LoginType;
import com.xddcodec.fs.framework.common.exception.BusinessException;
import com.xddcodec.fs.framework.common.utils.I18nUtils;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 登录策略工厂
 * <p>【核心亮点-认证扩展】password / email_code 等策略 Bean 注册到 Map，便于新增登录方式。</p>
 *
 * @Author: xddcode
 * @Date: 2026/4/2 09:59
 */
@Service
public class LoginStrategyFactory {

    private final Map<LoginType, LoginStrategy> strategyMap = new ConcurrentHashMap<>();

    public LoginStrategyFactory(List<LoginStrategy> strategies) {
        strategies.forEach(s -> strategyMap.put(s.getLoginType(), s));
    }

    public LoginStrategy getStrategy(LoginType type) {
        LoginStrategy strategy = strategyMap.get(type);
        if (strategy == null) {
            throw new BusinessException(I18nUtils.getMessage("auth.login.type.not.supported"));
        }
        return strategy;
    }
}
