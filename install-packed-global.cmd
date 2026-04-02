@echo off
setlocal

cd /d "%~dp0"

echo [omx] Packing current workspace and installing globally...
call npm run install:packed-global
set "EXITCODE=%ERRORLEVEL%"

echo.
if not "%EXITCODE%"=="0" (
  echo [omx] FAILED with exit code %EXITCODE%.
) else (
  echo [omx] Done.
)
echo.
pause
exit /b %EXITCODE%
