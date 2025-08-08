@echo off
REM Start frontend (in the background)
start "frontend" cmd /c npm start

REM Change to backend directory and start backend (in new window)
cd flask
start "backend" cmd /k python app.py
cd ..

REM Wait for user to close (batch scripts can't easily track PIDs like bash)
echo.
echo Both frontend and backend have been started in separate windows.
echo Press any key to exit this script. Closing this window does NOT stop the servers.
pause >nul