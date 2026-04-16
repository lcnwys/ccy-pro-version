@echo off
echo ================================
echo   创次元 PRO - 启动脚本
echo ================================
echo.

cd /d %~dp0

echo [1/3] 检查 Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js 未安装，请先安装 Node.js 20+
    pause
    exit /b 1
)
echo Node.js 已安装

echo.
echo [2/3] 安装依赖...

echo 安装 server 依赖...
cd server
call npm install
cd ..

echo 安装 client 依赖...
cd client
call npm install
cd ..

echo 安装根目录依赖...
call npm install

echo.
echo [3/3] 启动开发服务器...
echo.
echo 前端地址：http://localhost:5173
echo 后端地址：http://localhost:3000
echo API 测试：http://localhost:3000/api/v1/functions
echo.
echo 按 Ctrl+C 停止所有服务
echo.

REM 使用 concurrently 启动
call npm run dev

echo.
echo 服务器已停止。
pause
