const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("setupApi", {
  saveConfig: (payload) => ipcRenderer.invoke("setup:save", payload),
  pickFolder: (title) => ipcRenderer.invoke("setup:pick-folder", title),
  pickFile: (title, label, extensions) =>
    ipcRenderer.invoke("setup:pick-file", title, label, extensions),
  onImportProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on("setup:import-progress", listener);
    return () => ipcRenderer.removeListener("setup:import-progress", listener);
  },
  complete: () => ipcRenderer.invoke("setup:complete"),
});
