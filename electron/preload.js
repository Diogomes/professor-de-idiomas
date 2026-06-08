const { contextBridge, ipcRenderer } = require("electron");

// Ponte segura entre a tela de setup e o processo principal.
contextBridge.exposeInMainWorld("setup", {
  onProgress: (cb) => ipcRenderer.on("setup-progress", (_e, p) => cb(p)),
  onWarn: (cb) => ipcRenderer.on("setup-warn", (_e, p) => cb(p)),
  onError: (cb) => ipcRenderer.on("setup-error", (_e, p) => cb(p)),
  retry: () => ipcRenderer.send("retry"),
  continueAnyway: () => ipcRenderer.send("continue"),
});
