package com.xddcodec.fs.framework.notify.mail.listener;

import com.xddcodec.fs.framework.notify.mail.MailService;
import com.xddcodec.fs.framework.notify.mail.domain.Mail;
import com.xddcodec.fs.framework.notify.mail.event.MailEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * 邮件监听器
 *
 * @Author: xddcode
 * @Date: 2025/10/22 15:48
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MailListener {

    private final MailService mailService;

    @EventListener
    public void handleIrrigControlCommandRecordAddEvent(MailEvent event) {
        Mail mail = event.getMail();
        mailService.sendHtmlMail(mail);
    }
}
