import { join } from "node:path";
import { configPath, desktopConfigDir } from "./config.js";

/** Synthetic Windows sandbox examples — placeholders only, never real clinic paths. */
export const WINDOWS_SANDBOX_EXAMPLES = {
  dataRoot: "C:\\ClinicData\\Microdent\\DATA",
  sqlitePath: "C:\\Users\\Public\\MicrodentModern\\mirror\\clinic.sqlite",
  backupDir: "C:\\Users\\Public\\MicrodentModern\\backups",
} as const;

export type DataLocationLayer = "install" | "appData" | "clinic";

export type OperatorDataLocationSpec = {
  id: string;
  layer: DataLocationLayer;
  label: string;
  windowsPathHint: string;
  createdBy: "it" | "desktop-first-save" | "operator-setup";
  shippedInPackage: boolean;
  mustStayOutsideInstall: boolean;
  containsClinicData: boolean;
  notes: string;
};

/**
 * Canonical operator data-location categories for docs, setup copy, and tests.
 * Does not create directories or read clinic paths from disk.
 */
export function resolveOperatorDataLocations(): OperatorDataLocationSpec[] {
  return [
    {
      id: "install",
      layer: "install",
      label: "App install / staged package",
      windowsPathHint: "C:\\Microdent\\MicrodentModern\\",
      createdBy: "it",
      shippedInPackage: true,
      mustStayOutsideInstall: false,
      containsClinicData: false,
      notes:
        "Electron shell, bridge JS, web dist, config templates. Never DATA_ROOT, mirror SQLite, backups, or logs.",
    },
    {
      id: "desktopConfig",
      layer: "appData",
      label: "Desktop config",
      windowsPathHint: "%AppData%\\Microdent\\config.json",
      createdBy: "desktop-first-save",
      shippedInPackage: false,
      mustStayOutsideInstall: true,
      containsClinicData: false,
      notes: "Operator path pointers only (dataRoot, sqlitePath, backupDir, writeMode, bridgePort).",
    },
    {
      id: "dataRoot",
      layer: "clinic",
      label: "DATA_ROOT",
      windowsPathHint: WINDOWS_SANDBOX_EXAMPLES.dataRoot,
      createdBy: "operator-setup",
      shippedInPackage: false,
      mustStayOutsideInstall: true,
      containsClinicData: true,
      notes: "Disposable Write-Sandbox DBF tree. Never live Microdent-Legacy.",
    },
    {
      id: "sqlitePath",
      layer: "clinic",
      label: "SQLITE_PATH",
      windowsPathHint: WINDOWS_SANDBOX_EXAMPLES.sqlitePath,
      createdBy: "operator-setup",
      shippedInPackage: false,
      mustStayOutsideInstall: true,
      containsClinicData: true,
      notes: "Mirror snapshot for search/schedule. Refresh via CLI after sandbox writes.",
    },
    {
      id: "backupDir",
      layer: "clinic",
      label: "BACKUP_DIR",
      windowsPathHint: WINDOWS_SANDBOX_EXAMPLES.backupDir,
      createdBy: "operator-setup",
      shippedInPackage: false,
      mustStayOutsideInstall: true,
      containsClinicData: true,
      notes: "Required before sandbox commits. Store outside install folder.",
    },
    {
      id: "logs",
      layer: "appData",
      label: "Operator logs (documented convention)",
      windowsPathHint: "%AppData%\\Microdent\\logs\\",
      createdBy: "operator-setup",
      shippedInPackage: false,
      mustStayOutsideInstall: true,
      containsClinicData: false,
      notes:
        "Pilot RC documents this folder; desktop does not auto-create it. Bridge stdout/stderr goes to the launch terminal.",
    },
    {
      id: "qaReports",
      layer: "install",
      label: "QA reports (developers only)",
      windowsPathHint: "repo qa-runs/ (not on clinic machines)",
      createdBy: "it",
      shippedInPackage: false,
      mustStayOutsideInstall: true,
      containsClinicData: false,
      notes:
        "Dev/CI checkpoint logs live in qa-runs/. Operators file tickets via PILOT-START-HERE template — no PHI attachments.",
    },
  ];
}

/** Documented log folder — convention only; no runtime mkdir in pilot RC. */
export function recommendedOperatorLogDir(): string {
  return join(desktopConfigDir(), "logs");
}

export function operatorConfigFilePath(): string {
  return configPath();
}

/** Heuristic for setup validation hints: true when candidate is under install root. */
export function pathLooksInsideInstallDir(candidatePath: string, installDir: string): boolean {
  const normalize = (value: string) =>
    value
      .trim()
      .replace(/\\/g, "/")
      .replace(/\/+$/, "")
      .toLowerCase();
  const candidate = normalize(candidatePath);
  const install = normalize(installDir);
  if (candidate.length === 0 || install.length === 0) return false;
  return candidate === install || candidate.startsWith(`${install}/`);
}
