@echo off
chcp 65001 >nul
REM 复制本文件为 set-ai-env.cmd（已在 .gitignore），填入 DeepSeek 密钥后在本窗口执行：
REM   set-ai-env.cmd
REM   mvn spring-boot:run -DskipTests

set "AI_ENABLED=true"
set "AI_API_KEY=你的DeepSeek密钥"
set "AI_BASE_URL=https://api.deepseek.com/v1"
set "AI_MODEL=deepseek-chat"

echo [set-ai-env] 已设置 AI_* ，请在本窗口启动后端。
