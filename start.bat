@echo off
cd /d "%~dp0"

echo =================================
echo   ABL 26 - Player Auction
echo =================================
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node.js is not installed.
    echo.
    echo Install it from: https://nodejs.org ^(v18+ required^)
    echo.
    pause
    exit /b 1
)

echo Node.js detected
node -v
echo.

:: Install dependencies if needed
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    echo.
)

:: Check for mode argument
set MODE=%1
if "%MODE%"=="" set MODE=dev

if "%MODE%"=="preview" goto :preview
if "%MODE%"=="prod" goto :preview
goto :dev

:preview
echo Building for production...
call npm run build
echo.
echo Starting preview server...
echo Open the URL shown below in your browser
echo.
call npx vite preview --host
goto :end

:dev
echo Starting development server...
echo Open the URL shown below in your browser
echo.
call npx vite --host
goto :end

:end
pause
