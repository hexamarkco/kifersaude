@echo off
setlocal ENABLEDELAYEDEXPANSION

cd /d "%~dp0"

set "SUPABASE_BIN="
set "SUPABASE_LABEL="
set "SUPABASE_USE_NPX=0"
set "NPX_BIN="

if exist "%~dp0node_modules\.bin\supabase.cmd" (
  set "SUPABASE_BIN=%~dp0node_modules\.bin\supabase.cmd"
  set "SUPABASE_LABEL=node_modules\\.bin\\supabase.cmd"
)

if not defined SUPABASE_BIN (
  for /f "delims=" %%I in ('where supabase 2^>nul') do (
    if not defined SUPABASE_BIN if exist "%%~fI" (
      set "SUPABASE_BIN=%%~fI"
      set "SUPABASE_LABEL=%%~fI"
    )
  )
)

if not defined SUPABASE_BIN (
  for /f "delims=" %%I in ('where npx 2^>nul') do (
    if not defined NPX_BIN if exist "%%~fI" (
      set "SUPABASE_USE_NPX=1"
      set "NPX_BIN=%%~fI"
      set "SUPABASE_LABEL=%%~fI supabase"
    )
  )
)

if not defined SUPABASE_BIN if "%SUPABASE_USE_NPX%"=="0" (
  if exist "%ProgramFiles%\nodejs\npx.cmd" (
    set "SUPABASE_USE_NPX=1"
    set "NPX_BIN=%ProgramFiles%\nodejs\npx.cmd"
    set "SUPABASE_LABEL=%ProgramFiles%\nodejs\npx.cmd supabase"
  )
)

if not defined SUPABASE_BIN if "%SUPABASE_USE_NPX%"=="0" (
  if exist "%ProgramFiles(x86)%\nodejs\npx.cmd" (
    set "SUPABASE_USE_NPX=1"
    set "NPX_BIN=%ProgramFiles(x86)%\nodejs\npx.cmd"
    set "SUPABASE_LABEL=%ProgramFiles(x86)%\nodejs\npx.cmd supabase"
  )
)

if not defined SUPABASE_BIN if "%SUPABASE_USE_NPX%"=="0" (
  if exist "%LocalAppData%\Programs\nodejs\npx.cmd" (
    set "SUPABASE_USE_NPX=1"
    set "NPX_BIN=%LocalAppData%\Programs\nodejs\npx.cmd"
    set "SUPABASE_LABEL=%LocalAppData%\Programs\nodejs\npx.cmd supabase"
  )
)

if not defined SUPABASE_BIN if "%SUPABASE_USE_NPX%"=="0" (
  if exist "%AppData%\npm\npx.cmd" (
    set "SUPABASE_USE_NPX=1"
    set "NPX_BIN=%AppData%\npm\npx.cmd"
    set "SUPABASE_LABEL=%AppData%\npm\npx.cmd supabase"
  )
)

if not defined SUPABASE_BIN if "%SUPABASE_USE_NPX%"=="0" (
  echo [ERRO] Nao encontrei Supabase CLI.
  echo O pacote nao suporta instalacao global via npm.
  echo Abra o terminal e valide: npx supabase --version
  echo Se funcionar no terminal, rode este .bat pelo terminal para herdar o PATH.
  goto :end
)

echo Usando CLI: %SUPABASE_LABEL%

if not exist "supabase\functions" (
  echo [ERRO] Pasta supabase\functions nao encontrada.
  goto :end
)

set /a TOTAL=0
set /a SUCCESS=0
set /a FAIL=0
set "NO_VERIFY_JWT_FUNCTIONS=whatsapp-webhook comm-whatsapp-webhook create-initial-admin whatsapp-broadcast"

for /d %%D in ("supabase\functions\*") do (
  if exist "%%~fD\index.ts" (
    set /a TOTAL+=1
    set "FUNCTION_NAME=%%~nxD"
    set "DEPLOY_ARGS="

    for %%F in (!NO_VERIFY_JWT_FUNCTIONS!) do (
      if /I "%%~F"=="!FUNCTION_NAME!" set "DEPLOY_ARGS=--no-verify-jwt"
    )

    echo.
    echo Deploy da function "!FUNCTION_NAME!"...
    if defined DEPLOY_ARGS (
      echo Verificacao de JWT: desativada ^(!DEPLOY_ARGS!^)
    ) else (
      echo Verificacao de JWT: padrao da plataforma
    )

    if "!SUPABASE_USE_NPX!"=="1" (
      call "!NPX_BIN!" --yes supabase functions deploy "!FUNCTION_NAME!" !DEPLOY_ARGS!
    ) else (
      call "!SUPABASE_BIN!" functions deploy "!FUNCTION_NAME!" !DEPLOY_ARGS!
    )

    if errorlevel 1 (
      set /a FAIL+=1
      echo [ERRO] Falha no deploy de "!FUNCTION_NAME!".
    ) else (
      set /a SUCCESS+=1
      echo [OK] Deploy concluido para "!FUNCTION_NAME!".
    )
  )
)

echo.
if !TOTAL! EQU 0 (
  echo Nenhuma function com index.ts encontrada em supabase\functions.
) else (
  echo Resumo: !SUCCESS! sucesso(s), !FAIL! falha(s), !TOTAL! total.
)

:end
echo.
echo Finalizado.

if /I "%~1"=="--no-pause" goto :finish
echo.
pause

:finish
endlocal
