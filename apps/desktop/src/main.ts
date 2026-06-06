/**
 * Electron main entry — spawns bridge, loads static web dist, supervises health.
 * MVP: no installer signing; run `pnpm build` in bridge + web before `pnpm start` here.
 */
import { app, BrowserWindow, crashReporter, dialog, ipcMain } from "electron";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BridgeSupervisor } from "./bridge-supervisor.js";
import {
  loadDesktopConfig,
  saveDesktopConfig,
  desktopConfigNeedsSetup,
  suggestedCrashDumpsDir,
  suggestedLogsDir,
  type DesktopConfig,
} from "./config.js";
import { resolveInstallRoot } from "./runtime-install-root.js";
import { showSetupWindow } from "./setup/setup-window.js";
import { createDesktopLogger, exportSupportLogBundle, type DesktopLogger } from "./desktop-logger.js";
import { runSetupImport, type SetupImportProgress } from "./setup-import.js";
import {
  diagnoseClinicServicePorts,
  resolveClinicServicePortCleanupPolicy,
} from "./port-diagnostics.js";
import { configureLocalCrashReporting } from "./crash-reporting.js";
import {
  previewLatestSupportLogExport,
  summarizeSupportDiagnostics,
} from "./support-diagnostics.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const installRoot = resolveInstallRoot(__dirname);

let supervisor: BridgeSupervisor | null = null;
let mainWindow: BrowserWindow | null = null;
let restartAttempted = false;
let logger: DesktopLogger | null = null;
let localCopyRefreshRunning = false;

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

async function runFirstRunSetup(): Promise<DesktopConfig> {
  const initial = loadDesktopConfig();
  const config = await showSetupWindow(initial, { installRoot });
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

  logger = createDesktopLogger(config.logsDir ?? suggestedLogsDir());
  configureLocalCrashReporting({
    app,
    crashReporter,
    crashDumpsDir: config.crashDumpsDir ?? suggestedCrashDumpsDir(),
    logger,
  });
  logger.info("desktop_start", {
    setupComplete: Boolean(config.setupCompletedAt),
    writeMode: config.writeMode ?? "disabled",
  });

  // IPC for health status — the web app can subscribe to bridge health
  ipcMain.handle("bridge:health", () => {
    return supervisor !== null ? "connected" : "disconnected";
  });
  ipcMain.handle("desktop:restart-clinic-service", async () => {
    if (!supervisor) {
      logger?.warn("clinic_service_restart_unavailable");
      return { ok: false, message: "Clinic service is not running." };
    }
    try {
      logger?.info("clinic_service_restart_requested");
      await supervisor.restart();
      restartAttempted = false;
      return { ok: true, message: "Clinic service restarted." };
    } catch {
      logger?.error("clinic_service_restart_request_failed");
      return { ok: false, message: "Clinic service could not restart." };
    }
  });
  ipcMain.handle("desktop:refresh-local-copy", async () => {
    if (localCopyRefreshRunning) {
      return { ok: false, message: "Local copy refresh is already running." };
    }

    const currentConfig = loadDesktopConfig();
    if (!currentConfig.dataRoot?.trim() || !currentConfig.sqlitePath?.trim()) {
      logger?.warn("local_copy_refresh_not_configured");
      return { ok: false, message: "Choose a copied clinic data folder in setup first." };
    }

    localCopyRefreshRunning = true;
    const sendProgress = (progress: SetupImportProgress): void => {
      mainWindow?.webContents.send("desktop:refresh-local-copy-progress", progress);
    };

    try {
      logger?.info("local_copy_refresh_requested");
      const summary = await runSetupImport({
        installRoot,
        dataRoot: currentConfig.dataRoot,
        sqlitePath: currentConfig.sqlitePath,
        onProgress: sendProgress,
      });
      saveDesktopConfig({
        ...currentConfig,
        lastImportStatus: summary.overall,
      });
      logger?.info("local_copy_refresh_finished", {
        overall: summary.overall,
        coreReady: summary.coreReady,
      });
      const ok = summary.coreReady;
      return {
        ok,
        message: ok
          ? "Local copy refreshed. Search and schedule can use the latest copied data."
          : "Local copy refresh did not pass readiness checks. Previous local copy was kept.",
        overall: summary.overall,
        coreReady: summary.coreReady,
      };
    } catch {
      logger?.error("local_copy_refresh_failed");
      saveDesktopConfig({
        ...currentConfig,
        lastImportStatus: "failed",
      });
      return {
        ok: false,
        message: "Local copy refresh failed. Previous local copy was kept.",
        overall: "failed",
        coreReady: false,
      };
    } finally {
      localCopyRefreshRunning = false;
    }
  });
  ipcMain.handle("desktop:export-support-log", async () => {
    const currentConfig = loadDesktopConfig();
    const logsDir = currentConfig.logsDir ?? suggestedLogsDir();
    try {
      logger?.info("support_log_export_requested");
      const result = exportSupportLogBundle(logsDir);
      logger?.info("support_log_export_finished", {
        fileName: result.fileName,
        lineCount: result.lineCount,
      });
      return {
        ok: true,
        message: "Support log exported. It contains operational events only, with paths sanitized.",
        fileName: result.fileName,
        lineCount: result.lineCount,
      };
    } catch {
      logger?.error("support_log_export_failed");
      return {
        ok: false,
        message: "Support log could not be exported.",
      };
    }
  });
  ipcMain.handle("desktop:get-support-diagnostics", async () => {
    const currentConfig = loadDesktopConfig();
    const logsDir = currentConfig.logsDir ?? suggestedLogsDir();
    const crashDumpsDir = currentConfig.crashDumpsDir ?? suggestedCrashDumpsDir();
    try {
      logger?.info("support_diagnostics_requested");
      return summarizeSupportDiagnostics({ logsDir, crashDumpsDir });
    } catch {
      logger?.error("support_diagnostics_failed");
      return {
        ok: false,
        logFileCount: 0,
        supportExportCount: 0,
        crashDumpCount: 0,
        crashDumpFiles: [],
        latestLogUpdatedAt: null,
        latestCrashDumpUpdatedAt: null,
        latestSupportExportFileName: null,
        message: "Diagnostics summary could not be loaded.",
      };
    }
  });
  ipcMain.handle("desktop:preview-support-log", async () => {
    const currentConfig = loadDesktopConfig();
    const logsDir = currentConfig.logsDir ?? suggestedLogsDir();
    try {
      logger?.info("support_log_preview_requested");
      return previewLatestSupportLogExport({ logsDir });
    } catch {
      logger?.error("support_log_preview_failed");
      return {
        ok: false,
        fileName: null,
        lineCount: 0,
        lines: [],
        message: "Support log preview could not be loaded.",
      };
    }
  });
  ipcMain.handle("desktop:diagnose-clinic-service-port", async () => {
    const currentConfig = loadDesktopConfig();
    const configuredPort = currentConfig.bridgePort ?? 17890;
    const activePort = supervisor?.currentPort ?? null;
    try {
      logger?.info("clinic_service_port_diagnostic_requested", {
        configuredPort,
        activePort: activePort ?? "none",
      });
      const result = await diagnoseClinicServicePorts({ configuredPort, activePort });
      logger?.info("clinic_service_port_diagnostic_finished", {
        ok: result.ok,
        configuredPort: result.configuredPort,
        activePort: result.activePort ?? "none",
        configuredPortState: result.configuredPortState,
        activePortState: result.activePortState ?? "none",
      });
      return result;
    } catch {
      logger?.error("clinic_service_port_diagnostic_failed");
      return {
        ok: false,
        configuredPort,
        activePort,
        configuredPortState: "not-responding",
        activePortState: null,
        message: "Clinic service port diagnostic could not run.",
      };
    }
  });
  ipcMain.handle("desktop:get-port-cleanup-policy", async () => {
    const currentConfig = loadDesktopConfig();
    const configuredPort = currentConfig.bridgePort ?? 17890;
    const activePort = supervisor?.currentPort ?? null;
    logger?.info("clinic_service_port_cleanup_policy_requested", {
      configuredPort,
      activePort: activePort ?? "none",
    });
    return resolveClinicServicePortCleanupPolicy({ configuredPort, activePort });
  });

  supervisor = new BridgeSupervisor({
    repoRoot: installRoot,
    config,
    onHealthDegraded: (error: string) => {
      console.warn("Bridge health degraded:", error);
      logger?.warn("clinic_service_degraded");
      // Show a subtle notification in the main window if it's open
      mainWindow?.webContents.send("bridge:health-degraded", error);
    },
    onRecovered: () => {
      console.log("Bridge recovered.");
      logger?.info("clinic_service_recovered");
      mainWindow?.webContents.send("bridge:health-recovered");
    },
    onCrash: () => {
      if (!supervisor) return;
      if (restartAttempted) {
        // Already attempted one restart — don't loop
        console.error("Bridge crashed again after restart — giving up.");
        logger?.error("clinic_service_restart_give_up");
        mainWindow?.webContents.send(
          "bridge:health-degraded",
          "Clinic service crashed multiple times. Please restart the app.",
        );
        return;
      }
      restartAttempted = true;
      console.warn("Bridge crashed — main process attempting restart...");
      logger?.warn("clinic_service_restart_attempt");
      mainWindow?.webContents.send("bridge:health-degraded", "Clinic service unexpectedly stopped. Restarting...");
      supervisor.restart().catch((err) => {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("Bridge restart failed:", message);
        logger?.error("clinic_service_restart_failed");
        void showFatalError(
          "Clinic service error",
          "The clinic service could not restart after crashing.",
          message,
        );
      });
    },
    logger,
  });

  try {
    await supervisor.start();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger?.error("clinic_service_start_failed");
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
      preload: join(__dirname, "app-preload.cjs"),
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
  logger?.error("desktop_uncaught_exception");
  // Don't crash the whole app for non-fatal errors
});
