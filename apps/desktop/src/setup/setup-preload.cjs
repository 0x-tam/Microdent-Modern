const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("setupApi", {
  saveConfig: (payload) => ipcRenderer.invoke("setup:save", payload),
  pickFolder: (title) => ipcRenderer.invoke("setup:pick-folder", title),
  pickFile: (title, label, extensions) =>
    ipcRenderer.invoke("setup:pick-file", title, label, extensions),
  complete: () => ipcRenderer.invoke("setup:complete"),
  buildLocalCopy: (payload) => ipcRenderer.invoke("setup:build-local-copy", payload),
  retry: () => ipcRenderer.invoke("setup:retry"),
  onChangeFolder: (callback) => ipcRenderer.on("setup:change-folder", callback),
  onImportProgress: (callback) => ipcRenderer.on("setup:import-progress", (_event, data) => callback(data)),
});
