const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("microdentDesktop", {
  restartClinicService: () => ipcRenderer.invoke("desktop:restart-clinic-service"),
  refreshLocalCopy: () => ipcRenderer.invoke("desktop:refresh-local-copy"),
  exportSupportLog: () => ipcRenderer.invoke("desktop:export-support-log"),
  getSupportDiagnostics: () => ipcRenderer.invoke("desktop:get-support-diagnostics"),
  previewSupportLog: () => ipcRenderer.invoke("desktop:preview-support-log"),
  diagnoseClinicServicePort: () => ipcRenderer.invoke("desktop:diagnose-clinic-service-port"),
  getPortCleanupPolicy: () => ipcRenderer.invoke("desktop:get-port-cleanup-policy"),
  onLocalCopyRefreshProgress: (listener) => {
    if (typeof listener !== "function") return () => {};
    const handler = (_event, progress) => listener(progress);
    ipcRenderer.on("desktop:refresh-local-copy-progress", handler);
    return () => ipcRenderer.removeListener("desktop:refresh-local-copy-progress", handler);
  },
});
