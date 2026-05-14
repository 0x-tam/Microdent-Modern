import { existsSync, realpathSync } from "node:fs";
import path from "node:path";

export type DataRootUnset = { configured: false };
export type DataRootSet = {
  configured: true;
  /** Normalized absolute path from env (may differ from realPath on disk). */
  path: string;
  /** Directory realpath used for sandbox prefix checks (`realpathSync` when the path exists). */
  realPath: string;
};

export type DataRootConfig = DataRootUnset | DataRootSet;

export type BridgeConfig = {
  listen: { host: string; port: number };
  dataRoot: DataRootConfig;
};

/**
 * Parse `DATA_ROOT` from a string value (use `process.env.DATA_ROOT` in production).
 * Empty / whitespace means not configured. When set, the path must be absolute.
 */
export function parseDataRootFromValue(value: string | undefined): DataRootConfig {
  if (value === undefined) {
    return { configured: false };
  }
  const trimmed = value.trim();
  if (trimmed === "") {
    return { configured: false };
  }
  if (!path.isAbsolute(trimmed)) {
    throw new Error(`DATA_ROOT must be an absolute path, got: ${JSON.stringify(trimmed)}`);
  }
  const normalized = path.normalize(trimmed);
  let realPath: string;
  if (existsSync(normalized)) {
    realPath = realpathSync.native(normalized);
  } else {
    realPath = path.resolve(normalized);
  }
  return { configured: true, path: normalized, realPath };
}

export function loadDataRootFromEnv(): DataRootConfig {
  return parseDataRootFromValue(process.env.DATA_ROOT);
}

export function loadListenOptions(): { host: string; port: number } {
  const host = process.env.BRIDGE_HOST ?? "127.0.0.1";
  const raw = process.env.BRIDGE_PORT ?? "17890";
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid BRIDGE_PORT: ${raw}`);
  }
  return { host, port };
}

export function loadBridgeConfig(): BridgeConfig {
  return {
    listen: loadListenOptions(),
    dataRoot: loadDataRootFromEnv(),
  };
}
