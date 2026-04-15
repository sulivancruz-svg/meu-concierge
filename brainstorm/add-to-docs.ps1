# Script para adicionar conteúdo ao Google Docs do brainstorm (Windows PowerShell)
# Uso: .\add-to-docs.ps1 -Section "Seção" -Content "Conteúdo" -Author "Claude"

param(
    [Parameter(Mandatory=$true)]
    [string]$Section = "Ideias Gerais",

    [Parameter(Mandatory=$true)]
    [string]$Content,

    [string]$Author = "Claude"
)

# Carregar variáveis de .env.local
$envFile = ".\.env.local"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value)
        }
    }
}

# Validar variáveis
if ([string]::IsNullOrEmpty($env:GOOGLE_DOCS_WEBHOOK)) {
    Write-Host "❌ ERRO: GOOGLE_DOCS_WEBHOOK nao configurado em .env.local" -ForegroundColor Red
    exit 1
}

if ([string]::IsNullOrEmpty($env:GOOGLE_DOCS_TOKEN)) {
    Write-Host "❌ ERRO: GOOGLE_DOCS_TOKEN nao configurado em .env.local" -ForegroundColor Red
    exit 1
}

# Montar a requisição
Write-Host "📝 Adicionando à seção '$Section'..." -ForegroundColor Cyan

$body = @{
    section = $Section
    content = $Content
    token = $env:GOOGLE_DOCS_TOKEN
    author = $Author
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri $env:GOOGLE_DOCS_WEBHOOK `
        -Method POST `
        -Body $body `
        -ContentType "application/json" `
        -ErrorAction Stop

    $result = $response.Content | ConvertFrom-Json

    if ($result.success) {
        Write-Host "✅ Conteúdo adicionado com sucesso!" -ForegroundColor Green
    } else {
        Write-Host "❌ ERRO ao adicionar conteúdo:" -ForegroundColor Red
        Write-Host $result.message -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ ERRO na requisição:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
