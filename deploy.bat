@echo off
setlocal ENABLEDELAYEDEXPANSION

cd /d "%~dp0"

set PROJECT_REF=eaxvvhamkmovkoqssahj
rem Optional: set DB_PASSWORD env var before running
rem Example (PowerShell): $env:DB_PASSWORD="your_db_password"
rem Example (CMD): set DB_PASSWORD=your_db_password

echo === Link project: %PROJECT_REF% ===
if "%DB_PASSWORD%"=="" (
  supabase link --project-ref %PROJECT_REF%
) else (
  supabase link --project-ref %PROJECT_REF% --password %DB_PASSWORD%
)

echo === Apply migrations ===
if "%DB_PASSWORD%"=="" (
  supabase db pull
  supabase db push
) else (
  supabase db pull --password %DB_PASSWORD%
  supabase db push --password %DB_PASSWORD%
)

echo === Deploy Edge Functions ===
set "NO_VERIFY_JWT_FUNCTIONS=whatsapp-webhook comm-whatsapp-webhook create-initial-admin whatsapp-broadcast"

for /d %%D in ("supabase\functions\*") do (
  if exist "%%~fD\index.ts" (
    set "FUNCTION_NAME=%%~nxD"
    set "DEPLOY_ARGS="

    for %%F in (!NO_VERIFY_JWT_FUNCTIONS!) do (
      if /I "%%~F"=="!FUNCTION_NAME!" set "DEPLOY_ARGS=--no-verify-jwt"
    )

    if defined DEPLOY_ARGS (
      echo === Deploy function: !FUNCTION_NAME! ^(!DEPLOY_ARGS!^) ===
      supabase functions deploy "!FUNCTION_NAME!" !DEPLOY_ARGS!
    ) else (
      echo === Deploy function: !FUNCTION_NAME! ===
      supabase functions deploy "!FUNCTION_NAME!"
    )

    if errorlevel 1 goto :end
  )
)

echo === Done ===
:end
endlocal
