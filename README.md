# Professor de Idiomas Local

Projeto para rodar uma IA local como professor de idiomas e, depois, criar uma interface propria para aulas, exercicios e conversacao.

## Estrutura

- `ollama-portable/`: Ollama portatil extraido localmente.
- `prompts/`: prompts de sistema para o professor de idiomas.
- `scripts/`: comandos auxiliares para iniciar e testar.

## Primeiro uso

No PowerShell, a partir desta pasta:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-ollama.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\pull-model.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\create-professor-model.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\chat-test.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\api-test.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-web.ps1
```

O modelo inicial sugerido e `qwen3:1.7b`, leve o bastante para teste e bom para validar a ideia. Depois podemos trocar por um modelo maior, como `qwen3:4b`, `qwen3:8b` ou Mistral, conforme o desempenho da maquina.

Observacao: os modelos ficam no local padrao do Ollama no Windows (`C:\Users\<usuario>\.ollama\models`). Isso evita problemas de permissao do ambiente sandbox enquanto desenvolvemos a interface dentro deste projeto.

Para a interface futura, use a API local:

```text
POST http://localhost:11434/api/chat
model: professor-idiomas
```

## Interface web

Com o Ollama iniciado, suba a interface:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-web.ps1
```

Depois acesse:

```text
http://localhost:3000
```
