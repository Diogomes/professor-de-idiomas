$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Server = Join-Path $Root "server.js"

if (-not (Test-Path $Server)) {
    throw "Servidor web nao encontrado em: $Server"
}

Push-Location $Root
try {
    node $Server
}
finally {
    Pop-Location
}
