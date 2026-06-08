const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const publicDir = path.join(root, "public");
const port = Number(process.env.PORT || 3000);
const ollamaUrl = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const defaultModel = process.env.MODEL || "professor-idiomas";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const languageNames = {
  japones: "japones",
  ingles: "ingles",
  espanhol: "espanhol",
  frances: "frances",
};

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function callOllamaChat({ model, messages, format }) {
  const payload = {
    model: model || defaultModel,
    stream: false,
    messages: messages || [],
    options: { temperature: 0.4 },
  };
  if (format) payload.format = format;

  const response = await fetch(`${ollamaUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  return { status: response.status, text };
}

async function proxyChat(req, res) {
  try {
    const rawBody = await readRequestBody(req);
    const payload = JSON.parse(rawBody || "{}");
    const result = await callOllamaChat({
      model: payload.model,
      messages: payload.messages,
    });
    res.writeHead(result.status, { "Content-Type": "application/json; charset=utf-8" });
    res.end(result.text);
  } catch (error) {
    sendJson(res, 500, {
      error: "Nao foi possivel falar com o Ollama.",
      detail: error.message,
    });
  }
}

// Remove blocos de raciocinio (<think>...</think>) e cercas de codigo,
// devolvendo apenas o objeto JSON que o modelo produziu.
function extractJson(text) {
  if (!text) return null;
  let clean = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  clean = clean.replace(/```json/gi, "").replace(/```/g, "");
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const slice = clean.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

function buildLessonPrompt({ language, level, title, goal }) {
  const lang = languageNames[language] || "ingles";
  const isAlphabet = /alfabeto|som|pronuncia|vogai|letra|silab|escrita|leitura|romaj|kana|kanji|hiragana|katakana/i.test(
    title || ""
  );

  if (language === "japones") {
    const alphabetNote = isAlphabet
      ? '\n- Como este tema trata do alfabeto/sons, no campo "writing" explique os silabarios hiragana e katakana: as vogais あ/い/う/え/お e as colunas de consoantes (ka, sa, ta...). Em "vocabulary" use silabas/sons-chave (term em kana, phonetic em romaji).'
      : "";
    return buildJapanesePrompt({ level, title, goal, alphabetNote });
  }

  const alphabetNote = isAlphabet
    ? `\n- Como este tema trata do alfabeto/sons, em "grammar" explique o alfabeto de ${lang} e o som de cada letra/grafema importante, e em "vocabulary" use letras ou sons-chave com exemplos de palavras.`
    : "";
  return buildGeneralPrompt({ lang, level, title, goal, alphabetNote });
}

function buildJapanesePrompt({ level, title, goal, alphabetNote }) {
  return `Voce e um professor de japones. Crie o conteudo da aula de nivel ${level} com o tema "${title}".
Objetivo da aula: ${goal}

Em japones e essencial mostrar a ESCRITA corretamente. Para CADA palavra, preencha:
- "term": como a palavra realmente se escreve em japones (use kanji quando for natural, junto do kana; use katakana para estrangeirismos; ou apenas hiragana);
- "kana": a leitura completa em hiragana (ou katakana, se a palavra for em katakana);
- "phonetic": o romaji (letras latinas);
- "script": quais sistemas a palavra usa, por exemplo "kanji + hiragana", "somente hiragana" ou "katakana".

Responda APENAS com um objeto JSON valido, sem texto fora do JSON, sem comentarios e sem markdown, exatamente neste formato:
{
  "intro": "1 a 2 frases em portugues apresentando o tema",
  "writing": "explique em portugues, de forma curta, como este tema se escreve em japones: quando se usa hiragana, katakana e kanji aqui e como ler. Mostre os dois modos (kana e kanji/romaji) sempre que necessario.",
  "vocabulary": [
    { "term": "学生", "kana": "がくせい", "phonetic": "gakusei", "script": "kanji + hiragana", "translation": "estudante", "example": "私は学生です。", "exampleKana": "わたしはがくせいです。", "exampleRomaji": "watashi wa gakusei desu.", "exampleTranslation": "Eu sou estudante." }
  ],
  "grammar": "explicacao curta em portugues do ponto principal (gramatica, uso ou pronuncia)",
  "tips": ["dica curta 1", "dica curta 2"],
  "exercises": [
    { "type": "multiple_choice", "question": "pergunta em portugues", "options": ["a", "b", "c", "d"], "answerIndex": 0, "explanation": "por que esta correto" },
    { "type": "fill_blank", "question": "frase em japones (em kana) com ___ no lugar da palavra", "answer": "resposta em kana", "answerRomaji": "a mesma resposta em romaji", "translation": "traducao da frase completa" },
    { "type": "translate", "prompt": "frase em portugues para traduzir (peca a resposta em kana E em romaji)", "answer": "traducao em japones (kanji/kana)", "answerKana": "leitura completa em kana", "answerRomaji": "leitura completa em romaji" }
  ]
}

Regras:
- O exemplo "学生" acima e apenas para mostrar o FORMATO; nao o copie. Gere palavras e frases que pertencam ao tema "${title}".
- Use de 6 a 8 itens em "vocabulary", todos reais e corretos em japones.
- Garanta que "kana", "phonetic" (romaji) e "script" correspondam exatamente ao "term".
- Crie de 4 a 6 exercicios variados (multiple_choice, fill_blank e translate).
- Nos exercicios de escrita (fill_blank e translate), peca e aceite a resposta nas DUAS estruturas: em kana (ou kanji) E em romaji. Preencha "answer", "answerKana" e "answerRomaji" de forma coerente.
- Em multiple_choice, "answerIndex" e o indice (0 a 3) da opcao correta.
- Adapte a dificuldade ao nivel ${level}.${alphabetNote}
- Nao inclua nada alem do JSON.`;
}

function buildGeneralPrompt({ lang, level, title, goal, alphabetNote }) {
  return `Voce e um professor de ${lang}. Crie o conteudo da aula de nivel ${level} com o tema "${title}".
Objetivo da aula: ${goal}

Responda APENAS com um objeto JSON valido, sem texto fora do JSON, sem comentarios e sem markdown, exatamente neste formato:
{
  "intro": "1 a 2 frases em portugues apresentando o tema",
  "vocabulary": [
    {
      "term": "palavra ou frase em ${lang}",
      "phonetic": "pronuncia aproximada (transcricao simples)",
      "translation": "traducao em portugues",
      "example": "frase de exemplo em ${lang}",
      "exampleTranslation": "traducao da frase de exemplo em portugues"
    }
  ],
  "grammar": "explicacao curta em portugues do ponto principal (gramatica, uso ou pronuncia)",
  "tips": ["dica curta 1", "dica curta 2"],
  "exercises": [
    { "type": "multiple_choice", "question": "pergunta em portugues", "options": ["a", "b", "c", "d"], "answerIndex": 0, "explanation": "por que esta correto" },
    { "type": "fill_blank", "question": "frase em ${lang} com ___ no lugar da palavra", "answer": "palavra que completa", "translation": "traducao da frase completa" },
    { "type": "translate", "prompt": "frase em portugues para traduzir", "answer": "traducao em ${lang}" }
  ]
}

Regras:
- Use de 6 a 8 itens em "vocabulary", todos reais e corretos no idioma ${lang}.
- Crie de 4 a 6 exercicios variados (multiple_choice, fill_blank e translate).
- Em multiple_choice, "answerIndex" e o indice (0 a 3) da opcao correta.
- Adapte a dificuldade ao nivel ${level}.${alphabetNote}
- Nao inclua nada alem do JSON.`;
}

async function generateLesson(req, res) {
  try {
    const rawBody = await readRequestBody(req);
    const payload = JSON.parse(rawBody || "{}");
    const { language, level, title, goal, model } = payload;
    if (!title || !language || !level) {
      sendJson(res, 400, { error: "Campos obrigatorios: language, level, title." });
      return;
    }

    const prompt = buildLessonPrompt({ language, level, title, goal });
    const result = await callOllamaChat({
      model,
      messages: [{ role: "user", content: prompt }],
      format: "json",
    });

    let parsed = null;
    try {
      const outer = JSON.parse(result.text);
      const content = outer.message?.content ?? "";
      parsed = extractJson(content) || (typeof content === "object" ? content : null);
    } catch {
      parsed = null;
    }

    if (!parsed || !Array.isArray(parsed.vocabulary)) {
      sendJson(res, 502, {
        error: "O modelo nao retornou um JSON de aula valido. Tente novamente.",
        raw: result.text.slice(0, 500),
      });
      return;
    }

    sendJson(res, 200, { lesson: parsed });
  } catch (error) {
    sendJson(res, 500, {
      error: "Nao foi possivel gerar a aula.",
      detail: error.message,
    });
  }
}

// System prompt do tutor de conversa: forca saida estruturada separando o
// idioma-alvo (escrita nativa) da explicacao em portugues do Brasil.
function buildTutorPrompt({ language, level, mode }) {
  const lang = languageNames[language] || "ingles";
  const latin = language !== "japones"; // japones usa escrita nao-latina

  return `Voce e um tutor particular de ${lang} para um aluno brasileiro (idioma nativo: portugues do Brasil).
Nivel do aluno: ${level}. Modo: ${mode}.

Responda SEMPRE com um unico objeto JSON valido, sem texto fora do JSON, sem markdown, neste formato:
{
  "alvo": "frase ou expressao no idioma-alvo (${lang}), escrita na ESCRITA NATIVA do idioma",
  "leitura": ${latin ? '""' : '"romanizacao (romaji) da frase de alvo"'},
  "traducao_pt": "traducao da frase de alvo em portugues do Brasil",
  "explicacao_pt": "explicacao didatica curta em portugues do Brasil (gramatica, uso, correcao)",
  "pergunta_alvo": "uma pergunta curta no idioma-alvo (${lang}), escrita nativa, para o aluno responder",
  "pergunta_pt": "a mesma pergunta traduzida em portugues do Brasil"
}

Regras OBRIGATORIAS:
- "alvo" e "pergunta_alvo" devem estar 100% no idioma-alvo (${lang}) e na escrita nativa. NUNCA escreva portugues nesses campos.
- "traducao_pt", "explicacao_pt" e "pergunta_pt" devem estar em portugues do Brasil.
- Nunca misture os dois idiomas no mesmo campo.
${
  latin
    ? '- O idioma-alvo usa alfabeto latino: deixe "leitura" como string vazia "".'
    : '- O idioma-alvo nao usa alfabeto latino: preencha "leitura" com a romanizacao (romaji) da frase de alvo.'
}
- Adapte a dificuldade ao nivel ${level} e ao modo ${mode}.
- Se o aluno escrever no idioma-alvo, corrija em "explicacao_pt" e modele a forma correta em "alvo".
- Se o pedido for "meta" (listar assuntos, dar instrucoes, sem frase de exemplo), deixe "alvo", "leitura", "pergunta_alvo" e "pergunta_pt" como "" e escreva a resposta em "explicacao_pt".
- Nao inclua nada alem do JSON.`;
}

async function tutorReply(req, res) {
  try {
    const rawBody = await readRequestBody(req);
    const payload = JSON.parse(rawBody || "{}");
    const {
      language = "ingles",
      level = "iniciante",
      mode = "conversacao",
      messages = [],
      model,
    } = payload;

    const system = buildTutorPrompt({ language, level, mode });
    const result = await callOllamaChat({
      model,
      messages: [{ role: "system", content: system }, ...messages],
      format: "json",
    });

    let parsed = null;
    try {
      const outer = JSON.parse(result.text);
      const content = outer.message?.content ?? "";
      parsed = extractJson(content) || (typeof content === "object" ? content : null);
    } catch {
      parsed = null;
    }

    if (!parsed || typeof parsed !== "object") {
      sendJson(res, 502, {
        error: "O tutor nao retornou um JSON valido. Tente novamente.",
        raw: result.text.slice(0, 400),
      });
      return;
    }

    sendJson(res, 200, { tutor: parsed });
  } catch (error) {
    sendJson(res, 500, { error: "Nao foi possivel falar com o tutor.", detail: error.message });
  }
}

// Traducao gratuita e sem chave via MyMemory, util para todos os idiomas.
async function translateText(req, res) {
  try {
    const rawBody = await readRequestBody(req);
    const { text, from = "pt", to } = JSON.parse(rawBody || "{}");
    if (!text || !to) {
      sendJson(res, 400, { error: "Campos obrigatorios: text, to." });
      return;
    }
    const langpair = `${from}|${to}`;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      text
    )}&langpair=${encodeURIComponent(langpair)}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await r.json();
    const translated = data?.responseData?.translatedText || "";
    if (!translated) {
      sendJson(res, 502, { error: "Servico de traducao nao retornou texto." });
      return;
    }
    sendJson(res, 200, { translated, from, to });
  } catch (error) {
    sendJson(res, 502, { error: "Falha ao traduzir.", detail: error.message });
  }
}

async function health(req, res) {
  let ollamaOk = false;
  let models = [];
  try {
    const r = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(2500) });
    if (r.ok) {
      ollamaOk = true;
      const data = await r.json();
      models = (data.models || []).map((m) => m.name);
    }
  } catch {
    ollamaOk = false;
  }
  sendJson(res, 200, { ok: true, ollamaUrl, ollamaOk, models, defaultModel });
}

function serveStatic(req, res) {
  const requestPath = new URL(req.url, "http://localhost").pathname;
  const safePath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.normalize(path.join(publicDir, safePath));

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (req.url === "/api/chat" && req.method === "POST") {
    proxyChat(req, res);
    return;
  }

  if (req.url === "/api/lesson" && req.method === "POST") {
    generateLesson(req, res);
    return;
  }

  if (req.url === "/api/tutor" && req.method === "POST") {
    tutorReply(req, res);
    return;
  }

  if (req.url === "/api/translate" && req.method === "POST") {
    translateText(req, res);
    return;
  }

  if (req.url === "/api/health" && req.method === "GET") {
    health(req, res);
    return;
  }

  serveStatic(req, res);
});

server.listen(port, () => {
  console.log(`Interface ativa em http://localhost:${port}`);
});
