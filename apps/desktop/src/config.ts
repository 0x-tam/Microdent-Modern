import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

export type DesktopConfig = {
  version: 1;
  dataRoot?: string;
  sqlitePath?: string;
  bridgePort?: number;
  /** Packaged default: writes disabled until operator enables sandbox pilot. */
  writeMode?: "disabled" | "dry-run" | "enabled";
};

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
