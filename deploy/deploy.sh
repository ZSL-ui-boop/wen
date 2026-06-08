#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELEASE_DIR="$(dirname "$SCRIPT_DIR")"
APP_ROOT="${APP_ROOT:-$(dirname "$RELEASE_DIR")}"

mkdir -p "$APP_ROOT/frontend" "$APP_ROOT/backend" "$APP_ROOT/logs" "$APP_ROOT/deploy"

echo "==> 部署前端"
rsync -av --delete "$RELEASE_DIR/frontend/" "$APP_ROOT/frontend/"

echo "==> 部署后端"
cp -f "$RELEASE_DIR/backend/fs-admin.jar" "$APP_ROOT/backend/fs-admin.jar"

echo "==> 生成 pm2 配置"
sed "s|__APP_ROOT__|${APP_ROOT}|g" "$SCRIPT_DIR/ecosystem.config.cjs" > "$APP_ROOT/deploy/ecosystem.config.cjs"

echo "==> 重启服务"
if command -v pm2 >/dev/null 2>&1; then
  pm2 startOrReload "$APP_ROOT/deploy/ecosystem.config.cjs" --update-env || pm2 restart free-fs || true
else
  echo "未安装 pm2，请手动: java -jar $APP_ROOT/backend/fs-admin.jar --spring.profiles.active=prod"
fi

echo "==> 部署完成"
