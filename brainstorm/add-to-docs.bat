@echo off
REM Script para adicionar contenúdo ao Google Docs (Windows Batch)
REM Uso: add-to-docs.bat "Seção" "Conteúdo" "Author"

setlocal enabledelayedexpansion

REM Carregar .env.local
if exist .env.local (
    for /f "delims== tokens=1,2" %%a in (.env.local) do (
        if not "%%a"=="" (
            set "%%a=%%b"
        )
    )
)

REM Validar variáveis
if "!GOOGLE_DOCS_WEBHOOK!"=="" (
    echo ❌ ERRO: GOOGLE_DOCS_WEBHOOK nao configurado em .env.local
    exit /b 1
)

if "!GOOGLE_DOCS_TOKEN!"=="" (
    echo ❌ ERRO: GOOGLE_DOCS_TOKEN nao configurado em .env.local
    exit /b 1
)

REM Parâmetros
set "SECTION=%~1"
set "CONTENT=%~2"
set "AUTHOR=%~3"

if "!SECTION!"=="" set "SECTION=Ideias Gerais"
if "!AUTHOR!"=="" set "AUTHOR=Claude"

if "!CONTENT!"=="" (
    echo ❌ ERRO: Conteúdo nao fornecido
    echo Uso: %0 "Seção" "Conteúdo" [Author]
    exit /b 1
)

echo 📝 Adicionando à seção '!SECTION!'...

REM Criar arquivo temporário com os dados
set "TEMP_FILE=%temp%\curl_data.txt"
(
    echo section=!SECTION!
    echo content=!CONTENT!
    echo token=!GOOGLE_DOCS_TOKEN!
    echo author=!AUTHOR!
) > "!TEMP_FILE!"

REM Enviar requisição
curl -X POST "!GOOGLE_DOCS_WEBHOOK!" ^
     --data-binary @"!TEMP_FILE!" ^
     -s > "%temp%\response.json"

REM Verificar resposta
findstr /M "success" "%temp%\response.json" >nul
if %errorlevel% equ 0 (
    echo ✅ Conteúdo adicionado com sucesso!
    del "!TEMP_FILE!" "%temp%\response.json"
    exit /b 0
) else (
    echo ❌ ERRO ao adicionar conteúdo:
    type "%temp%\response.json"
    del "!TEMP_FILE!" "%temp%\response.json"
    exit /b 1
)
