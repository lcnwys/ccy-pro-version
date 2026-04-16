cd D:\claude-program\ccy-pro-version\server
$env:FORCE_COLOR="1"
npm run dev 2>&1 | Tee-Object -FilePath server.log
