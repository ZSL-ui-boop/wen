@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

if exist "%~dp0set-redis-env.cmd" (
  call "%~dp0set-redis-env.cmd"
  echo 已加载 set-redis-env.cmd
)

echo [1/3] 检查 Redis（127.0.0.1:6379）...
set REDIS_OK=0

where redis-cli >nul 2>&1
if not errorlevel 1 (
  if defined SPRING_DATA_REDIS_PASSWORD (
    redis-cli -h 127.0.0.1 -p 6379 -a "%SPRING_DATA_REDIS_PASSWORD%" ping 2>nul | findstr /i PONG >nul && set REDIS_OK=1
  ) else (
    redis-cli -h 127.0.0.1 -p 6379 ping 2>nul | findstr /i PONG >nul && set REDIS_OK=1
  )
)

if "%REDIS_OK%"=="1" (
  echo 本机 Redis 已可访问，跳过 Docker。
) else (
  echo 未检测到可用 Redis，尝试用 Docker 启动（无密码，与 application-dev 默认一致）...
  docker compose -f docker-compose.redis-dev.yml up -d
  if errorlevel 1 (
    echo.
    echo 失败：请安装并启动本机 Redis，或安装 Docker Desktop 后重试。
    exit /b 1
  )
  timeout /t 2 /nobreak >nul
  docker exec free-fs-redis-dev redis-cli ping 2>nul | findstr /i PONG >nul
  if errorlevel 1 (
    echo Docker 内 Redis PING 失败: docker logs free-fs-redis-dev
    exit /b 1
  )
  echo Docker Redis 正常。
)

echo.
echo [2/3] 结束占用 8080 端口的进程（如有）...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8080 ^| findstr LISTENING') do (
  echo 结束 PID %%a
  taskkill /F /PID %%a 2>nul
)

echo.
echo [3/3] 启动后端 fs-admin（新窗口，便于看日志）...
cd fs-admin
start "free-fs-backend" cmd /k "cd /d %CD% && if exist ..\set-redis-env.cmd call ..\set-redis-env.cmd && mvn spring-boot:run"

echo.
echo 完成。请在新窗口等待出现 Started FsAdminApplication 后再访问前端登录。
endlocal
