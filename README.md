# Professor de Idiomas Local

App local de ensino de idiomas que roda uma IA local (Ollama) como professor
particular, com uma interface propria para uma trilha de aulas guiadas,
conversacao, exercicios, audio, video e imagens.

Idiomas: japones, ingles, espanhol e frances.

## Funcionalidades

- **Trilha de 50 aulas graduais por nivel** (basico, intermediario, avancado),
  totalizando 150 aulas, com progressao pedagogica do "ola" ate fluencia.
- **Barra de progresso** por idioma e nivel, com aulas marcaveis como concluidas
  (salvo no navegador).
- **Conteudo gerado por IA sob demanda**: ao abrir uma aula, o Ollama gera, no
  idioma escolhido, vocabulario com pronuncia, explicacao, dicas e exercicios em
  JSON estruturado. O resultado fica em cache no navegador.
- **Audio (Web Speech)** para mostrar a sonoridade: ouvir a palavra, ouvir a
  frase de exemplo e ouvir **letra a letra**. Voz feminina/masculina e
  velocidade ajustavel (inclui "ouvir devagar").
- **Imagens tematicas** para cada aula (via LoremFlickr, com fallback visual).
- **Video-aula** por tema: assistir embutido (busca do YouTube) ou abrir no
  YouTube.
- **Exercicios interativos**: multipla escolha (com correcao na hora),
  completar lacuna e traducao (com resposta e audio). Em japones, os exercicios
  de escrita pedem e aceitam a resposta nas duas estruturas (kana e romaji).
- **Japones com as tres escritas**: cada aula explica quando se usa hiragana,
  katakana e kanji, e cada palavra mostra a escrita (kanji/kana), a leitura em
  kana e o romaji.
- **Chat / conversacao guiada** com o professor, com **sugestoes de assunto**
  clicaveis por nivel e um botao para a IA propor novos assuntos. Inclui a
  "aula rapida por IA" original e correcao de texto.
- **Traducao automatica** (PT -> idioma) via API gratuita e sem chave
  (MyMemory), direto do campo de mensagem.

## Pre-requisitos

- Node.js 18+ (testado com Node 22).
- Ollama (servidor de IA local). No Windows ha os scripts PowerShell em
  `scripts/`. No Linux veja abaixo.

## Inicio rapido (Linux)

```bash
# 1. Instalar o Ollama em modo usuario (sem root), se ainda nao tiver:
curl -L https://github.com/ollama/ollama/releases/latest/download/ollama-linux-amd64.tar.zst -o /tmp/ollama.tar.zst
mkdir -p ~/.local/ollama && tar --zstd -xf /tmp/ollama.tar.zst -C ~/.local/ollama

# 2. Subir Ollama + modelo + interface de uma vez:
bash scripts/start-linux.sh
```

Depois acesse: `http://localhost:3100`

O script garante o modelo base `qwen3:1.7b` e cria o modelo `professor-idiomas`
a partir de `Modelfile.professor`.

## Inicio rapido (Windows / PowerShell)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-ollama.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\pull-model.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\create-professor-model.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-web.ps1
```

## Variaveis de ambiente

- `PORT` — porta da interface (padrao `3000`; o `start-linux.sh` usa `3100`).
- `OLLAMA_URL` — endereco do Ollama (padrao `http://127.0.0.1:11434`).
- `MODEL` — modelo usado (padrao `professor-idiomas`).

## API local

- `GET  /api/health` — status do servidor e do Ollama (modelos disponiveis).
- `POST /api/chat` — proxy de chat para o Ollama.
- `POST /api/lesson` — gera o conteudo estruturado (JSON) de uma aula.
  Corpo: `{ "language", "level", "title", "goal" }`.
- `POST /api/translate` — traducao via MyMemory (gratuita, sem chave).
  Corpo: `{ "text", "from", "to" }` (codigos ISO: pt, en, es, fr, ja).
  Observacao: a memoria comunitaria do MyMemory pode, ocasionalmente, retornar
  traducoes imprecisas; use como apoio rapido.

## Desempenho

O modelo padrao `qwen3:1.7b` e leve, mas em CPU a geracao de uma aula pode levar
algumas dezenas de segundos. Para respostas mais rapidas/melhores, troque o
modelo (ex.: `qwen3:4b`, `qwen3:8b`) editando `Modelfile.professor` e recriando
o modelo, ou rode em GPU. O conteudo gerado fica em cache, entao cada aula so e
gerada uma vez por idioma.

## Estrutura

- `server.js` — servidor HTTP: arquivos estaticos + proxy/geracao via Ollama.
- `public/` — interface (HTML, CSS, JS) e o curriculo (`curriculum.js`).
- `prompts/` — prompt de sistema do professor.
- `Modelfile.professor` — definicao do modelo Ollama.
- `scripts/` — comandos auxiliares (PowerShell e `start-linux.sh`).
