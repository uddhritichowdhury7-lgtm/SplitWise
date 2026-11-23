@echo off
setlocal
cd /d "%~dp0"
title SplitWise - First Run Setup

echo ============================================
echo       SPLITWISE - FIRST TIME SETUP
echo ============================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is not installed. Install Node.js LTS, then run this file again.
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm was not found. Reinstall Node.js LTS and try again.
  pause
  exit /b 1
)

node scripts\prepare-env.js
if errorlevel 1 goto failed

echo.
echo [1/5] Installing project dependencies...
npm install --no-audit --no-fund
if errorlevel 1 goto failed

echo.
echo [2/5] Formatting and validating database schema...
npx prisma format
if errorlevel 1 goto failed
npx prisma validate
if errorlevel 1 goto failed

echo.
echo [3/5] Creating/updating local SQLite database...
npx prisma db push
if errorlevel 1 goto failed

echo.
echo [4/5] Generating Prisma client...
npx prisma generate
if errorlevel 1 goto failed

echo.
echo [5/5] Adding demo accounts and sample group...
npm run seed
if errorlevel 1 goto failed

echo.
echo ============================================
echo SETUP COMPLETE. STARTING SPLITWISE...
echo ============================================
echo Open http://localhost:5000 in your browser.
echo Demo login: aarav@example.com  /  password123
echo Press Ctrl+C in this window to stop the server.
echo.
npm start
pause
exit /b 0

:failed
echo.
echo SETUP FAILED. Copy the first red error from this window and send it.
pause
exit /b 1
