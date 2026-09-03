@echo off
REM Capture the connected device's screen into screenshots\.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0screenshot-device.ps1" %*
set "SHOT_EXITCODE=%errorlevel%"
echo.
if %SHOT_EXITCODE% neq 0 (
    echo Screenshot failed - see the output above.
) else (
    echo Screenshot saved.
)
echo Press any key to close this window...
pause >nul
exit /b %SHOT_EXITCODE%
