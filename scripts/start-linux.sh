#!/usr/bin/env bash
# Inicia o Ollama (modo usuario) e a interface web em uma so etapa no Linux.
# Uso: bash scripts/start-linux.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OLLAMA_BIN="${OLLAMA_BIN:-$HOME/.local/ollama/bin/ollama}"
export OLLAMA_HOST="${OLLAMA_HOST:-127.0.0.1:11434}"
export OLLAMA_MODELS="${OLLAMA_MODELS:-$ROOT/.ollama-home/models}"
PORT="${PORT:-3100}"
MODEL="${MODEL:-professor-idiomas}"

mkdir -p "$OLLAMA_MODELS"

if [ ! -x "$OLLAMA_BIN" ]; then
  echo "Ollama nao encontrado em $OLLAMA_BIN."
  echo "Baixe o binario standalone (sem root):"
  echo "  curl -L https://github.com/ollama/ollama/releases/latest/download/ollama-linux-amd64.tar.zst -o /tmp/ollama.tar.zst"
  echo "  mkdir -p ~/.local/ollama && tar --zstd -xf /tmp/ollama.tar.zst -C ~/.local/ollama"
  exit 1
fi

# Sobe o Ollama se ainda nao estiver respondendo.
if ! curl -s -m 2 "http://$OLLAMA_HOST/api/version" >/dev/null 2>&1; then
  echo "Iniciando Ollama..."
  "$OLLAMA_BIN" serve >"$ROOT/ollama-serve.log" 2>&1 &
  for _ in $(seq 1 20); do
    sleep 0.5
    curl -s -m 2 "http://$OLLAMA_HOST/api/version" >/dev/null 2>&1 && break
  done
fi

# Garante o modelo base e o modelo do professor.
if ! "$OLLAMA_BIN" list | grep -q "qwen3:1.7b"; then
  echo "Baixando modelo base qwen3:1.7b..."
  "$OLLAMA_BIN" pull qwen3:1.7b
fi
if ! "$OLLAMA_BIN" list | grep -q "$MODEL"; then
  echo "Criando modelo $MODEL..."
  "$OLLAMA_BIN" create "$MODEL" -f "$ROOT/Modelfile.professor"
fi

echo "Interface em http://localhost:$PORT"
PORT="$PORT" MODEL="$MODEL" node "$ROOT/server.js"
