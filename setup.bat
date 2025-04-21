SETLOCAL ENABLEDELAYEDEXPANSION

SET SCRIPT_DIR=%~dp0
CD /D "%SCRIPT_DIR%"

call nvm install 21
call nvm use 21

REM Call second script in a new process to reload env
start "" cmd /k "%SCRIPT_DIR%setup-continue.bat"