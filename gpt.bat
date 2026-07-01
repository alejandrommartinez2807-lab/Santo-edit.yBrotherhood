@echo off
setlocal EnableExtensions

REM ============================================================
REM Santo edit / Santo Perrito
REM Creador de ZIP completo para ChatGPT
REM ============================================================
REM Este BAT debe ejecutarse desde la raiz del proyecto:
REM D:\Santo edit
REM
REM Incluye todo el proyecto activo, pero excluye:
REM - node_modules, .next, caches y builds generados
REM - .git y metadatos locales
REM - .env.local / secretos / llaves
REM - zips viejos, logs y backups
REM ============================================================

set "ZIP_NAME=santo_edit_actual_para_chatgpt.zip"
set "ROOT=%CD%"
set "STAGE=%TEMP%\santo_edit_chatgpt_zip_%RANDOM%%RANDOM%"
set "ROBO_LOG=%TEMP%\santo_edit_chatgpt_robocopy.log"
set "ZIP_PATH=%ROOT%\%ZIP_NAME%"

echo.
echo ============================================================
echo  Santo edit / Santo Perrito - ZIP para ChatGPT
echo ============================================================
echo Proyecto: "%ROOT%"
echo ZIP:      "%ZIP_PATH%"
echo.

REM -------------------------------
REM Validaciones basicas
REM -------------------------------
if not exist "%ROOT%\package.json" (
  echo ERROR: No encuentro package.json.
  echo Ejecuta este archivo desde la raiz real del proyecto, por ejemplo:
  echo D:\Santo edit
  echo.
  goto :FAIL
)

if not exist "%ROOT%\src" (
  echo ADVERTENCIA: No encuentro la carpeta src.
  echo El ZIP se creara igual, pero revisa que estes en la carpeta correcta.
  echo.
)

where robocopy >nul 2>nul
if errorlevel 1 (
  echo ERROR: No encuentro robocopy en este Windows.
  echo Abre CMD normal y ejecuta de nuevo.
  echo.
  goto :FAIL
)

where tar >nul 2>nul
if errorlevel 1 (
  echo ERROR: No encuentro tar en este Windows.
  echo En Windows 10/11 normalmente viene instalado.
  echo Sin tar no puedo crear el ZIP sin usar PowerShell.
  echo.
  goto :FAIL
)

REM -------------------------------
REM Limpiar ZIP/stage anterior
REM -------------------------------
if exist "%ZIP_PATH%" (
  echo Eliminando ZIP anterior...
  del /f /q "%ZIP_PATH%" >nul 2>nul
)

if exist "%STAGE%" (
  rmdir /s /q "%STAGE%" >nul 2>nul
)

mkdir "%STAGE%" >nul 2>nul
if errorlevel 1 (
  echo ERROR: No pude crear carpeta temporal:
  echo "%STAGE%"
  echo.
  goto :FAIL
)

REM -------------------------------
REM Copiar proyecto completo activo
REM -------------------------------
echo Copiando archivos del proyecto...
echo Esto puede tardar un poco si public tiene muchas imagenes.
echo.

robocopy "%ROOT%" "%STAGE%" /E /R:1 /W:1 /NP ^
  /XD ".git" ".next" "node_modules" "backups" ".vercel" ".turbo" ".cache" "coverage" "dist" "build" "out" "playwright-report" "test-results" "_chatgpt_zip_temp" ^
  /XF "%ZIP_NAME%" "*.zip" "*.rar" "*.7z" "*.tar" "*.gz" "*.log" "npm-debug.log*" "yarn-debug.log*" "yarn-error.log*" "pnpm-debug.log*" "tsconfig.tsbuildinfo" ^
      ".env" ".env.local" ".env*.local" ".env.local*" ".env.production" ".env.development" ".env.test" ^
      "*.pem" "*.key" "*.p12" "*.pfx" "*service-account*.json" "*firebase-admin*.json" ^
  > "%ROBO_LOG%"

set "ROBO_CODE=%ERRORLEVEL%"

REM Robocopy devuelve 0-7 como OK / advertencia normal. 8+ es error real.
if %ROBO_CODE% GEQ 8 (
  echo ERROR: Robocopy fallo copiando el proyecto.
  echo Codigo: %ROBO_CODE%
  echo.
  echo Ultimas lineas del log:
  type "%ROBO_LOG%"
  echo.
  goto :FAIL_CLEAN
)

REM -------------------------------
REM Crear archivos de ayuda dentro del ZIP
REM -------------------------------
(
  echo Santo edit / Santo Perrito - ZIP para ChatGPT
  echo Creado: %DATE% %TIME%
  echo Carpeta original: %ROOT%
  echo.
  echo Este ZIP incluye el proyecto activo casi completo para revision/correccion.
  echo.
  echo Incluido:
  echo - src
  echo - public
  echo - supabase
  echo - scripts
  echo - configs raiz: package.json, package-lock.json, tsconfig, next, eslint, vitest, postcss, etc.
  echo - archivos markdown y json del proyecto
  echo - carpetas ocultas utiles como .github, si existen
  echo.
  echo Excluido a proposito:
  echo - node_modules
  echo - .next / builds / dist / out
  echo - .git
  echo - backups
  echo - zips viejos
  echo - logs
  echo - .env.local, .env y secretos reales
  echo - llaves .pem/.key/.p12/.pfx y service accounts
  echo.
  echo IMPORTANTE:
  echo No subas .env.local con claves reales. Para ChatGPT normalmente basta con .env.example.
  echo Si un error depende de variables de entorno, pega solo los nombres de variables o valores falsos.
  echo.
  echo Despues de aplicar cambios, correr:
  echo npm run build
  echo npm run test
) > "%STAGE%\_LEEME_CHATGPT_ZIP.txt"

(
  echo Diagnostico local al crear el ZIP
  echo Fecha: %DATE% %TIME%
  echo Proyecto: %ROOT%
  echo.
  echo Node:
  node -v 2^>^&1
  echo.
  echo NPM:
  npm -v 2^>^&1
  echo.
  echo Scripts disponibles en package.json:
  npm run 2^>^&1
) > "%STAGE%\_chatgpt_zip_diagnostics.txt"

tree "%STAGE%" /F /A > "%STAGE%\_chatgpt_zip_tree.txt" 2>nul

REM -------------------------------
REM Crear ZIP
REM -------------------------------
echo.
echo Creando ZIP...
tar -a -c -f "%ZIP_PATH%" -C "%STAGE%" .
if errorlevel 1 (
  echo ERROR: Fallo tar al crear el ZIP.
  echo.
  goto :FAIL_CLEAN
)

if not exist "%ZIP_PATH%" (
  echo ERROR: El ZIP no se creo.
  echo.
  goto :FAIL_CLEAN
)

for %%A in ("%ZIP_PATH%") do set "ZIP_SIZE=%%~zA"

echo.
echo ============================================================
echo  ZIP listo
echo ============================================================
echo Archivo:
echo "%ZIP_PATH%"
echo.
echo Tamano:
echo %ZIP_SIZE% bytes
echo.
echo Recomendacion:
echo 1. Sube este ZIP a ChatGPT.
echo 2. Si hay error de build/test, pega tambien la salida completa.
echo 3. No subas .env.local con secretos reales.
echo ============================================================
echo.

rmdir /s /q "%STAGE%" >nul 2>nul
pause
exit /b 0

:FAIL_CLEAN
if exist "%STAGE%" rmdir /s /q "%STAGE%" >nul 2>nul

:FAIL
echo.
echo No se pudo crear el ZIP.
echo.
pause
exit /b 1