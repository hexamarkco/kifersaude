@echo off
setlocal ENABLEDELAYEDEXPANSION

cd /d "%~dp0"

set "STATE_DIR=%~dp0.deploy-cache"
set "STATE_FILE=%STATE_DIR%\supabase-functions-state.txt"
set "NEXT_STATE_FILE=%STATE_DIR%\supabase-functions-state.next.txt"
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
  set "EXIT_CODE=1"
  goto :end
)

echo Usando CLI: %SUPABASE_LABEL%

set "CONFIG_FILE=%~dp0supabase.local.ini"
if not exist "%CONFIG_FILE%" (
  echo [ERRO] Arquivo nao encontrado: %CONFIG_FILE%
  echo Copie o exemplo e preencha os valores:
  echo copy supabase.local.ini.example supabase.local.ini
  set "EXIT_CODE=1"
  goto :end
)

set "PROJECT_REF="
set "DB_PASSWORD="
set "SUPABASE_ACCESS_TOKEN="
for /f "usebackq eol=; tokens=1,* delims==" %%A in ("%CONFIG_FILE%") do (
  set "INI_KEY=%%A"
  set "INI_VALUE=%%B"
  if "!INI_KEY!"=="PROJECT_REF" set "PROJECT_REF=!INI_VALUE!"
  if "!INI_KEY!"=="DB_PASSWORD" set "DB_PASSWORD=!INI_VALUE!"
  if "!INI_KEY!"=="SUPABASE_ACCESS_TOKEN" set "SUPABASE_ACCESS_TOKEN=!INI_VALUE!"
)

if not defined PROJECT_REF (
  echo [ERRO] PROJECT_REF nao definido em supabase.local.ini
  set "EXIT_CODE=1"
  goto :end
)

if not defined SUPABASE_ACCESS_TOKEN (
  echo [ERRO] SUPABASE_ACCESS_TOKEN nao definido em supabase.local.ini
  set "EXIT_CODE=1"
  goto :end
)

echo === Link do projeto: %PROJECT_REF% ===
if defined DB_PASSWORD (
  if "!SUPABASE_USE_NPX!"=="1" (
    call "!NPX_BIN!" --yes supabase link --project-ref "%PROJECT_REF%" --password "%DB_PASSWORD%"
  ) else (
    call "!SUPABASE_BIN!" link --project-ref "%PROJECT_REF%" --password "%DB_PASSWORD%"
  )
) else (
  if "!SUPABASE_USE_NPX!"=="1" (
    call "!NPX_BIN!" --yes supabase link --project-ref "%PROJECT_REF%"
  ) else (
    call "!SUPABASE_BIN!" link --project-ref "%PROJECT_REF%"
  )
)
if errorlevel 1 (
  echo [ERRO] Falha ao linkar o projeto Supabase.
  set "EXIT_CODE=1"
  goto :end
)

if not exist "supabase\functions" (
  echo [ERRO] Pasta supabase\functions nao encontrada.
  set "EXIT_CODE=1"
  goto :end
)

if not exist "%STATE_DIR%" mkdir "%STATE_DIR%"
if exist "%NEXT_STATE_FILE%" del /f /q "%NEXT_STATE_FILE%" >nul 2>nul
if exist "%STATE_FILE%" (
  for /f "usebackq tokens=1,* delims==" %%A in ("%STATE_FILE%") do (
    set "STATE_%%~A=%%~B"
  )
)

set /a TOTAL=0
set /a SKIPPED=0
set /a SUCCESS=0
set /a FAIL=0
set "EXIT_CODE=0"
rem A lista de functions que dispensam verificacao de JWT da plataforma vem
rem de supabase\config.toml (blocos [functions.<nome>] com verify_jwt =
rem false) - a mesma fonte que scripts/deploy-supabase-functions.sh usa.
rem Nao adicione nomes aqui: edite supabase\config.toml.
set "NO_VERIFY_JWT_FUNCTIONS="
if exist "supabase\config.toml" (
  for /f "usebackq delims=" %%N in (`powershell -NoProfile -Command "$lines = Get-Content -LiteralPath 'supabase\config.toml'; $current = $null; $names = foreach ($line in $lines) { if ($line -match '^\[functions\.(?<name>[^\]]+)\]$') { $current = $Matches['name'] } elseif ($current -and $line -match '^verify_jwt\s*=\s*false\s*$') { $current; $current = $null } elseif ($line -match '^\[') { $current = $null } }; ($names -join ' ')"`) do (
    set "NO_VERIFY_JWT_FUNCTIONS=%%N"
  )
) else (
  echo [AVISO] supabase\config.toml nao encontrado; nenhuma function sera deployada com --no-verify-jwt.
)

set "SHARED_HASH="
if exist "supabase\functions\_shared" (
  call :compute_hash "supabase\functions\_shared" SHARED_HASH
  if errorlevel 1 (
    echo [ERRO] Falha ao calcular hash de supabase\functions\_shared.
    set "EXIT_CODE=1"
    goto :end
  )
)

for /d %%D in ("supabase\functions\*") do (
  if exist "%%~fD\index.ts" (
    set /a TOTAL+=1
    set "FUNCTION_NAME=%%~nxD"
    set "DEPLOY_ARGS="
    set "CURRENT_HASH="
    set "PREVIOUS_HASH="
    set "SHOULD_DEPLOY=1"

    call :compute_hash "%%~fD" CURRENT_HASH
    if errorlevel 1 (
      set /a FAIL+=1
      set "SHOULD_DEPLOY="
      echo [ERRO] Falha ao calcular hash de "!FUNCTION_NAME!".
    )

    if defined SHOULD_DEPLOY if defined SHARED_HASH set "CURRENT_HASH=!CURRENT_HASH!|!SHARED_HASH!"

    call set "PREVIOUS_HASH=%%STATE_!FUNCTION_NAME!%%"

    if defined SHOULD_DEPLOY if defined PREVIOUS_HASH if /I "!PREVIOUS_HASH!"=="!CURRENT_HASH!" (
      set "SHOULD_DEPLOY="
      set /a SKIPPED+=1
      echo.
      echo Pulando "!FUNCTION_NAME!" ^(sem alteracoes desde o ultimo deploy^).
      >>"%NEXT_STATE_FILE%" echo !FUNCTION_NAME!=!CURRENT_HASH!
    )

    if defined SHOULD_DEPLOY (
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
        >>"%NEXT_STATE_FILE%" echo !FUNCTION_NAME!=!CURRENT_HASH!
        echo [OK] Deploy concluido para "!FUNCTION_NAME!".
      )
    )
  )
)

if exist "%NEXT_STATE_FILE%" move /y "%NEXT_STATE_FILE%" "%STATE_FILE%" >nul

echo.
if !TOTAL! EQU 0 (
  echo Nenhuma function com index.ts encontrada em supabase\functions.
) else (
  echo Resumo: !SUCCESS! deploy(s), !SKIPPED! sem alteracao, !FAIL! falha(s), !TOTAL! total.
)

set "EXIT_CODE=0"
if !FAIL! GTR 0 set "EXIT_CODE=1"

:end
echo.
echo Finalizado.

if /I "%~1"=="--no-pause" goto :finish
echo.
pause

:finish
endlocal & exit /b %EXIT_CODE%

:compute_hash
setlocal
set "TARGET_DIR=%~1"
set "HASH_VALUE="

for /f "usebackq delims=" %%H in (`powershell -NoProfile -Command "$dir = Get-Item -LiteralPath '%~1'; $files = Get-ChildItem -LiteralPath $dir.FullName -File -Recurse | Sort-Object FullName; $payload = if ($files) { [string]::Join([char]10, ($files | ForEach-Object { $relative = $_.FullName.Substring($dir.FullName.Length).TrimStart('\\'); $fileHash = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant(); '{0}|{1}' -f $relative.Replace('\\','/'), $fileHash })) } else { '' }; $bytes = [Text.Encoding]::UTF8.GetBytes($payload); $stream = New-Object IO.MemoryStream(,$bytes); try { (Get-FileHash -InputStream $stream -Algorithm SHA256).Hash.ToLowerInvariant() } finally { $stream.Dispose() }"`) do (
  set "HASH_VALUE=%%H"
)

if not defined HASH_VALUE (
  endlocal & exit /b 1
)

endlocal & set "%~2=%HASH_VALUE%" & exit /b 0
