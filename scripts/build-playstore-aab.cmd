@echo off
REM Build a Play Store AAB (all ABIs) for upload.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-playstore-aab.ps1" %*
set "BUILD_EXITCODE=%errorlevel%"
echo.
if %BUILD_EXITCODE% neq 0 (
    echo Build did not produce an uploadable AAB - see the output above.
) else (
    echo Build finished.
)
echo Press any key to close this window...
pause >nul
exit /b %BUILD_EXITCODE%
