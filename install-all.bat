@echo off
echo ================================
echo   创次元 PRO - 一键安装
echo ================================
echo.

cd /d %~dp0

echo.
echo [1/2] 安装 Server 依赖...
cd server
call npm install
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Server 依赖安装失败
    pause
    exit /b 1
)

echo.
echo [2/2] 安装 Client 依赖...
cd ../client
call npm install
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Client 依赖安装失败
    pause
    exit /b 1
)

cd ..

echo.
echo ================================
echo   安装完成！
echo ================================
echo.
echo 现在可以运行 start.bat 启动服务
echo.
pause
