@echo off
setlocal

set ZIP=santo_edit_actual_para_chatgpt.zip
set TEMP=_chatgpt_zip_temp

echo Preparando ZIP actualizado para ChatGPT...

if exist "%ZIP%" del "%ZIP%"
if exist "%TEMP%" rmdir /s /q "%TEMP%"

mkdir "%TEMP%"

if exist "src" xcopy "src" "%TEMP%\src" /E /I /Y >nul
if exist "scripts" xcopy "scripts" "%TEMP%\scripts" /E /I /Y >nul
if exist "supabase" xcopy "supabase" "%TEMP%\supabase" /E /I /Y >nul
if exist "public" xcopy "public" "%TEMP%\public" /E /I /Y >nul

if exist "package.json" copy "package.json" "%TEMP%\package.json" >nul
if exist "package-lock.json" copy "package-lock.json" "%TEMP%\package-lock.json" >nul
if exist "tsconfig.json" copy "tsconfig.json" "%TEMP%\tsconfig.json" >nul
if exist "next.config.ts" copy "next.config.ts" "%TEMP%\next.config.ts" >nul
if exist "next.config.mjs" copy "next.config.mjs" "%TEMP%\next.config.mjs" >nul
if exist "eslint.config.mjs" copy "eslint.config.mjs" "%TEMP%\eslint.config.mjs" >nul
if exist "postcss.config.mjs" copy "postcss.config.mjs" "%TEMP%\postcss.config.mjs" >nul
if exist "vitest.config.ts" copy "vitest.config.ts" "%TEMP%\vitest.config.ts" >nul
if exist "next-env.d.ts" copy "next-env.d.ts" "%TEMP%\next-env.d.ts" >nul
if exist ".gitignore" copy ".gitignore" "%TEMP%\.gitignore" >nul
if exist ".env.example" copy ".env.example" "%TEMP%\.env.example" >nul
if exist "README.md" copy "README.md" "%TEMP%\README.md" >nul
if exist "CHECKLIST-CLIENTE-NUEVO.md" copy "CHECKLIST-CLIENTE-NUEVO.md" "%TEMP%\CHECKLIST-CLIENTE-NUEVO.md" >nul
if exist "brand-colors.json" copy "brand-colors.json" "%TEMP%\brand-colors.json" >nul
if exist "crear_zip_para_chatgpt.bat" copy "crear_zip_para_chatgpt.bat" "%TEMP%\crear_zip_para_chatgpt.bat" >nul

tar -a -c -f "%ZIP%" -C "%TEMP%" .

rmdir /s /q "%TEMP%"

echo.
echo ZIP listo:
echo %ZIP%
echo.
pause
