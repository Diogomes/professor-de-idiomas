$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Ollama = Join-Path $Root "ollama-portable\ollama.exe"
$Modelfile = Join-Path $Root "Modelfile.professor"

& $Ollama create professor-idiomas -f $Modelfile

