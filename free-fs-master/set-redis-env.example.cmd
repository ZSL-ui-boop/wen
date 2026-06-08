@echo off
REM 用法：复制本文件为 set-redis-env.cmd，按你的 Redis 改下面几行（不要提交 set-redis-env.cmd）
REM 在 restart-backend-with-redis.bat 里会自动 call，或先在 CMD 里执行再 mvn spring-boot:run

REM set SPRING_DATA_REDIS_HOST=127.0.0.1
REM set SPRING_DATA_REDIS_PORT=6379

REM 仅当 Redis 启用了 requirepass 时取消注释并填写：
REM set SPRING_DATA_REDIS_PASSWORD=你的密码
