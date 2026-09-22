@echo off
setlocal
chcp 65001 >nul
set "COURSE_ROOT=%~dp0"
set "COURSE_PYTHON=%COURSE_ROOT%.venv\Scripts\python.exe"
if not exist "%COURSE_PYTHON%" (
  echo The project Python environment is missing. Follow the one-time setup in README.md.
  if /i not "%~1"=="--ensure-only" pause
  exit /b 1
)
"%COURSE_PYTHON%" "%COURSE_ROOT%tools\start_course.py" %*
if errorlevel 1 (
  if /i not "%~1"=="--ensure-only" pause
  exit /b 1
)
