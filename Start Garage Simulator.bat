@echo off
title Garage Simulator — Launcher
color 0A

echo.
echo  ==========================================
echo   Garage Simulator — Starting Up...
echo  ==========================================
echo.

:: ── Find Python ───────────────────────────────────────────────────────────────
set PYTHON=
for %%P in (py python python3) do (
    if not defined PYTHON (
        where %%P >nul 2>&1 && set PYTHON=%%P
    )
)
if not defined PYTHON (
    echo  [ERROR] Python not found. Install Python 3.11+ from python.org
    pause
    exit /b 1
)

:: ── Set up backend venv if needed ─────────────────────────────────────────────
set VENV=%~dp0backend\.venv
if not exist "%VENV%\Scripts\activate.bat" (
    echo  [SETUP] Creating Python virtual environment...
    %PYTHON% -m venv "%VENV%"
    echo  [SETUP] Installing backend dependencies (first run only, ~1 min)...
    call "%VENV%\Scripts\activate.bat"
    pip install -r "%~dp0backend\requirements.txt" --quiet
) else (
    call "%VENV%\Scripts\activate.bat"
)

:: ── Copy .env if missing ───────────────────────────────────────────────────────
if not exist "%~dp0backend\.env" (
    if exist "%~dp0.env.example" (
        copy "%~dp0.env.example" "%~dp0backend\.env" >nul
        echo  [SETUP] Created backend\.env from .env.example
    )
)

:: ── Start backend ─────────────────────────────────────────────────────────────
echo  [1/3] Starting backend server...
start "Garage Simulator — Backend" cmd /k "cd /d "%~dp0backend" && call ".venv\Scripts\activate.bat" && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

:: ── Install frontend deps if needed ───────────────────────────────────────────
if not exist "%~dp0frontend\node_modules" (
    echo  [SETUP] Installing frontend dependencies (first run only, ~1 min)...
    cd /d "%~dp0frontend"
    npm install --silent
)

:: ── Start frontend ─────────────────────────────────────────────────────────────
echo  [2/3] Starting frontend dev server...
start "Garage Simulator — Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

:: ── Wait then open browser ─────────────────────────────────────────────────────
echo  [3/3] Opening browser in 4 seconds...
timeout /t 4 /nobreak >nul
start "" "http://localhost:5173"

echo.
echo  ==========================================
echo   Garage Simulator is running!
echo   Browser: http://localhost:5173
echo   Backend: http://localhost:8000
echo.
echo   Close the two terminal windows to stop.
echo  ==========================================
echo.
pause
