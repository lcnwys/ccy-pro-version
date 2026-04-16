@echo off
cd /d %~dp0
echo ================================
echo   安装 Server 依赖
echo ================================
echo.
call npm install
echo.
echo 按任意键关闭...
pause > nul
