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
call "%~dp0deploy-functions.bat" --no-pause
if errorlevel 1 goto :end

echo === Done ===
:end
endlocal
