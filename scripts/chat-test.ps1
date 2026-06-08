$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Ollama = Join-Path $Root "ollama-portable\ollama.exe"
$Model = if ($args.Count -gt 0) { $args[0] } else { "professor-idiomas" }

$Prompt = @"
Monte uma microaula de 5 minutos sobre cumprimentos basicos em japones para iniciante.
"@

& $Ollama run $Model $Prompt
