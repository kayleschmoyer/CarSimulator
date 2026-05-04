@echo off
title Garage Simulator Launcher
color 0A

echo.
echo  ==========================================
echo   Garage Simulator -- Starting Up
echo  ==========================================
echo.

:: Get the directory this .bat file lives in (no trailing slash)
set ROOT=%~dp0
set ROOT=%ROOT:~0,-1%

:: ── Python: try py launcher first, then python ────────────────────────────────
set PYTHON=
py --version >nul 2>&1 && set PYTHON=py
if not defined PYTHON python --version >nul 2>&1 && set PYTHON=python
if not defined PYTHON (
    echo  [ERROR] Python not found. Install Python 3.11+ from python.org
    echo  Make sure to check "Add Python to PATH" during install.
    pause
    exit /b 1
)
echo  [OK] Python found: %PYTHON%

:: ── Create venv if needed ─────────────────────────────────────────────────────
if not exist "%ROOT%\backend\.venv\Scripts\activate.bat" (
    echo  [SETUP] Creating virtual environment...
    %PYTHON% -m venv "%ROOT%\backend\.venv"
    if errorlevel 1 (
        echo  [ERROR] Failed to create venv.
        pause & exit /b 1
    )
)

:: ── Install backend deps if needed ────────────────────────────────────────────
if not exist "%ROOT%\backend\.venv\Lib\site-packages\fastapi" (
    echo  [SETUP] Installing backend packages - this takes about 1 minute...
    "%ROOT%\backend\.venv\Scripts\pip.exe" install -r "%ROOT%\backend\requirements.txt"
    if errorlevel 1 (
        echo  [ERROR] pip install failed. Check the output above.
        pause & exit /b 1
    )
)

:: ── Copy .env if missing ───────────────────────────────────────────────────────
if not exist "%ROOT%\backend\.env" (
    if exist "%ROOT%\.env.example" (
        copy "%ROOT%\.env.example" "%ROOT%\backend\.env" >nul
        echo  [SETUP] Created backend\.env - add ANTHROPIC_API_KEY to enable AI parsing
    )
)

:: ── Install frontend deps if needed ───────────────────────────────────────────
if not exist "%ROOT%\frontend\node_modules" (
    echo  [SETUP] Installing frontend packages - this takes about 1 minute...
    cd /d "%ROOT%\frontend"
    npm install
    if errorlevel 1 (
        echo  [ERROR] npm install failed. Make sure Node.js 18+ is installed.
        pause & exit /b 1
    )
)

:: ── Launch backend in new window ──────────────────────────────────────────────
echo  [1/2] Starting backend on http://localhost:8000 ...
start "Backend - Garage Simulator" cmd /k "cd /d "%ROOT%\backend" && ".venv\Scripts\activate.bat" && uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"

:: Wait for backend to be ready
timeout /t 3 /nobreak >nul

:: ── Launch frontend in new window ─────────────────────────────────────────────
echo  [2/2] Starting frontend on http://localhost:5173 ...
start "Frontend - Garage Simulator" cmd /k "cd /d "%ROOT%\frontend" && npm run dev"

:: Wait then open browser
timeout /t 5 /nobreak >nul
echo  Opening browser...
start "" http://localhost:5173

echo.
echo  ==========================================
echo   Running! Browser should open shortly.
echo   Close the two terminal windows to stop.
echo  ==========================================
echo.
pause
