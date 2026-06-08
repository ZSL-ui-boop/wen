@echo off
chcp 65001 >nul
REM 复制本文件为 set-mail-env.cmd，把下面三行改成你的 QQ 邮箱与 SMTP 授权码，然后在本窗口执行：
REM   set-mail-env.cmd
REM   mvn spring-boot:run -DskipTests
REM （授权码在 QQ 邮箱 → 设置 → 账户 → 开启 SMTP 后生成，不是 QQ 登录密码。）

set "SPRING_MAIL_USERNAME=你的QQ号@qq.com"
set "SPRING_MAIL_PASSWORD=你的SMTP授权码"
REM 发件人显示名可改；尖括号内邮箱必须与 SPRING_MAIL_USERNAME 一致
set "SPRING_MAIL_FROM=Free-Fs ^<你的QQ号@qq.com^>"

echo [set-mail-env] 已设置 SPRING_MAIL_* ，请在本窗口启动后端。
