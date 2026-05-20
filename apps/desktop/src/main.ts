/**
 * Electron main entry — spawns bridge, loads static web dist, supervises health.
 * MVP: no installer signing; run `pnpm build` in bridge + web before `pnpm start` here.
 */
import { app, BrowserWindow, dialog } from "electron";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BridgeSupervisor } from "./bridge-supervisor.js";
import {
  defaultDesktopConfig,
  desktopConfigNeedsSetup,
  loadDesktopConfig,
  saveDesktopConfig,
} from "./config.js";
import {
  formatStartupFailure,
  isPathRelatedStartupFailure,
  STARTUP_FAILURE_FOOTER,
} from "./startup-failure.js";
import { showSetupWindow } from "./setup/setup-window.js";
import { collectDesktopStartupWarnings } from "./startup-validation.js";
import { maskOperatorPath } from "./path-validation.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..", "..");

let supervisor: BridgeSupervisor | null = null;

async function resolveDesktopConfig() {
  let config = loadDesktopConfig();
  if (!desktopConfigNeedsSetup(config)) {
    return config;
  }
  config = await showSetupWindow(config);
  saveDesktopConfig(config);
  console.log("Microdent desktop: config saved");
  if (config.dataRoot && config.sqlitePath) {
    console.log(
      `Microdent desktop: data=${maskOperatorPath(config.dataRoot)} sqlite=${maskOperatorPath(config.sqlitePath)} writeMode=${config.writeMode ?? "disabled"}`,
    );
  }
  return config;
}

async function createWindow(): Promise<void> {
  const config = await resolveDesktopConfig();
  for (const warning of collectDesktopStartupWarnings(config)) {
    console.warn(`Microdent desktop: ${warning}`);
  }
  supervisor = new BridgeSupervisor({ repoRoot, config });
  await supervisor.start();

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await win.loadURL(supervisor.uiUrl);
}

function showStartupFailureDialog(message: string): void {
  dialog.showErrorBox(
    "Microdent desktop could not start",
    `${message}\n\n${STARTUP_FAILURE_FOOTER}`,
  );
}

function offerReopenSetup(message: string): boolean {
  const choice = dialog.showMessageBoxSync({
    type: "error",
    title: "Microdent desktop could not start",
    message,
    detail: STARTUP_FAILURE_FOOTER,
    buttons: ["Re-open setup", "Exit"],
    defaultId: 0,
    cancelId: 1,
  });
  return choice === 0;
}

function clearPathsForSetupRetry(): void {
  const current = loadDesktopConfig();
  saveDesktopConfig({
    ...defaultDesktopConfig(),
    bridgePort: current.bridgePort,
  });
}

async function startDesktop(): Promise<void> {
  while (true) {
    try {
      await createWindow();
      return;
    } catch (err) {
      const message = formatStartupFailure(err);
      console.error(`Microdent desktop startup failed: ${message}`);
      if (isPathRelatedStartupFailure(message) && offerReopenSetup(message)) {
        clearPathsForSetupRetry();
        continue;
      }
      showStartupFailureDialog(message);
      app.exit(1);
      return;
    }
  }
}

app.whenReady().then(() => {
  void startDesktop();
});

app.on("window-all-closed", () => {
  void supervisor?.stop().finally(() => app.quit());
});

app.on("before-quit", () => {
  void supervisor?.stop();
});
