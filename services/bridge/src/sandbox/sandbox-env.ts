import path from "node:path";
import {
  assertNotForbiddenLegacyCopyPath,
  assertNotForbiddenLegacyPath,
} from "../backup/forbidden-path.js";
import { parseDataRootFromValue } from "../config.js";

export type SandboxEnv = {
  sourceDataRoot: string;
  sourceDataRootRealpath: string;
  sandboxRoot: string;
  sandboxRootRealpath: string;
  sandboxDataRoot: string;
};

export type SandboxEnvLoadResult =
  | { ok: true; env: SandboxEnv }
  | { ok: false; missing: ("SOURCE_DATA_ROOT" | "SANDBOX_ROOT")[] };

function parseAbsoluteDir(value: string | undefined, label: string): string | null {
  if (value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }
  if (!path.isAbsolute(trimmed)) {
    throw new Error(`${label} must be an absolute path`);
  }
  return path.normalize(trimmed);
}

export function loadSandboxEnvFromProcess(): SandboxEnvLoadResult {
  const missing: ("SOURCE_DATA_ROOT" | "SANDBOX_ROOT")[] = [];

  let sourceConfig;
  try {
    sourceConfig = parseDataRootFromValue(process.env.SOURCE_DATA_ROOT);
  } catch {
    throw new Error("SOURCE_DATA_ROOT must be an absolute path");
  }
  if (!sourceConfig.configured) {
    missing.push("SOURCE_DATA_ROOT");
  }

  let sandboxRoot: string | null;
  try {
    sandboxRoot = parseAbsoluteDir(process.env.SANDBOX_ROOT, "SANDBOX_ROOT");
  } catch {
    throw new Error("SANDBOX_ROOT must be an absolute path");
  }
  if (!sandboxRoot) {
    missing.push("SANDBOX_ROOT");
  }

  if (missing.length > 0) {
    return { ok: false, missing };
  }

  const sourceDataRoot = (sourceConfig as { configured: true; path: string }).path;
  const sourceDataRootRealpath = (sourceConfig as { configured: true; realPath: string }).realPath;
  const sandboxRootRealpath = path.resolve(sandboxRoot!);

  assertNotForbiddenLegacyPath(sourceDataRootRealpath, "SOURCE_DATA_ROOT");
  assertNotForbiddenLegacyPath(sandboxRoot!, "SANDBOX_ROOT");
  assertNotForbiddenLegacyCopyPath(sandboxRoot!, "SANDBOX_ROOT");

  return {
    ok: true,
    env: {
      sourceDataRoot,
      sourceDataRootRealpath,
      sandboxRoot: sandboxRoot!,
      sandboxRootRealpath,
      sandboxDataRoot: path.join(sandboxRoot!, "DATA"),
    },
  };
}
