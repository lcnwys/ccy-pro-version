Set-Location D:\claude-program\ccy-pro-version\server

# 删除旧日志
if (Test-Path "startup.log") { Remove-Item "startup.log" }

# 启动服务器
Write-Host "Starting server..."
npm run dev > startup.log 2>&1

Write-Host "Server process ended. Check startup.log for details."
