@echo off
setlocal EnableExtensions

cd /d "%~dp0"

set "PAUSE_AT_END=1"
set "EXIT_CODE=0"

if /I "%~1"=="--no-pause" set "PAUSE_AT_END=0"

if not exist "%~dp0scripts\deploy-supabase-functions.sh" (
  echo [ERRO] Script nao encontrado: scripts\deploy-supabase-functions.sh
  set "EXIT_CODE=1"
  goto :end
)

where wsl >nul 2>&1
if errorlevel 1 (
  echo [ERRO] WSL nao encontrado.
  echo Instale o WSL e a distribuicao Ubuntu para continuar.
  set "EXIT_CODE=1"
  goto :end
)

set "WIN_REPO_PATH=%~dp0"
if "%WIN_REPO_PATH:~-1%"=="\" set "WIN_REPO_PATH=%WIN_REPO_PATH:~0,-1%"
set "WIN_REPO_PATH=%WIN_REPO_PATH:\=/%"

set "WSL_REPO_PATH="
for /f "usebackq delims=" %%I in (`wsl -e bash -lc "wslpath -a '%WIN_REPO_PATH%'"`) do set "WSL_REPO_PATH=%%I"

if "%WSL_REPO_PATH%"=="" (
  echo [ERRO] Nao foi possivel resolver o caminho do projeto no WSL.
  set "EXIT_CODE=1"
  goto :end
)

call wsl -e bash -lc "cd \"%WSL_REPO_PATH%\" && bash scripts/deploy-supabase-functions.sh"
if errorlevel 1 set "EXIT_CODE=1"

:end
if "%PAUSE_AT_END%"=="1" pause
exit /b %EXIT_CODE%
