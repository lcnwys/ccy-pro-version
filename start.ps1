Set-Location D:\claude-program\ccy-pro-version\server

# 清理之前的日志
if (Test-Path server.log) { Remove-Item server.log }

# 启动服务器并记录日志
Write-Host "Starting server..."
$env:FORCE_COLOR = "1"
npm run dev *>&1 | Tee-Object -FilePath server.log
