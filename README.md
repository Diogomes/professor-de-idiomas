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

## App desktop (Windows) - funciona offline

O app pode rodar como um **aplicativo desktop** (Electron), com janela propria,
sem precisar subir o `localhost` manualmente. Ele sobe o servidor local e a IA
(Ollama) por baixo automaticamente.

- **Primeira execucao (precisa de internet uma vez):** o app baixa o Ollama e o
  modelo (~1.4 GB) para a pasta de dados do usuario.
- **Depois disso, funciona 100% offline** para a parte de estudo: trilha de
  aulas, geracao de aulas por IA, chat/conversacao, exercicios e audio (TTS).
- **Com internet**, tambem funcionam: imagens tematicas, video-aulas do YouTube
  e a traducao automatica. **Offline**, essas tres degradam graciosamente (a
  aula avisa que o recurso precisa de internet) sem quebrar o restante.

### Rodar em modo desenvolvimento

```bash
npm install
npm start          # abre a janela do app (Electron)
```

### Gerar o executavel do Windows

O `.exe` precisa ser gerado **em uma maquina Windows** (ou CI Windows):

```bash
npm install
npm run dist:win   # gera dist/ProfessorDeIdiomas-<versao>-x64.exe (instalador NSIS) e a versao portable
```

O instalador NSIS permite escolher a pasta de instalacao. O modelo da IA NAO vai
dentro do instalador (por isso ele e pequeno): e baixado na primeira execucao.

> Observacao: tambem da para rodar so o servidor web (sem janela), como antes,
> com `npm run server` e acessar `http://localhost:3000`.

## Versao web (GitHub Pages) - IA no proprio navegador

A interface tambem roda como **site estatico no GitHub Pages**, sem servidor e
sem Ollama: nesse modo a IA roda **dentro do navegador** via
[WebLLM](https://github.com/mlc-ai/web-llm) (WebGPU). O mesmo codigo serve aos
dois cenarios — uma camada de deteccao (`AI` em `public/app.js`) escolhe o
backend automaticamente:

- **Com servidor local (app desktop / `npm run server`):** usa o Ollama via
  `/api/*` (rapido, ja existente).
- **Sem servidor (GitHub Pages):** carrega um modelo Qwen no navegador (WebLLM)
  e gera aulas e conversa localmente. Os prompts, o parsing e a romanizacao
  ficam em `public/llm-core.js`, compartilhados pelos dois caminhos, para nunca
  divergirem.

O que funciona no Pages: trilha, aulas por IA, conversa (correcao + dialogo
natural), audio (TTS), microfone (STT) e traducao (MyMemory direto do
navegador).

### Requisitos do modo navegador

- Navegador com **WebGPU**: Chrome/Edge 113+ (ou Safari 18+). Sem WebGPU a UI
  avisa e sugere o app desktop.
- **Primeira aula baixa o modelo (~1 GB)**; depois fica em cache no navegador e
  funciona offline.

### Publicar no GitHub Pages

1. O workflow `.github/workflows/deploy-pages.yml` publica a pasta `public/` a
   cada push na `main` (ou manualmente em Actions > Run workflow).
2. Em **Settings > Pages**, defina **Source: GitHub Actions**.
3. A URL final aparece no job (ex.: `https://<usuario>.github.io/<repo>/`). Para
   ficar `https://<usuario>.github.io/idiomas`, renomeie o repositorio para
   `idiomas` em **Settings > General**.

> Todos os caminhos internos sao relativos, entao o site funciona em qualquer
> subpasta (`/professor-de-idiomas/`, `/idiomas/`, etc.).

## Pre-requisitos (modo servidor)

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
- `public/llm-core.js` — logica de IA (prompts, parsing, romaji) compartilhada
  entre o servidor (Ollama) e o navegador (WebLLM).
- `public/webllm-client.js` — roda o modelo no navegador (WebGPU) para a versao
  GitHub Pages.
- `prompts/` — prompt de sistema do professor.
- `Modelfile.professor` — definicao do modelo Ollama.
- `scripts/` — comandos auxiliares (PowerShell e `start-linux.sh`).
