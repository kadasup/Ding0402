@echo off
echo Starting Ding Bento App...
echo ===============================
echo Please wait while the system connects to Nook Inc...
echo ===============================

cd /d "%~dp0"

start "" "http://localhost:5173"

npm run dev

pause
