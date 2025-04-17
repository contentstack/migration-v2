@echo off
SETLOCAL

echo Checking if NVM is already installed...

where nvm >nul 2>nul
IF %ERRORLEVEL% EQU 0 (
    echo NVM is already installed. Skipping installation.
    goto run_setup
)

echo NVM not found. Checking for winget...

where winget >nul 2>nul
IF %ERRORLEVEL% EQU 0 (
    echo Installing NVM using winget...
    winget install -e --id CoreyButler.NVMforWindows
    goto check_nvm
)

echo winget not found. Installing NVM manually...
SET NVM_URL=https://github.com/coreybutler/nvm-windows/releases/latest/download/nvm-setup.exe
SET NVM_INSTALLER=%TEMP%\nvm-setup.exe

IF EXIST "%NVM_INSTALLER%" DEL /F /Q "%NVM_INSTALLER%"

powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%NVM_URL%' -OutFile '%NVM_INSTALLER%'"

IF EXIST "%NVM_INSTALLER%" (
    echo Running NVM installer...
    start /wait "" "%NVM_INSTALLER%"
) ELSE (
    echo Failed to download NVM installer.
    pause
    exit /b 1
)

:check_nvm
echo Verifying NVM installation...

where nvm >nul 2>nul
IF %ERRORLEVEL% NEQ 0 (
    echo NVM installation failed or not detected in PATH.
    echo Please restart your terminal and try again, or install manually:
    echo https://github.com/coreybutler/nvm-windows
    pause
    exit /b 1
)

:run_setup
echo NVM is ready. Running setup.bat...
call setup.bat
