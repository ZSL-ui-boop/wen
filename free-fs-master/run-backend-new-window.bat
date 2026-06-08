@echo off
cd /d "%~dp0"
if exist set-redis-env.cmd call set-redis-env.cmd
cd /d "%~dp0fs-admin"
start "free-fs-backend" cmd /k "cd /d %CD% && if exist ..\set-redis-env.cmd call ..\set-redis-env.cmd && mvn spring-boot:run"
