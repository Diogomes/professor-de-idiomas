const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("node:path");
const { ensureOllama } = require("./ollama");

// Porta local do servidor embutido (evita 3000/3100 comuns).
const PORT = process.env.PORT || "11550";
process.env.PORT = PORT;

let win = null;
let serverStarted = false;

function modelfilePath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "Modelfile.professor")
    : path.join(__dirname, "..", "Modelfile.professor");
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: "#05080d",
    title: "Professor de Idiomas",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, "setup.html"));
  // Links externos (YouTube etc.) abrem no navegador padrao, nao na janela do app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function startLocalServer() {
  if (serverStarted) return Promise.resolve(Number(PORT));
  const server = require("../server.js"); // le OLLAMA_URL/PORT do env (ja setados)
  return new Promise((resolve) =>
    server.start((p) => {
      serverStarted = true;
      resolve(p);
    })
  );
}

async function boot() {
  try {
    send("setup-progress", { label: "Verificando a IA local...", ratio: 0 });
    const res = await ensureOllama({
      userDataDir: app.getPath("userData"),
      modelfilePath: modelfilePath(),
      onProgress: (p) => send("setup-progress", p),
    });
    process.env.OLLAMA_URL = res.ollamaUrl;
    const port = await startLocalServer();
    if (!res.ready && res.reason) send("setup-warn", { message: res.reason });
    send("setup-progress", { label: "Pronto!", ratio: 1 });
    setTimeout(() => win && win.loadURL(`http://127.0.0.1:${port}/`), 600);
  } catch (e) {
    // Mesmo com erro (ex.: offline na 1a vez), sobe o servidor para a estrutura
    // de estudo funcionar; o chat/aulas avisam que a IA ainda nao esta pronta.
    let port = Number(PORT);
    try {
      port = await startLocalServer();
    } catch {
      /* ignora */
    }
    send("setup-error", { message: e.message, port });
  }
}

app.whenReady().then(() => {
  createWindow();
  win.webContents.once("did-finish-load", boot);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

ipcMain.on("retry", () => boot());
ipcMain.on("continue", async () => {
  let port = Number(PORT);
  try {
    port = await startLocalServer();
  } catch {
    /* ignora */
  }
  if (win) win.loadURL(`http://127.0.0.1:${port}/`);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
