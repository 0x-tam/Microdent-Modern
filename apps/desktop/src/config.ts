import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type DesktopConfig = {
  version: 1;
  dataRoot?: string;
  sqlitePath?: string;
  bridgePort?: number;
  /** Packaged default: writes disabled until operator enables sandbox pilot. */
  writeMode?: "disabled" | "dry-run" | "enabled";
};

const CONFIG_DIR = join(homedir(), "AppData", "Microdent");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

export function defaultDesktopConfig(): DesktopConfig {
  return {
    version: 1,
    bridgePort: 17890,
    writeMode: "disabled",
  };
}

export function loadDesktopConfig(): DesktopConfig {
  if (!existsSync(CONFIG_PATH)) {
    return defaultDesktopConfig();
  }
  try {
    const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as DesktopConfig;
    return { ...defaultDesktopConfig(), ...raw, version: 1 };
  } catch {
    return defaultDesktopConfig();
  }
}

export function saveDesktopConfig(config: DesktopConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export function configPath(): string {
  return CONFIG_PATH;
}
