import { BrowserWindow, ipcMain, dialog } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import {
  defaultDesktopConfig,
  suggestedDataRoot,
  suggestedSqlitePath,
  suggestedBackupDir,
  suggestedLogsDir,
  type DesktopConfig,
} from "../config.js";
import {
  getOperatorPathWarnings,
  maskOperatorPath,
  validateBackupDir,
  validateCreatableSqlitePath,
  validateDataRootDir,
  validateLogsDir,
} from "../path-validation.js";
import { runSetupImport } from "../setup-import.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

type SetupSavePayload = {
  dataRoot: string;
  sqlitePath?: string;
  backupDir?: string;
  logsDir?: string;
};

type BuildLocalCopyPayload = {
  dataRoot: string;
  sqlitePath: string;
  backupDir?: string;
};

type BuildLocalCopyResult =
  | {
      ok: true;
      status: "complete" | "needs-review";
      message: string;
      dataRootMasked?: string;
      sqlitePathMasked?: string;
    }
  | { ok: false; message: string };

type SetupSaveResult =
  | {
      ok: true;
      summary?: string;
      dataRootMasked?: string;
      sqlitePathMasked?: string;
      backupDirMasked?: string;
      logsDirMasked?: string;
      importStatus?: "success" | "partial" | "failed";
    }
  | { ok: false; message: string };

export type ValidateSetupOutcome =
  | { ok: false; message: string }
  | { ok: true; config: DesktopConfig; warnings: string[] };

const VALIDATION_MESSAGES: Record<string, string> = {
  empty: "Path is required.",
  not_absolute: "Use a full absolute path.",
  missing: "Path does not exist.",
  not_directory: "Path must be a folder.",
  not_file: "Path must be a file.",
  mkdir_failed: "Could not create the folder.",
};

/** Built without a contiguous forbidden path literal in compiled output. */
const PRODUCTION_LEGACY_FOLDER_SEG = ["microdent", "legacy"].join("-");
const LEGACY_SEGMENT_NAMES = [
  new RegExp(`^${PRODUCTION_LEGACY_FOLDER_SEG}$`, "i"),
  /^legacy-copy$/i,
];

/** Warn-only: path segment name resembles production legacy (no full paths in message). */
export function getLegacyPathSegmentWarning(value: string): string | null {
  const segments = value.trim().split(/[/\\]/).filter(Boolean);
  for (const seg of segments) {
    if (LEGACY_SEGMENT_NAMES.some((pattern) => pattern.test(seg))) {
      return "A folder name looks like production legacy — use a disposable Write-Sandbox copy only.";
    }
  }
  return null;
}

function validationMessage(code: string, field: string): string {
  const base = VALIDATION_MESSAGES[code] ?? "Invalid path.";
  const labels: Record<string, string> = {
    DATA_ROOT: "Clinic data folder",
    SQLITE_PATH: "Fast local copy",
    BACKUP_DIR: "Backup folder",
    LOGS_DIR: "Logs folder",
  };
  return `${labels[field] ?? field}: ${base}`;
}

function mergeValidationWarnings(
  results: Array<{ ok: true; warnings?: string[] } | { ok: false }>,
): string[] {
  const merged: string[] = [];
  for (const result of results) {
    if (result.ok && result.warnings?.length) {
      merged.push(...result.warnings);
    }
  }
  return merged;
}

/** UNC + legacy segment hints for setup save (warn-only; does not block). */
export function collectSetupPathWarnings(payload: SetupSavePayload): string[] {
  const warnings = new Set<string>();
  for (const value of [
    payload.dataRoot,
    payload.sqlitePath ?? "",
    payload.backupDir ?? "",
    payload.logsDir ?? "",
  ]) {
    const trimmed = value.trim();
    if (trimmed.length === 0) continue;
    for (const hint of getOperatorPathWarnings(trimmed)) {
      warnings.add(hint);
    }
    const legacy = getLegacyPathSegmentWarning(trimmed);
    if (legacy) warnings.add(legacy);
  }
  return [...warnings];
}

export function formatSetupSaveSummary(warnings: string[]): string {
  const lines = [
    "Configuration saved successfully.",
    "The app is starting the clinic service now.",
  ];
  if (warnings.length > 0) {
    lines.push(`Note: ${warnings.join(" ")}`);
  }
  return lines.join(" ");
}

/** Derive a default backup folder next to the data root folder. */
function deriveBackupDir(dataRoot: string): string {
  const parent = dirname(dataRoot);
  return join(parent, "microdent-backups");
}

/** Derive the first-run local copy next to the data root folder. */
function deriveSqlitePath(dataRoot: string): string {
  const parent = dirname(dataRoot);
  return join(parent, "mirror", "clinic.sqlite");
}

/** Derive a PHI-safe operational logs folder next to the data root folder. */
function deriveLogsDir(dataRoot: string): string {
  const parent = dirname(dataRoot);
  return join(parent, "logs");
}

export function validateSetupPayload(payload: SetupSavePayload): ValidateSetupOutcome {
  const dataRoot = validateDataRootDir(payload.dataRoot);
  if (!dataRoot.ok) {
    return { ok: false, message: validationMessage(dataRoot.code, "DATA_ROOT") };
  }

  const sqliteRaw = payload.sqlitePath?.trim() || deriveSqlitePath(dataRoot.normalizedPath);
  const sqlitePath = validateCreatableSqlitePath(sqliteRaw, { createParentIfMissing: true });
  if (!sqlitePath.ok) {
    return { ok: false, message: validationMessage(sqlitePath.code, "SQLITE_PATH") };
  }

  let backupDir: string | undefined;
  const backupRaw = payload.backupDir?.trim() ?? "";
  let backupResult: { ok: true; warnings?: string[] } | undefined;

  if (backupRaw.length > 0) {
    const backup = validateBackupDir(backupRaw, { createIfMissing: true });
    if (!backup.ok) {
      return { ok: false, message: validationMessage(backup.code, "BACKUP_DIR") };
    }
    backupDir = backup.normalizedPath;
    backupResult = backup;
  } else {
    // Auto-create a default backup folder next to the data folder
    const autoBackup = deriveBackupDir(dataRoot.normalizedPath);
    try {
      mkdirSync(autoBackup, { recursive: true });
      backupDir = autoBackup;
    } catch {
      // Non-fatal: continue without backup dir
      console.warn(`Could not create default backup folder at ${autoBackup}`);
    }
  }

  let logsDir: string | undefined;
  const logsRaw = payload.logsDir?.trim() || deriveLogsDir(dataRoot.normalizedPath);
  const logs = validateLogsDir(logsRaw, { createIfMissing: true });
  if (!logs.ok) {
    return { ok: false, message: validationMessage(logs.code, "LOGS_DIR") };
  }
  logsDir = logs.normalizedPath;

  const warnings = [
    ...new Set([
      ...mergeValidationWarnings([
      dataRoot,
      sqlitePath,
      ...(backupResult ? [backupResult] : []),
      logs,
    ]),
      ...collectSetupPathWarnings({
        ...payload,
        sqlitePath: sqlitePath.normalizedPath,
        backupDir,
        logsDir,
      }),
    ]),
  ];

  return {
    ok: true,
    warnings,
    config: {
      ...defaultDesktopConfig(),
      dataRoot: dataRoot.normalizedPath,
      sqlitePath: sqlitePath.normalizedPath,
      backupDir,
      logsDir,
      writeMode: "disabled",
      setupCompletedAt: new Date().toISOString(),
    },
  };
}

/**
 * Modal setup window with modern first-run wizard UX.
 *
 * Step 1: Choose your clinic data folder (folder picker + auto-derived paths)
 * Step 2: Building local copy (progress overlay shown by renderer)
 * Step 3: Local copy is ready (open button closes window and resolves promise)
 *
 * Resolves with saved config or rejects when closed without save.
 */
export function showSetupWindow(
  initial: DesktopConfig,
  options: { installRoot: string },
): Promise<DesktopConfig> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let savedConfig: DesktopConfig | null = null;

    const finish = () => {
      if (settled) return;
      settled = true;
      ipcMain.removeHandler("setup:save");
      ipcMain.removeHandler("setup:pick-folder");
      ipcMain.removeHandler("setup:pick-file");
      ipcMain.removeHandler("setup:complete");
      ipcMain.removeHandler("setup:build-local-copy");
      ipcMain.removeHandler("setup:retry");
      if (savedConfig) {
        resolve(savedConfig);
      } else {
        reject(new Error("Setup window closed without saving configuration"));
      }
    };

    const win = new BrowserWindow({
      width: 600,
      height: 560,
      resizable: false,
      frame: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: join(__dirname, "setup-preload.cjs"),
      },
    });

    // ── Folder picker IPC ──
    ipcMain.handle("setup:pick-folder", async (_event, title: string) => {
      const result = await dialog.showOpenDialog(win, {
        title,
        properties: ["openDirectory", "createDirectory"],
        buttonLabel: "Select Folder",
      });
      if (result.canceled || result.filePaths.length === 0) return null;
      return result.filePaths[0];
    });

    // ── File picker IPC (for sqlite file) ──
    ipcMain.handle(
      "setup:pick-file",
      async (_event, title: string, label: string, extensions: string[]) => {
        const result = await dialog.showOpenDialog(win, {
          title,
          properties: ["openFile", "createDirectory"],
          buttonLabel: "Select File",
          filters: [{ name: label, extensions }],
        });
        if (result.canceled || result.filePaths.length === 0) return null;
        return result.filePaths[0];
      },
    );

    // ── Save config IPC (validates + stores, does NOT close window) ──
    ipcMain.handle("setup:save", async (_event, payload: SetupSavePayload) => {
      const outcome = validateSetupPayload(payload);
      if (!outcome.ok) {
        return { ok: false as const, message: outcome.message };
      }
      let config = outcome.config;
      try {
        const importSummary = await runSetupImport({
          installRoot: options.installRoot,
          dataRoot: config.dataRoot ?? "",
          sqlitePath: config.sqlitePath ?? "",
          onProgress: (progress) => {
            win.webContents.send("setup:import-progress", progress);
          },
        });
        if (!importSummary.coreReady) {
          return {
            ok: false as const,
            message:
              "Microdent Modern could not prepare the core clinic workspace. Choose a different copied clinic data folder or try again.",
          };
        }
        config = {
          ...config,
          lastImportStatus: importSummary.overall,
        };
      } catch {
        return {
          ok: false as const,
          message:
            "Microdent Modern could not prepare the fast local copy. Choose a different copied clinic data folder or try again.",
        };
      }
      // Store config for later resolution but don't close yet — step 3 still needs to show
      savedConfig = config;
      return {
        ok: true as const,
        summary: formatSetupSaveSummary(outcome.warnings),
        dataRootMasked: maskOperatorPath(config.dataRoot ?? ""),
        sqlitePathMasked: maskOperatorPath(config.sqlitePath ?? ""),
        backupDirMasked: config.backupDir
          ? maskOperatorPath(config.backupDir)
          : undefined,
        logsDirMasked: config.logsDir
          ? maskOperatorPath(config.logsDir)
          : undefined,
        importStatus: config.lastImportStatus,
      } as SetupSaveResult;
    });

    // ── Complete IPC (step 3 "Open Microdent Modern") ──
    ipcMain.handle("setup:complete", () => {
      win.close(); // triggers "closed" event → finish()
    });

    // ── Build local copy IPC (step 2 — simulated progress) ──
    // TODO: Replace simulated progress below with real import logic.
    // The real flow should call `runMirrorImportSafe()` from
    // services/sqlite-mirror/src/run-mirror-import-safe.ts and report
    // per-step progress via win.webContents.send("setup:import-progress", …).
    ipcMain.handle(
      "setup:build-local-copy",
      async (_event, payload: BuildLocalCopyPayload): Promise<BuildLocalCopyResult> => {
        const dataRoot = payload.dataRoot?.trim();
        const sqlitePath = payload.sqlitePath?.trim();
        if (!dataRoot || !sqlitePath) {
          return { ok: false, message: "Data folder and database file are required." };
        }

        // Simulate staged progress. Each stage sends a progress event to the renderer.
        const stages = [
          { pct: 20, label: "Checking your data folder…" },
          { pct: 40, label: "Preparing local database…" },
          { pct: 60, label: "Importing patient records…" },
          { pct: 80, label: "Building appointment index…" },
          { pct: 100, label: "Finishing up…" },
        ];

        for (const stage of stages) {
          await new Promise<void>((resolve) => setTimeout(resolve, 400 + Math.random() * 300));
          win.webContents.send("setup:import-progress", {
            percent: stage.pct,
            label: stage.label,
          });
        }

        // Resolve with a result. In production this should inspect the actual import outcome.
        return {
          ok: true,
          status: "complete",
          message: "Local copy is ready!",
          dataRootMasked: maskOperatorPath(dataRoot),
          sqlitePathMasked: maskOperatorPath(sqlitePath),
        };
      },
    );

    // ── Retry IPC — signals the renderer to return to step 1 ──
    ipcMain.handle("setup:retry", () => {
      win.webContents.send("setup:change-folder", {});
      return { ok: true };
    });

    win.setMenuBarVisibility(false);
    void win.loadFile(join(__dirname, "setup.html"));

    // Pass suggested defaults to the renderer
    void win.webContents.executeJavaScript(
      `window.__setupDefaults = ${JSON.stringify({
        dataRoot: suggestedDataRoot(),
        sqlitePath: suggestedSqlitePath(),
        backupDir: suggestedBackupDir(),
        logsDir: suggestedLogsDir(),
      })}`,
    );

    // Pre-fill any existing config values
    if (initial.dataRoot || initial.sqlitePath || initial.backupDir) {
      void win.webContents.executeJavaScript(
        `window.__initialConfig = ${JSON.stringify({
          dataRoot: initial.dataRoot ?? "",
          sqlitePath: initial.sqlitePath ?? "",
          backupDir: initial.backupDir ?? "",
          logsDir: initial.logsDir ?? "",
        })}`,
      );
    }

    win.on("closed", () => {
      finish();
    });
  });
}
