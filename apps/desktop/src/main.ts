/**
 * Electron main entry — spawns bridge, loads static web dist, supervises health.
 * MVP: no installer signing; run `pnpm build` in bridge + web before `pnpm start` here.
 */
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, existsSync, statSync } from "node:fs";
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
let restartAttempted = false;

/**
 * Show a native error dialog and exit.
 */
async function showFatalError(title: string, message: string, detail?: string): Promise<void> {
  await dialog.showMessageBox({
    type: "error",
    title,
    message,
    detail: detail ?? "",
    buttons: ["OK"],
  });
}

/**
 * Derive a default backup directory next to the data root and create it if missing.
 * Only runs when config has dataRoot but no backupDir — does NOT run during first-run
 * (setup-window.ts already handles this).
 */
function ensureBackupDir(config: DesktopConfig): DesktopConfig {
  if (config.backupDir?.trim()) return config;
  if (!config.dataRoot?.trim()) return config;

  const parent = dirname(config.dataRoot);
  const derived = join(parent, "microdent-backups");

  if (existsSync(derived)) {
    try {
      if (statSync(derived).isDirectory()) {
        return { ...config, backupDir: derived };
      }
    } catch {
      // Not a directory — skip auto-creation
      return config;
    }
  }

  try {
    mkdirSync(derived, { recursive: true });
    console.log(`Auto-created backup directory: ${derived}`);
    return { ...config, backupDir: derived };
  } catch {
    console.warn(`Could not create default backup directory at ${derived}`);
    return config;
  }
}

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
  } else {
    // Not first-run: auto-derive backupDir if dataRoot exists but backupDir is missing
    const enhanced = ensureBackupDir(config);
    if (enhanced.backupDir && !config.backupDir) {
      config = enhanced;
      // Persist the auto-derived backupDir so it survives restarts
      try {
        saveDesktopConfig(config);
      } catch {
        console.warn("Could not persist auto-derived backupDir");
      }
    }
  }

  // IPC for health status — the web app can subscribe to bridge health
  ipcMain.handle("bridge:health", () => {
    return supervisor !== null ? "connected" : "disconnected";
  });

  // IPC for detailed service status — used by Settings page
  ipcMain.handle("app:service-status", () => {
    if (supervisor === null) {
      return { status: "stopped" as const, port: null, lastError: null };
    }
    return supervisor.healthStatus;
  });

  supervisor = new BridgeSupervisor({
    repoRoot: installRoot,
    config,
    onHealthDegraded: (error: string) => {
      console.warn("Bridge health degraded:", error);
      // Show a subtle notification in the main window if it's open
      mainWindow?.webContents.send("bridge:health-degraded", error);
    },
    onRecovered: () => {
      console.log("Bridge recovered.");
      mainWindow?.webContents.send("bridge:health-recovered");
    },
    onCrash: () => {
      if (!supervisor) return;
      if (restartAttempted) {
        // Already attempted one restart — don't loop
        console.error("Bridge crashed again after restart — giving up.");
        mainWindow?.webContents.send(
          "bridge:health-degraded",
          "Clinic service crashed multiple times. Please restart the app.",
        );
        return;
      }
      restartAttempted = true;
      console.warn("Bridge crashed — main process attempting restart...");
      mainWindow?.webContents.send("bridge:health-degraded", "Clinic service unexpectedly stopped. Restarting...");
      supervisor.restart().catch((err) => {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("Bridge restart failed:", message);
        void showFatalError(
          "Clinic service error",
          "The clinic service could not restart after crashing.",
          message,
        );
      });
    },
  });

  try {
    await supervisor.start();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await showFatalError(
      "Clinic service error",
      "The clinic service could not start. Please restart the app or contact support.",
      message,
    );
    app.exit(1);
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(__dirname, "main-app-preload.cjs"),
    },
  });

  await mainWindow.loadURL(supervisor.uiUrl);
}

app.whenReady().then(() => {
  createWindow().catch((err) => {
    console.error("desktop startup failed:", err instanceof Error ? err.message : "unknown");
    void showFatalError(
      "Startup failed",
      "Microdent could not start.",
      err instanceof Error ? err.message : undefined,
    ).then(() => app.exit(1));
  });
});

app.on("window-all-closed", () => {
  void supervisor?.stop().finally(() => app.quit());
});

app.on("before-quit", () => {
  void supervisor?.stop();
});

// Handle uncaught exceptions gracefully
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err.message);
  // Don't crash the whole app for non-fatal errors
});
