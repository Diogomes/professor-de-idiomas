$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Ollama = Join-Path $Root "ollama-portable\ollama.exe"

if (-not (Test-Path $Ollama)) {
    throw "Ollama nao encontrado em: $Ollama"
}

$running = Get-Process -Name "ollama" -ErrorAction SilentlyContinue

if ($running) {
    Write-Host "Ollama ja esta rodando."
    exit 0
}

Start-Process -FilePath $Ollama -ArgumentList "serve" -WindowStyle Hidden
Start-Sleep -Seconds 3

Write-Host "Ollama iniciado em http://localhost:11434"
