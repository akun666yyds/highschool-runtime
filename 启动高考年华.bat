@echo off
cd /d "%~dp0"
title Highschool Runtime

if not exist "node_modules\electron\dist\electron.exe" (
  echo Electron is not installed yet.
  echo Please run "npm install" in this folder once, then double-click again.
  pause
  exit /b 1
)

if not exist "dist\index.html" (
  echo First launch: building the app, please wait...
  call npm run build
  if errorlevel 1 (
    echo Build failed. Please run "npm run build" in a terminal to see details.
    pause
    exit /b 1
  )
)

start "" "node_modules\electron\dist\electron.exe" .
exit /b 0
