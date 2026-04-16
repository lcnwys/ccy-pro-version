@echo off
cd /d %~dp0
echo Starting server...
npx tsx src/index.ts
pause
