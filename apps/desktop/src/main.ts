/**
 * Electron main entry — spawns bridge, loads static web dist, supervises health.
 * MVP: no installer signing; run `pnpm build` in bridge + web before `pnpm start` here.
 */
import { app, BrowserWindow, dialog } from "electron";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BridgeSupervisor } from "./bridge-supervisor.js";
import {
  loadDesktopConfig,
  saveDesktopConfig,
  desktopConfigNeedsSetup,
  type DesktopConfig,
} from "./config.js";
import { resolveInstallRoot } from "./runtime-install-root.js";
import { showSetupWindow } from "./setup/setup-window.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const installRoot = resolveInstallRoot(__dirname);

let supervisor: BridgeSupervisor | null = null;
let mainWindow: BrowserWindow | null = null;

async function runFirstRunSetup(): Promise<DesktopConfig> {
  const initial = loadDesktopConfig();
  const config = await showSetupWindow(initial);
  saveDesktopConfig(config);
  return config;
}

async function createWindow(): Promise<void> {
  let config = loadDesktopConfig();

  // First-run: show setup wizard if dataRoot/sqlitePath not configured
  if (desktopConfigNeedsSetup(config)) {
    try {
      config = await runFirstRunSetup();
    } catch {
      // User cancelled setup — exit gracefully
      console.log("Setup cancelled — exiting.");
      app.exit(0);
      return;
    }
  }

  supervisor = new BridgeSupervisor({ repoRoot: installRoot, config });

  try {
    await supervisor.start();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // Show a friendly error dialog instead of crashing silently
    await dialog.showMessageBox({
      type: "error",
      title: "Clinic service error",
      message: "Clinic service could not start. Please restart the app or contact support.",
      detail: message,
      buttons: ["OK"],
    });
    app.exit(1);
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await mainWindow.loadURL(supervisor.uiUrl);
}

app.whenReady().then(() => {
  createWindow().catch((err) => {
    console.error("desktop startup failed:", err instanceof Error ? err.message : "unknown");
    app.exit(1);
  });
});

app.on("window-all-closed", () => {
  void supervisor?.stop().finally(() => app.quit());
});

app.on("before-quit", () => {
  void supervisor?.stop();
});
