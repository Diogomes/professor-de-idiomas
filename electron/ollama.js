// Gerencia o Ollama local para o app desktop:
// - localiza/baixa o binario na primeira execucao (precisa de internet so uma vez);
// - sobe `ollama serve` (ou reaproveita um ja ativo);
// - garante o modelo do professor (pull do base + create do Modelfile).
// Tudo fica no diretorio de dados do app, entao depois funciona 100% offline.

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { spawn, spawnSync } = require("node:child_process");

const BASE_MODEL = process.env.BASE_MODEL || "qwen3:1.7b";
const PROFESSOR_MODEL = process.env.MODEL || "professor-idiomas";
const OLLAMA_VERSION = process.env.OLLAMA_VERSION || "v0.30.6";
const HOST = process.env.OLLAMA_HOST || "127.0.0.1:11434";
const OLLAMA_URL = `http://${HOST}`;

// Ativo de download por plataforma (GitHub releases do Ollama).
function assetForPlatform() {
  const base = `https://github.com/ollama/ollama/releases/download/${OLLAMA_VERSION}`;
  if (process.platform === "win32") return { url: `${base}/ollama-windows-amd64.zip`, file: "ollama.zip", kind: "zip" };
  if (process.platform === "darwin") return { url: `${base}/ollama-darwin.tgz`, file: "ollama.tgz", kind: "tgz" };
  return { url: `${base}/ollama-linux-amd64.tar.zst`, file: "ollama.tar.zst", kind: "zst" };
}

function paths(userDataDir) {
  const root = path.join(userDataDir, "ollama");
  const binName = process.platform === "win32" ? "ollama.exe" : "ollama";
  // Em alguns pacotes o binario fica em bin/, em outros na raiz: resolvemos ao usar.
  return {
    root,
    modelsDir: path.join(root, "models"),
    candidates: [path.join(root, "bin", binName), path.join(root, binName)],
  };
}

function findBinary(p) {
  return p.candidates.find((c) => fs.existsSync(c)) || null;
}

async function isOnline() {
  try {
    const r = await fetch("https://github.com", { method: "HEAD", signal: AbortSignal.timeout(4000) });
    return r.ok || r.status > 0;
  } catch {
    return false;
  }
}

async function serverUp() {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/version`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch {
    return false;
  }
}

async function downloadFile(url, dest, onProgress) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Download falhou (${res.status}) em ${url}`);
  const total = Number(res.headers.get("content-length") || 0);
  let received = 0;
  const out = fs.createWriteStream(dest);
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.length;
    out.write(Buffer.from(value));
    if (total && onProgress) onProgress(received / total, received, total);
  }
  await new Promise((resolve, reject) => out.end((e) => (e ? reject(e) : resolve())));
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "pipe", encoding: "utf8", ...opts });
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} falhou: ${r.stderr || r.stdout || r.error}`);
  }
  return r.stdout || "";
}

async function extractArchive(archivePath, destDir, kind) {
  await fsp.mkdir(destDir, { recursive: true });
  if (kind === "zip") {
    if (process.platform === "win32") {
      // PowerShell esta sempre disponivel no Windows.
      run("powershell", [
        "-NoProfile",
        "-Command",
        `Expand-Archive -LiteralPath '${archivePath}' -DestinationPath '${destDir}' -Force`,
      ]);
    } else {
      run("unzip", ["-o", archivePath, "-d", destDir]);
    }
  } else if (kind === "zst") {
    run("tar", ["--zstd", "-xf", archivePath, "-C", destDir]);
  } else {
    run("tar", ["-xzf", archivePath, "-C", destDir]);
  }
}

// Garante o binario do Ollama; baixa na primeira vez (precisa de internet).
async function ensureBinary(userDataDir, onProgress) {
  const p = paths(userDataDir);
  let bin = findBinary(p);
  if (bin) return bin;

  if (!(await isOnline())) {
    throw new Error(
      "Primeira execucao precisa de internet para baixar a IA local (Ollama). Conecte-se uma vez; depois funciona offline."
    );
  }

  await fsp.mkdir(p.root, { recursive: true });
  const asset = assetForPlatform();
  const archivePath = path.join(p.root, asset.file);
  onProgress && onProgress({ phase: "download-ollama", label: "Baixando a IA local (Ollama)...", ratio: 0 });
  await downloadFile(asset.url, archivePath, (ratio) =>
    onProgress && onProgress({ phase: "download-ollama", label: "Baixando a IA local (Ollama)...", ratio })
  );
  onProgress && onProgress({ phase: "extract-ollama", label: "Instalando a IA local...", ratio: 1 });
  await extractArchive(archivePath, p.root, asset.kind);
  await fsp.rm(archivePath, { force: true });

  bin = findBinary(p);
  if (!bin) throw new Error("Binario do Ollama nao encontrado apos extracao.");
  if (process.platform !== "win32") fs.chmodSync(bin, 0o755);
  return bin;
}

// Sobe `ollama serve` (se ainda nao estiver ativo) e espera ficar pronto.
async function startServe(bin, userDataDir, onProgress) {
  if (await serverUp()) return null; // reaproveita um Ollama ja ativo

  const p = paths(userDataDir);
  await fsp.mkdir(p.modelsDir, { recursive: true });
  onProgress && onProgress({ phase: "serve", label: "Iniciando a IA local...", ratio: 1 });

  const child = spawn(bin, ["serve"], {
    env: { ...process.env, OLLAMA_HOST: HOST, OLLAMA_MODELS: p.modelsDir },
    stdio: "ignore",
    detached: false,
  });

  for (let i = 0; i < 60; i++) {
    if (await serverUp()) return child;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Ollama nao respondeu a tempo.");
}

async function listModels() {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
    const d = await r.json();
    return (d.models || []).map((m) => m.name);
  } catch {
    return [];
  }
}

// Garante o modelo do professor. Se faltar e houver internet, baixa o base e
// cria o modelo a partir do Modelfile. Offline sem o modelo: avisa o chamador.
async function ensureModel(bin, userDataDir, modelfilePath, onProgress) {
  const models = await listModels();
  const has = (name) => models.some((m) => m === name || m.startsWith(name + ":"));
  if (has(PROFESSOR_MODEL)) return { ready: true };

  if (!(await isOnline())) {
    return {
      ready: false,
      reason:
        "O modelo da IA ainda nao foi baixado e nao ha internet. Conecte-se uma vez para concluir a instalacao.",
    };
  }

  const env = { ...process.env, OLLAMA_HOST: HOST, OLLAMA_MODELS: paths(userDataDir).modelsDir };

  if (!has(BASE_MODEL)) {
    onProgress && onProgress({ phase: "pull-model", label: `Baixando o modelo ${BASE_MODEL} (~1.4 GB)...`, ratio: 0 });
    await pullWithProgress(bin, BASE_MODEL, env, onProgress);
  }

  onProgress && onProgress({ phase: "create-model", label: "Preparando o professor...", ratio: 1 });
  run(bin, ["create", PROFESSOR_MODEL, "-f", modelfilePath], { env });
  return { ready: true };
}

// `ollama pull` com progresso por streaming da API /api/pull.
async function pullWithProgress(bin, model, env, onProgress) {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, stream: true }),
    });
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const j = JSON.parse(line);
          if (j.total && j.completed && onProgress) {
            onProgress({ phase: "pull-model", label: `Baixando o modelo ${model}...`, ratio: j.completed / j.total });
          }
        } catch {
          /* ignora linhas parciais */
        }
      }
    }
  } catch {
    // Fallback: usa o CLI (sem barra de progresso fina).
    run(bin, ["pull", model], { env });
  }
}

// Orquestra tudo. Retorna { ollamaUrl, ready, reason }.
async function ensureOllama({ userDataDir, modelfilePath, onProgress }) {
  const bin = await ensureBinary(userDataDir, onProgress);
  const child = await startServe(bin, userDataDir, onProgress);
  const model = await ensureModel(bin, userDataDir, modelfilePath, onProgress);
  return { ollamaUrl: OLLAMA_URL, child, ...model };
}

module.exports = { ensureOllama, serverUp, isOnline, OLLAMA_URL, HOST, PROFESSOR_MODEL };
