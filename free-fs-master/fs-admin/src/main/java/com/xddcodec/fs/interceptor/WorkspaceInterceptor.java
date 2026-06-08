package com.xddcodec.fs.interceptor;

import cn.dev33.satoken.stp.StpUtil;
import com.xddcodec.fs.framework.common.constant.CommonConstant;
import com.xddcodec.fs.framework.common.context.WorkspaceContext;
import com.xddcodec.fs.system.mapper.SysWorkspaceMemberMapper;
import com.xddcodec.fs.system.domain.SysWorkspaceMember;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.io.IOException;
import java.util.Set;

/**
 * 工作空间拦截器 - 从请求头或请求参数提取工作空间ID并验证成员身份
 * <p>【核心亮点-工作空间】请求级隔离：校验成员后写入 {@link com.xddcodec.fs.framework.common.context.WorkspaceContext}，供文件/权限等模块使用。</p>
 * 
 * 工作空间ID获取优先级：
 * 1. 请求头 X-Workspace-Id（推荐，用于 API 调用）
 * 2. 请求参数 X-Workspace-Id（用于无法设置请求头的场景，如文件下载）
 *
 * @Author: xddcode
 * @Date: 2026/3/31
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WorkspaceInterceptor implements HandlerInterceptor {

    private final SysWorkspaceMemberMapper memberMapper;

    // 不需要工作空间上下文的白名单
    private static final Set<String> WHITELIST = Set.of(
            "/apis/auth/login",
            "/apis/auth/logout",
            "/apis/user/register",
            "/apis/user/info",
            "/apis/user/password",
            "/apis/user/forget-password",
            "/apis/workspace/list",
            "/apis/workspace/check-slug",
            "/apis/permission/list",
            "/apis/transfer/sse",
            "/apis/ai/status",          // AI 状态检测（仅需登录）
            "/apis/ai/chat",            // AI 对话（仅需登录）
            "/apis/invitation/verify",  // 邀请验证接口（公开）
            "/apis/invitation/accept"   // 邀请接受接口（需登录但不需要工作空间）
    );

    @Override
    public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object handler) throws IOException {
        String path = req.getRequestURI();

        // 白名单直接放行
        if (WHITELIST.stream().anyMatch(path::startsWith)) {
            return true;
        }

        // 分享外链：访客通常未登录且无工作空间，与 security.excludes 中的公开分享接口保持一致
        if (isPublicShareApi(path)) {
            return true;
        }

        // POST /apis/workspace（创建工作空间）也不需要
        if ("POST".equals(req.getMethod()) && "/apis/workspace".equals(path)) {
            return true;
        }

        // 获取工作空间ID - 优先从请求头获取，如果没有则从请求参数获取
        String workspaceId = req.getHeader(CommonConstant.X_WORKSPACE_ID);
        if (workspaceId == null || workspaceId.isBlank()) {
            workspaceId = req.getParameter(CommonConstant.X_WORKSPACE_ID);
        }
        
        if (workspaceId == null || workspaceId.isBlank()) {
            res.setStatus(400);
            res.setContentType("application/json;charset=UTF-8");
            res.getWriter().write("{\"code\":400,\"msg\":\"缺少工作空间ID\"}");
            return false;
        }

        // 校验当前用户是否为该工作空间成员
        if (!StpUtil.isLogin()) {
            res.setStatus(401);
            res.setContentType("application/json;charset=UTF-8");
            res.getWriter().write("{\"code\":401,\"msg\":\"未登录\"}");
            return false;
        }

        String userId = StpUtil.getLoginIdAsString();
        SysWorkspaceMember member = memberMapper.findByWorkspaceAndUser(workspaceId, userId);
        if (member == null) {
            res.setStatus(403);
            res.setContentType("application/json;charset=UTF-8");
            res.getWriter().write("{\"code\":403,\"msg\":\"无权访问该工作空间\"}");
            return false;
        }

        // 设置工作空间上下文
        WorkspaceContext.setWorkspaceId(workspaceId);
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        // 清除工作空间上下文
        WorkspaceContext.clear();
    }

    /**
     * 公开分享接口（与 application.yml security.excludes 对齐），不要求 X-Workspace-Id / 登录。
     */
    private static boolean isPublicShareApi(String path) {
        if (path.startsWith("/apis/share/verify/")) {
            return true;
        }
        if (!path.startsWith("/apis/share/")) {
            return false;
        }
        if (path.endsWith("/info")) {
            return true;
        }
        if (path.endsWith("/items")) {
            return true;
        }
        if (path.endsWith("/path")) {
            return true;
        }
        return path.contains("/download/");
    }
}
