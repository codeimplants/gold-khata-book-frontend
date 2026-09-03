@echo off
REM Build a test APK (arm64) for installing on a phone.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-test-apk.ps1" %*
set "BUILD_EXITCODE=%errorlevel%"
echo.
if %BUILD_EXITCODE% neq 0 (
    echo Build failed - see the output above.
) else (
    echo Build finished.
)
echo Press any key to close this window...
pause >nul
exit /b %BUILD_EXITCODE%
