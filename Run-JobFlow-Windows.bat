@echo off
setlocal EnableExtensions
pushd "%~dp0"
title JobFlow Standalone Local Booter
color 0B
cls
echo =======================================================================
echo     __         __     ______ __     ______ _       _   _ _ 
echo    /  \       /  \   / _____/ \ \   / _____/ \     / / / / / 
echo   / /\ \     / /\ \ / /      \ \ \ / /      \ \   / / / / /  
echo  / /__\ \   / /__\ \ \ \      \ \ \ \ \      \ \_/ / /_/_/   
echo /_/    \_\ /_/    \_\ \_____/  \_/ \_____/    \___/ (_/_)    
echo =======================================================================
echo.
echo           --- OPTION 2: STANDALONE PORTABLE WORKSPACE ---
echo.
echo  Initializing pre-flight environment checks on your PC...
echo.

:: 1. Verifying Node.js Presence
where node >nul 2>nul
if errorlevel 1 (
    color 0C
    echo [ERROR] Node.js was not detected on your system.
    echo JobFlow requires Node.js ^(v18 or higher^) to host the local Express backend,
    echo parse incoming recruiter emails, and interact with the Gemini AI model.
    echo.
    echo Opening browser to official Node.js installer page...
    explorer "https://nodejs.org/"
    echo.
    echo Install Node.js, restart your terminal, and run this batch file again.
    pause
    popd
    exit /b 1
)

echo [SUCCESS] Node.js environment detected:
node -v
echo.

:: 2. Verifying and Creating local .env variables
if not exist .env (
    echo [INFO] Local .env parameters file missing. Cloning from template...
    copy .env.example .env >nul
    echo.
    echo ==================================================================
    echo !! ACTION REQUIRED: GEMINI API KEY CONFIGURATION !!
    echo.
    echo A clean '.env' file has been created in this folder root.
    echo To allow AI-tailoring and critique, open '.env' in Notepad and write:
    echo GEMINI_API_KEY=your_actual_api_key_here
    echo GOOGLE_CLIENT_ID=your_oauth_web_client_id.apps.googleusercontent.com
    echo ==================================================================
    echo.
    timeout /t 5 >nul
)

:: 3. Installing dependencies if node_modules don't exist
if not exist node_modules\ (
    echo [INFO] Modules folder is empty. Initiating silent local dependency install...
    echo ^(This may take 1-2 minutes on the first startup depending on your connection^)
    echo.
    call npm install
    if errorlevel 1 (
        color 0C
        echo [ERROR] Dependency installation failed.
        echo Please ensure you are connected to the internet and run: npm install
        pause
        popd
        exit /b 1
      )
    echo.
    echo [SUCCESS] Standalone local node packages configured.
)

:: 4. Auto-launching local browser segment concurrently
echo [INFO] Dispatching browser connector node...
start http://localhost:3000

echo [SUCCESS] Booting core Express backend server on local Port 3000...
echo Connection details are completely stored internally inside your PC workspace.
echo Press [Ctrl + C] or close this window to terminate the local process tracker.
echo.
echo =======================================================================
echo.

call npm run dev
pause
popd
