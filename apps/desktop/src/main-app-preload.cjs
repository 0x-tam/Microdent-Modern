const { contextBridge, ipcRenderer } = require("electron");

/**
 * Preload script for the main app window.
 * Exposes a safe API for the Settings operator control center to
 * query clinic service status and trigger setup re-run via IPC.
 */
contextBridge.exposeInMainWorld("electronAPI", {
  /** Query clinic service status via `app:service-status` IPC. */
  getServiceStatus: () => ipcRenderer.invoke("app:service-status"),
  /** Query bridge health via `bridge:health` IPC. */
  getBridgeHealth: () => ipcRenderer.invoke("bridge:health"),
  /** Trigger re-run of first-run setup. */
  reRunSetup: () => ipcRenderer.invoke("setup:retry"),
});
