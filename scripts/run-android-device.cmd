@echo off
REM Install a debug build on a connected device and start Metro.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-android-device.ps1" %*
set "RUN_EXITCODE=%errorlevel%"
echo.
if %RUN_EXITCODE% neq 0 (
    echo Run failed - see the output above.
) else (
    echo Run finished.
)
echo Press any key to close this window...
pause >nul
exit /b %RUN_EXITCODE%
