import { BrowserWindow, ipcMain } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  defaultDesktopConfig,
  type DesktopConfig,
} from "../config.js";
import {
  maskOperatorPath,
  validateBackupDir,
  validateDataRootDir,
  validateSqlitePathFile,
} from "../path-validation.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

type SetupSavePayload = {
  dataRoot: string;
  sqlitePath: string;
  backupDir?: string;
};

type SetupSaveResult =
  | { ok: true; summary?: string }
  | { ok: false; message: string };

const VALIDATION_MESSAGES: Record<string, string> = {
  empty: "Path is required.",
  not_absolute: "Use a full absolute path.",
  missing: "Path does not exist.",
  not_directory: "Path must be a folder.",
  not_file: "Path must be a file.",
  mkdir_failed: "Could not create the backup folder.",
};

function validationMessage(code: string, field: string): string {
  const base = VALIDATION_MESSAGES[code] ?? "Invalid path.";
  return `${field}: ${base}`;
}

export function validateSetupPayload(payload: SetupSavePayload): SetupSaveResult | DesktopConfig {
  const dataRoot = validateDataRootDir(payload.dataRoot);
  if (!dataRoot.ok) {
    return { ok: false, message: validationMessage(dataRoot.code, "DATA_ROOT") };
  }

  const sqlitePath = validateSqlitePathFile(payload.sqlitePath);
  if (!sqlitePath.ok) {
    return { ok: false, message: validationMessage(sqlitePath.code, "SQLITE_PATH") };
  }

  let backupDir: string | undefined;
  const backupRaw = payload.backupDir?.trim() ?? "";
  if (backupRaw.length > 0) {
    const backup = validateBackupDir(backupRaw, { createIfMissing: true });
    if (!backup.ok) {
      return { ok: false, message: validationMessage(backup.code, "BACKUP_DIR") };
    }
    backupDir = backup.normalizedPath;
  }

  return {
    ...defaultDesktopConfig(),
    dataRoot: dataRoot.normalizedPath,
    sqlitePath: sqlitePath.normalizedPath,
    backupDir,
    writeMode: "disabled",
  };
}

/**
 * Modal setup window; resolves with saved config or rejects when closed without save.
 */
export function showSetupWindow(initial: DesktopConfig): Promise<DesktopConfig> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (config: DesktopConfig) => {
      if (settled) return;
      settled = true;
      ipcMain.removeHandler("setup:save");
      resolve(config);
    };
    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      ipcMain.removeHandler("setup:save");
      reject(err);
    };

    const win = new BrowserWindow({
      width: 620,
      height: 520,
      resizable: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: join(__dirname, "setup-preload.cjs"),
      },
    });

    ipcMain.handle("setup:save", (_event, payload: SetupSavePayload) => {
      const result = validateSetupPayload(payload);
      if ("ok" in result) {
        return result;
      }
      finish(result);
      win.close();
      return {
        ok: true as const,
        summary: `Saved. Open Settings → Pilot checklist to verify paths. Write mode stays disabled until you change config manually.`,
      };
    });

    win.setMenuBarVisibility(false);
    void win.loadFile(join(__dirname, "setup.html"));

    if (initial.dataRoot) {
      void win.webContents.executeJavaScript(
        `document.getElementById('dataRoot').value = ${JSON.stringify(initial.dataRoot)}`,
      );
    }
    if (initial.sqlitePath) {
      void win.webContents.executeJavaScript(
        `document.getElementById('sqlitePath').value = ${JSON.stringify(initial.sqlitePath)}`,
      );
    }
    if (initial.backupDir) {
      void win.webContents.executeJavaScript(
        `document.getElementById('backupDir').value = ${JSON.stringify(initial.backupDir)}`,
      );
    }

    win.on("closed", () => {
      fail(new Error("Setup window closed before saving configuration"));
    });
  });
}
