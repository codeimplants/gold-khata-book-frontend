@echo off
REM ===========================================================================
REM  Gold Khata Book - start the React Native web app locally, against whichever
REM  backend you choose.
REM
REM    1) dev    https://dev.api.goldkhatabook.codeimplants.com   (default)
REM    2) prod   https://api.goldkhatabook.codeimplants.com       READ-ONLY
REM    3) local  http://localhost:<PORT from the backend's .env>
REM
REM  Dev is the default because it is the shared, deployed backend: what you see
REM  is what a test APK sees, and there is no local database to seed, migrate or
REM  keep in step with the server. Choosing dev or prod starts ONLY the web
REM  window - no MongoDB, no local backend.
REM
REM  PROD IS READ-ONLY, and enforced rather than promised. The web build is
REM  given API_READONLY=1, which src/api/apiClient.ts uses to refuse every
REM  POST/PUT/PATCH/DELETE. Pointing a dev session at prod is a reasonable thing
REM  to do - reproducing what a shop reports usually needs their real data - but
REM  every screen that shows that data also has buttons that write it, and one
REM  stray click edits a real retailer's ledger. The block is on the HTTP method,
REM  so it covers mutations nobody has written yet.
REM
REM  --- Where this file lives -------------------------------------------------
REM
REM  This script lives IN the frontend repo and resolves everything from its own
REM  location (%~dp0), so it works from any checkout path and needs no editing.
REM  It used to sit one level up, outside both repos and outside git, where it
REM  had no version history at all despite being the entry point for local dev.
REM
REM  Options 1 and 2 need nothing but this repo. Option 3 additionally needs the
REM  backend checkout and MongoDB as SIBLINGS of this repo:
REM
REM    <parent>\
REM      gold-khata-book-frontend\   <- this repo, this script
REM      gold-khata-book-backend\    <- only needed for option 3
REM      .mongodb\                   <- only needed for option 3
REM
REM  A standalone clone of just the frontend therefore supports dev and prod but
REM  not local, and says so rather than failing obscurely.
REM
REM  --- Local mode ------------------------------------------------------------
REM
REM    "GKB MongoDB"  ..\.mongodb\bin\mongod.exe    -> 127.0.0.1:27017
REM    "GKB Backend"  ..\gold-khata-book-backend    -> http://localhost:<PORT>
REM    "GKB Web"      this repo                     -> http://localhost:8081
REM                                                    (next free port from 8081)
REM
REM  MongoDB is the portable zip build under .mongodb - no Windows service and
REM  no admin rights, because winget is blocked by Group Policy on this machine.
REM  Its data lives in .mongodb\data. If a MongoDB is already listening on 27017
REM  (a service, or a container) this script uses that one instead.
REM
REM  Windows opens up to three windows and leaves them open (cmd /k) so a crash
REM  stays readable instead of the window vanishing. Close a window, or Ctrl+C in
REM  it, to stop that part.
REM ===========================================================================

setlocal

REM  Resolved to full paths with no trailing backslash, so they can be joined
REM  with \ consistently and quoted safely.
for %%i in ("%~dp0.")   do set "FRONTEND=%%~fi"
for %%i in ("%~dp0..")  do set "PARENT=%%~fi"

set "BACKEND=%PARENT%\gold-khata-book-backend"
set "MONGO_HOME=%PARENT%\.mongodb"
set "MONGO_EXE=%MONGO_HOME%\bin\mongod.exe"
set "MONGO_DATA=%MONGO_HOME%\data"
set "MONGO_LOG=%MONGO_HOME%\log"

set "DEV_API=https://dev.api.goldkhatabook.codeimplants.com/api/"
set "PROD_API=https://api.goldkhatabook.codeimplants.com/api/"

echo.
echo  ==========================================
echo   Gold Khata Book - local dev
echo  ==========================================
echo.

REM --- Which backend? --------------------------------------------------------
REM  If stdin is redirected (launched from another tool rather than a console)
REM  set /p leaves CHOICE undefined and the default applies, rather than hanging.
echo  Which backend should the web app talk to?
echo.
echo    1^) dev    - %DEV_API%
echo    2^) prod   - %PROD_API%
echo               ^*^*^* REAL SHOP DATA - opened READ-ONLY ^*^*^*
echo    3^) local  - starts MongoDB and the backend next to this repo
echo.
set "CHOICE="
set /p "CHOICE=  Enter 1-3 [1]: "
if not defined CHOICE set "CHOICE=1"

set "REMOTE="
set "READONLY="
if "%CHOICE%"=="1" goto :mode_dev
if "%CHOICE%"=="2" goto :mode_prod
if "%CHOICE%"=="3" goto :mode_local
echo.
echo  [X] "%CHOICE%" is not one of 1, 2 or 3.
goto :fail

:mode_dev
set "API_URL=%DEV_API%"
set "MODE=dev (hosted)"
set "REMOTE=1"
goto :mode_done

:mode_prod
set "API_URL=%PROD_API%"
set "MODE=prod (hosted, READ-ONLY)"
set "REMOTE=1"
set "READONLY=1"
goto :mode_done

:mode_local
set "MODE=local"
goto :mode_done

:mode_done
echo.
echo  [ok] backend: %MODE%

REM --- Node ------------------------------------------------------------------
where node >nul 2>&1
if errorlevel 1 (
    echo  [X] Node.js is not on PATH. Install Node 20+ and re-run.
    goto :fail
)
for /f "delims=" %%v in ('node --version') do echo  [ok] Node %%v

REM --- This repo -------------------------------------------------------------
if not exist "%FRONTEND%\package.json" (
    echo  [X] No package.json next to this script: %FRONTEND%
    echo      This script must live in the root of the frontend repo.
    goto :fail
)

if not exist "%FRONTEND%\node_modules" (
    echo  [..] Installing frontend dependencies, first run only. This takes a few minutes...
    pushd "%FRONTEND%"
    call npm install --no-audit --no-fund
    if errorlevel 1 ( popd & goto :fail )
    popd
)
echo  [ok] frontend dependencies

REM  Gitignored, so a fresh clone will not have it, and the env configs import
REM  from it - the web build cannot resolve the module without it.
if not exist "%FRONTEND%\src\config\secrets.ts" (
    echo  [..] Creating src\config\secrets.ts from the example
    copy /y "%FRONTEND%\src\config\secrets.example.ts" "%FRONTEND%\src\config\secrets.ts" >nul
)
echo  [ok] frontend secrets.ts

REM  Everything below is only needed to run a backend on this machine. Dev and
REM  prod are already running on the VPS.
if defined REMOTE goto :launch

REM --- Backend checks (local mode only) --------------------------------------
if not exist "%BACKEND%\package.json" (
    echo.
    echo  [X] Local mode needs the backend repo as a sibling of this one:
    echo        %BACKEND%
    echo.
    echo      Clone it there, or re-run and choose 1 ^(dev^) - which needs
    echo      nothing but this repo.
    goto :fail
)

if not exist "%BACKEND%\.env" (
    echo  [X] %BACKEND%\.env is missing.
    echo      Copy .env.example to .env and set the database URLs.
    goto :fail
)
echo  [ok] backend .env present

REM  Read the port from .env rather than hardcoding it. They drifted apart once
REM  already: .env.example moved to 7111 when the server layout changed, while
REM  this script still sent the web app to 7100, so the app pointed at nothing
REM  and the backend window looked perfectly healthy.
set "LOCAL_PORT=7100"
for /f "usebackq tokens=2 delims==" %%p in (`findstr /b /c:"PORT=" "%BACKEND%\.env"`) do set "LOCAL_PORT=%%p"
set "API_URL=http://localhost:%LOCAL_PORT%/api/"
echo  [ok] backend port %LOCAL_PORT% (from .env)

if not exist "%BACKEND%\node_modules" (
    echo  [..] Installing backend dependencies, first run only...
    pushd "%BACKEND%"
    call npm install --no-audit --no-fund
    if errorlevel 1 ( popd & goto :fail )
    popd
)
echo  [ok] backend dependencies

REM --- MongoDB (local mode only) ---------------------------------------------
call :isMongoUp
if defined MONGO_UP (
    echo  [ok] MongoDB already listening on 27017 - using it
    goto :mongo_ready
)

if not exist "%MONGO_EXE%" (
    echo.
    echo  [X] MongoDB is not running, and the portable build is missing:
    echo        %MONGO_EXE%
    echo.
    echo      Download the Windows zip and extract it so that mongod.exe sits at
    echo      the path above:
    echo        https://www.mongodb.com/try/download/community
    echo.
    echo      Or start any other MongoDB on 127.0.0.1:27017 and re-run.
    echo      Or re-run and choose 1 ^(dev^) to skip the local backend entirely.
    goto :fail
)

if not exist "%MONGO_DATA%" mkdir "%MONGO_DATA%"
if not exist "%MONGO_LOG%"  mkdir "%MONGO_LOG%"

echo  [..] Starting MongoDB from the portable build
start "GKB MongoDB" cmd /k ""%MONGO_EXE%" --dbpath "%MONGO_DATA%" --bind_ip 127.0.0.1 --port 27017"

REM  Wait for it to accept connections. The backend gives up after 5 tries, so
REM  it is worth holding here rather than racing it.
REM
REM  The delay is `ping`, not `timeout`. `timeout` refuses to run when stdin is
REM  redirected ("ERROR: Input redirection is not supported"), which is exactly
REM  what happens when this script is launched from another tool rather than a
REM  console. It failed instantly all 30 times, so the loop finished in about a
REM  second and reported MongoDB down while it was still starting up fine.
set "MONGO_UP="
for /l %%i in (1,1,30) do (
    if not defined MONGO_UP (
        ping -n 2 127.0.0.1 >nul 2>&1
        call :isMongoUp
    )
)

if not defined MONGO_UP (
    echo.
    echo  [X] MongoDB did not come up on 27017 within 30 seconds.
    echo      Check the "GKB MongoDB" window for the reason.
    goto :fail
)
echo  [ok] MongoDB is up on 27017

:mongo_ready

echo.
echo  Starting backend  -^> http://localhost:%LOCAL_PORT%
start "GKB Backend" cmd /k "cd /d "%BACKEND%" && npm run dev"

REM --- Launch the web app ----------------------------------------------------
:launch
echo.
echo  Starting web app  -^> browser opens on the first free port from 8081
if defined READONLY (
    start "GKB Web [PROD READ-ONLY]" cmd /k "cd /d "%FRONTEND%" && set "API_BASE_URL=%API_URL%" && set "API_READONLY=1" && npm run dev"
) else (
    start "GKB Web" cmd /k "cd /d "%FRONTEND%" && set "API_BASE_URL=%API_URL%" && npm run dev"
)

echo.
echo  Started. The web app talks to %API_URL%
if defined READONLY (
    echo.
    echo  *** READ-ONLY. This is PRODUCTION - real shops' real ledgers. ***
    echo      Saving anything will fail on purpose; that is the safeguard
    echo      working, not a bug. Re-run and choose 1 to make changes.
)
echo.
echo  Test login without spending real SMS: phone 1234567890, OTP 123456.
echo  Any other number sends a REAL SMS through the shared 2Factor account.
echo.
goto :eof

REM --- helper: sets MONGO_UP if something is listening on 27017 ---------------
:isMongoUp
set "MONGO_UP="
netstat -ano | findstr /c:":27017" | findstr /c:"LISTENING" >nul 2>&1
if not errorlevel 1 set "MONGO_UP=1"
goto :eof

:fail
echo.
echo  Startup aborted.
echo.
exit /b 1
