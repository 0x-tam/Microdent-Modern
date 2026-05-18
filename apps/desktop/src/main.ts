/**
 * Electron main entry — spawns bridge, loads static web dist, supervises health.
 * MVP: no installer signing; run `pnpm build` in bridge + web before `pnpm start` here.
 */
import { app, BrowserWindow } from "electron";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BridgeSupervisor } from "./bridge-supervisor.js";
import {
  desktopConfigNeedsSetup,
  loadDesktopConfig,
  saveDesktopConfig,
} from "./config.js";
import { maskOperatorPath } from "./path-validation.js";
import { showSetupWindow } from "./setup/setup-window.js";

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
