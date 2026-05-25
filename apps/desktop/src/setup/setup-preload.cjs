const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("setupApi", {
  saveConfig: (payload) => ipcRenderer.invoke("setup:save", payload),
  pickFolder: (title) => ipcRenderer.invoke("setup:pick-folder", title),
});
