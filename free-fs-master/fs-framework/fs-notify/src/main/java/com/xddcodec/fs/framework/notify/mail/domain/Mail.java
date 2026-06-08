package com.xddcodec.fs.framework.notify.mail.domain;

import com.xddcodec.fs.framework.notify.mail.constant.MailTemplateConstant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.HashMap;
import java.util.Map;

@Builder
@Data
@AllArgsConstructor
@NoArgsConstructor
public class Mail {

    /**
     * 收件人
     */
    private String recipient;
    /**
     * 主题
     */
    private String subject;
    /**
     * 内容
     */
    private String content;

    /**
     * 模板
     */
    private String htmlTemplate;

    /**
     * 模板参数
     */
    private Map<String, Object> params;

    /**
     * 附件
     */
    private String attachment;

    /**
     * 构建验证码邮件
     *
     * @param recipient 收件人
     * @param name      收件人名称
     * @param code      验证码
     * @return
     */
    public static Mail buildVerifyCodeMail(String recipient, String name, String code) {
        Map<String, Object> params = new HashMap<>();
        params.put("name", name);
        params.put("code", code);
        return Mail.builder()
                .subject("验证码")
                .recipient(recipient)
                .params(params)
                .htmlTemplate(MailTemplateConstant.VERIFICATION_CODE_TEMPLATE)
                .build();
    }

    /**
     * 构建空间成员邀请通知邮件
     *
     * @param recipient     收件人
     * @param inviterName   邀请人名称
     * @param workspaceName 空间名称
     * @param roleName      角色名称
     * @param inviteUrl     邀请链接
     * @return
     */
    public static Mail buildWorkspaceMemberInviteMail(String recipient, String inviterName, String workspaceName, String roleName, String inviteUrl) {
        Map<String, Object> params = new HashMap<>();
        params.put("inviterName", inviterName);
        params.put("workspaceName", workspaceName);
        params.put("roleName", roleName);
        params.put("inviteUrl", inviteUrl);
        return Mail.builder()
                .subject("空间成员邀请通知")
                .recipient(recipient)
                .params(params)
                .htmlTemplate(MailTemplateConstant.WORKSPACE_MEMBER_INVITE_TEMPLATE)
                .build();
    }
}
