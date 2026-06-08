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
  return `Voce e um professor de ${lang}. Crie o conteudo da aula de nivel ${level} com o tema "${title}".
Objetivo da aula: ${goal}

Responda APENAS com um objeto JSON valido, sem texto fora do JSON, sem comentarios e sem markdown, exatamente neste formato:
{
  "intro": "1 a 2 frases em portugues apresentando o tema",
  "vocabulary": [
    {
      "term": "palavra ou frase em ${lang}",
      "phonetic": "pronuncia aproximada (romaji para japones, ou transcricao simples)",
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
- Para japones, use kana/kanji no "term" e romaji no "phonetic".
- Crie de 4 a 6 exercicios variados (multiple_choice, fill_blank e translate).
- Em multiple_choice, "answerIndex" e o indice (0 a 3) da opcao correta.
- Adapte a dificuldade ao nivel ${level}.
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

  if (req.url === "/api/health" && req.method === "GET") {
    health(req, res);
    return;
  }

  serveStatic(req, res);
});

server.listen(port, () => {
  console.log(`Interface ativa em http://localhost:${port}`);
});
