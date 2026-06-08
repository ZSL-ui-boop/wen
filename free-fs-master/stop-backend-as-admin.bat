@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 将弹出 UAC：确认后在管理员窗口中释放 8080（后端）与 2002（LibreOffice）。
powershell -NoProfile -ExecutionPolicy Bypass -Command "$f='%~dp0scripts\stop-backend-8080.ps1'; Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-NoExit','-File', $f"
exit /b 0
