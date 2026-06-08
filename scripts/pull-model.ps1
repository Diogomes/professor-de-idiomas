$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Ollama = Join-Path $Root "ollama-portable\ollama.exe"
$Model = if ($args.Count -gt 0) { $args[0] } else { "qwen3:1.7b" }

& $Ollama pull $Model
