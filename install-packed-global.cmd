@echo off
setlocal

cd /d "%~dp0"

if not exist "node_modules\typescript\package.json" (
  echo [omx] Installing workspace dependencies...
  call npm ci
  if errorlevel 1 (
    set "EXITCODE=%ERRORLEVEL%"
    goto report
  )
)

echo [omx] Building workspace...
call npm run build
if errorlevel 1 (
  set "EXITCODE=%ERRORLEVEL%"
  goto report
)

echo [omx] Packing current workspace and installing globally...
call npm run install:packed-global
set "EXITCODE=%ERRORLEVEL%"

if "%EXITCODE%"=="" set "EXITCODE=0"

:report
echo.
if not "%EXITCODE%"=="0" (
  echo [omx] FAILED with exit code %EXITCODE%.
) else (
  echo [omx] Done.
)
echo.
pause
exit /b %EXITCODE%
