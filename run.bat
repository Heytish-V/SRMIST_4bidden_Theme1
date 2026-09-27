@echo off
setlocal enabledelayedexpansion
title Samsung PRISM - Launcher
cd /d "%~dp0"

echo ===============================================================================
echo   SAMSUNG PRISM // AGENTIC CODE ARCHITECTURE INTELLIGENCE
echo   One-Click Launcher (Python Backend + React Vite Frontend)
echo ===============================================================================
echo.

REM 1. Verify virtual environment exists
if not exist ".venv\Scripts\activate.bat" (
    echo [ERROR] Virtual environment not found at .venv\
    echo Please create the virtual environment and install requirements:
    echo   python -m venv .venv
    echo   .venv\Scripts\pip install -r requirements.txt
    echo.
    pause
    exit /b 1
)

REM 2. Verify frontend node_modules exist
if not exist "frontend\node_modules" (
    echo [INFO] frontend\node_modules not found. Installing npm dependencies...
    cd frontend
    call npm install
    cd /d "%~dp0"
    echo.
)

REM 3. Launch Backend in separate titled window
echo [1/2] Spawning Backend Server (FastAPI + Uvicorn) on http://127.0.0.1:8000 ...
start "Samsung PRISM - Backend (FastAPI)" cmd /k "cd /d ""%~dp0"" && title Samsung PRISM [Backend - Port 8000] && call .venv\Scripts\activate.bat && python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000 --reload"

REM 4. Launch Frontend in separate titled window
echo [2/2] Spawning Frontend Dev Server (React + Vite) on http://localhost:5173 ...
start "Samsung PRISM - Frontend (Vite)" cmd /k "cd /d ""%~dp0frontend"" && title Samsung PRISM [Frontend - Port 5173] && npm run dev"

echo.
echo ===============================================================================
echo   SERVICES INITIALIZED:
echo   - Backend REST API:  http://127.0.0.1:8000
echo   - API Documentation: http://127.0.0.1:8000/docs
echo   - Frontend UI:       http://localhost:5173
echo ===============================================================================
echo.
echo Launching default web browser in 4 seconds...
timeout /t 4 /nobreak >nul
start http://localhost:5173

echo.
echo [INFO] You can close this launcher window at any time.
echo To stop the servers, close the individual "Backend" and "Frontend" console windows.
pause
