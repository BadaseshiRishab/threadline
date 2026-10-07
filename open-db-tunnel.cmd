@echo off
rem Double-click to reach the AWS server's MongoDB from this PC (MongoDB Compass or npm run dev).
rem Keep this window open while you use the database; close it (or press Ctrl+C) to stop.
title Threadline database tunnel - keep this window open
cd /d "%~dp0"
echo Compass: mongodb://127.0.0.1:27019/threadline?directConnection=true  (Proxy/SSH: None)
echo.
call npm run db:tunnel
echo.
echo The tunnel has stopped.
pause
