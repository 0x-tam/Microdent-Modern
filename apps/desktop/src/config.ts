import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

export type DesktopConfig = {
  version: 1;
  /** Root folder containing clinic DBF files (Write-Sandbox copy). */
  dataRoot?: string;
  /** Path to the SQLite mirror file for fast search and scheduling. */
  sqlitePath?: string;
  /** Backup folder for clinic data snapshots. */
  backupDir?: string;
  bridgePort?: number;
  /** Packaged default: writes disabled until operator enables sandbox pilot. */
  writeMode?: "disabled" | "dry-run" | "enabled";
};

/** Suggested default dataRoot per platform — shown in setup wizard as a starting point. */
export function suggestedDataRoot(): string {
  const home = homedir();
  switch (platform()) {
    case "win32":
      return "C:\\Microdent\\DATA";
    case "darwin":
      return join(home, "Microdent Data", "DATA");
    default:
      return join(home, "Microdent", "DATA");
  }
}

/** Suggested default sqlitePath per platform. */
export function suggestedSqlitePath(): string {
  const home = homedir();
  switch (platform()) {
    case "win32":
      return "C:\\Microdent\\mirror\\clinic.sqlite";
    case "darwin":
      return join(home, "Microdent Data", "mirror", "clinic.sqlite");
    default:
      return join(home, "Microdent", "mirror", "clinic.sqlite");
  }
}

/** Suggested default backupDir per platform. */
export function suggestedBackupDir(): string {
  const home = homedir();
  switch (platform()) {
    case "win32":
      return "C:\\Microdent\\backups";
    case "darwin":
      return join(home, "Microdent Data", "backups");
    default:
      return join(home, "Microdent", "backups");
  }
}

/** True when first-run setup must collect DATA_ROOT and SQLITE_PATH. */
export function desktopConfigNeedsSetup(config: DesktopConfig): boolean {
  return !config.dataRoot?.trim() || !config.sqlitePath?.trim();
}

/** Operator config directory (Windows %AppData%, macOS Application Support, Linux XDG). */
export function desktopConfigDir(): string {
  const home = homedir();
  switch (platform()) {
    case "win32":
      return join(home, "AppData", "Microdent");
    case "darwin":
      return join(home, "Library", "Application Support", "Microdent");
    default:
      return join(home, ".config", "microdent");
  }
}

export function configPath(): string {
  return join(desktopConfigDir(), "config.json");
}

export function defaultDesktopConfig(): DesktopConfig {
  return {
    version: 1,
    bridgePort: 17890,
    writeMode: "disabled",
  };
}

export function loadDesktopConfig(): DesktopConfig {
  const path = configPath();
  if (!existsSync(path)) {
    return defaultDesktopConfig();
  }
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as DesktopConfig;
    return { ...defaultDesktopConfig(), ...raw, version: 1 };
  } catch {
    return defaultDesktopConfig();
  }
}

export function saveDesktopConfig(config: DesktopConfig): void {
  const dir = desktopConfigDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(configPath(), `${JSON.stringify(config, null, 2)}\n`, "utf8");
}
