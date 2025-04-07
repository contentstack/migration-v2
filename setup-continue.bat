@echo off
SET SCRIPT_DIR=%~dp0
CD /D "%SCRIPT_DIR%"

echo Using Node version:
node -v

IF EXIST "%SCRIPT_DIR%\cli" (
    echo CLI folder exists.
    call npm --prefix ./cli run setup-repo
) ELSE (
    echo ERROR: CLI folder does not exist.
    exit /b 1
)

call npm run setup:file
call npm run create:env

start "API" cmd /k "cd /d %SCRIPT_DIR%\api && npm install && npm run windev"
start "Upload API" cmd /k "cd /d %SCRIPT_DIR%\upload-api && npm install && npm run start"
start "UI" cmd /k "cd /d %SCRIPT_DIR%\ui && npm install && npm run start"

echo All services started!