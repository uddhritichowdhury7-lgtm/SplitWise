@echo off
cd /d "%~dp0"
if not exist .env (
  node scripts\prepare-env.js
)
if not exist node_modules (
  echo Dependencies are missing. Run RUN_ME_FIRST.bat first.
  pause
  exit /b 1
)
npm start
pause
