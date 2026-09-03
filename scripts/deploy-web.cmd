@echo off
REM Build the web app and deploy it to Firebase Hosting.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy-web.ps1" %*
set "DEPLOY_EXITCODE=%errorlevel%"
echo.
if %DEPLOY_EXITCODE% neq 0 (
    echo Deploy failed - see errors above.
) else (
    echo Deploy finished.
)
echo Press any key to close this window...
pause >nul
exit /b %DEPLOY_EXITCODE%
