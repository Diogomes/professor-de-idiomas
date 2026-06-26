const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

// Logica de IA (prompts, parsing, romanizacao) compartilhada com o navegador.
const LLMCore = require("./public/llm-core.js");

const root = __dirname;
const publicDir = path.join(root, "public");
const port = Number(process.env.PORT || 3000);
const ollamaUrl = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const defaultModel = process.env.MODEL || "professor-idiomas";
// Modelo base (sem system prompt enviesado) para geracao estruturada: garante
// que o idioma-alvo escolhido comande a saida. O professor-idiomas tinha um
// system prompt focado em japones que, num modelo pequeno, ignorava o idioma.
const structModel = process.env.STRUCT_MODEL || "qwen3:1.7b";

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

function ollamaContent(rawText) {
  const outer = JSON.parse(rawText);
  return outer.message?.content ?? "";
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

async function generateLesson(req, res) {
  try {
    const rawBody = await readRequestBody(req);
    const payload = JSON.parse(rawBody || "{}");
    const { language, level, title, goal, model } = payload;
    if (!title || !language || !level) {
      sendJson(res, 400, { error: "Campos obrigatorios: language, level, title." });
      return;
    }

    const fixed = LLMCore.fixedLesson({ language, title });
    if (fixed) {
      sendJson(res, 200, { lesson: fixed });
      return;
    }

    const prompt = LLMCore.buildLessonPrompt({ language, level, title, goal });
    const result = await callOllamaChat({
      model: model || structModel,
      messages: [{ role: "user", content: prompt }],
      format: "json",
    });

    let lesson = null;
    try {
      lesson = LLMCore.parseLessonContent(ollamaContent(result.text));
    } catch {
      lesson = null;
    }

    if (!lesson) {
      sendJson(res, 502, {
        error: "O modelo nao retornou um JSON de aula valido. Tente novamente.",
        raw: result.text.slice(0, 500),
      });
      return;
    }

    sendJson(res, 200, { lesson });
  } catch (error) {
    sendJson(res, 500, {
      error: "Nao foi possivel gerar a aula.",
      detail: error.message,
    });
  }
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

    const system = LLMCore.buildTutorPrompt({ language, level, mode });
    const result = await callOllamaChat({
      model: model || structModel,
      messages: [{ role: "system", content: system }, ...messages],
      format: "json",
    });

    let tutor = null;
    try {
      tutor = LLMCore.parseTutorContent(ollamaContent(result.text), language);
    } catch {
      tutor = null;
    }

    if (!tutor) {
      sendJson(res, 502, {
        error: "O tutor nao retornou um JSON valido. Tente novamente.",
        raw: result.text.slice(0, 400),
      });
      return;
    }

    sendJson(res, 200, { tutor });
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

function start(cb) {
  server.listen(port, "127.0.0.1", () => {
    console.log(`Interface ativa em http://localhost:${port}`);
    if (typeof cb === "function") cb(port);
  });
  return server;
}

// Executado direto (node server.js): sobe o servidor.
// Exigido pelo Electron (require): exporta start() para controlar o ciclo de vida.
if (require.main === module) {
  start();
}

module.exports = {
  start,
  get port() {
    return port;
  },
};
