import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import {
  ALLOW_LEGACY_WRITES_ACK,
  FORBIDDEN_LEGACY_COPY_ROOT,
  FORBIDDEN_LEGACY_ROOT,
  WRITE_SANDBOX_MARKER,
} from "./constants.js";

export type WriteModeForSandbox = "dry-run" | "enabled";

export type ValidateWritableSandboxInput = {
  dataRoot: string;
  writeMode: WriteModeForSandbox | string;
  allowLegacyWritesValue: string | undefined;
};

export type WritableSandboxOk = {
  ok: true;
  dataRoot: string;
  dataRootReal: string;
  writeMode: WriteModeForSandbox;
};

export type WritableSandboxErrorCode =
  | "WRITE_DATA_ROOT_NOT_ABSOLUTE"
  | "WRITE_TARGET_FORBIDDEN_LEGACY"
  | "WRITE_TARGET_FORBIDDEN_LEGACY_COPY"
  | "WRITE_SANDBOX_MARKER_MISSING"
  | "WRITE_SANDBOX_MARKER_INVALID"
  | "WRITE_NOT_ACKNOWLEDGED"
  | "WRITE_MODE_INVALID";

export class WriteSandboxError extends Error {
  readonly code: WritableSandboxErrorCode;

  constructor(code: WritableSandboxErrorCode, message: string) {
    super(message);
    this.name = "WriteSandboxError";
    this.code = code;
  }
}

function isInsideRoot(rootReal: string, candidateReal: string): boolean {
  const rootNorm = path.normalize(rootReal);
  const candNorm = path.normalize(candidateReal);
  if (process.platform === "win32") {
    const r = rootNorm.toLowerCase();
    const c = candNorm.toLowerCase();
    return c === r || c.startsWith(r + path.sep);
  }
  return candNorm === rootNorm || candNorm.startsWith(rootNorm + path.sep);
}

function resolveOnDisk(absolutePath: string): string {
  const normalized = path.normalize(absolutePath);
  if (existsSync(normalized)) {
    return realpathSync.native(normalized);
  }
  return path.resolve(normalized);
}

function assertAbsoluteDataRoot(dataRoot: string): string {
  const trimmed = dataRoot.trim();
  if (!path.isAbsolute(trimmed)) {
    throw new WriteSandboxError(
      "WRITE_DATA_ROOT_NOT_ABSOLUTE",
      "DATA_ROOT must be an absolute path",
    );
  }
  return trimmed;
}

function assertNotForbiddenRoot(dataRootReal: string): void {
  const legacyReal = resolveOnDisk(FORBIDDEN_LEGACY_ROOT);
  if (dataRootReal === legacyReal || isInsideRoot(legacyReal, dataRootReal)) {
    throw new WriteSandboxError(
      "WRITE_TARGET_FORBIDDEN_LEGACY",
      "DATA_ROOT must not point at Microdent-Legacy",
    );
  }

  const copyReal = resolveOnDisk(FORBIDDEN_LEGACY_COPY_ROOT);
  if (dataRootReal === copyReal || isInsideRoot(copyReal, dataRootReal)) {
    throw new WriteSandboxError(
      "WRITE_TARGET_FORBIDDEN_LEGACY_COPY",
      "DATA_ROOT must not point at Microdent-Legacy-Copy",
    );
  }
}

type MarkerPayload = {
  disposable?: unknown;
};

function readSandboxMarker(dataRootReal: string): MarkerPayload {
  const markerPath = path.join(dataRootReal, WRITE_SANDBOX_MARKER);
  if (!existsSync(markerPath)) {
    throw new WriteSandboxError(
      "WRITE_SANDBOX_MARKER_MISSING",
      `Missing ${WRITE_SANDBOX_MARKER} under DATA_ROOT`,
    );
  }

  let raw: string;
  try {
    raw = readFileSync(markerPath, "utf8");
  } catch {
    throw new WriteSandboxError(
      "WRITE_SANDBOX_MARKER_INVALID",
      `Unable to read ${WRITE_SANDBOX_MARKER}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new WriteSandboxError(
      "WRITE_SANDBOX_MARKER_INVALID",
      `${WRITE_SANDBOX_MARKER} is not valid JSON`,
    );
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new WriteSandboxError(
      "WRITE_SANDBOX_MARKER_INVALID",
      `${WRITE_SANDBOX_MARKER} must be a JSON object`,
    );
  }

  return parsed as MarkerPayload;
}

function assertDisposableMarker(dataRootReal: string): void {
  const marker = readSandboxMarker(dataRootReal);
  if (marker.disposable !== true) {
    throw new WriteSandboxError(
      "WRITE_SANDBOX_MARKER_INVALID",
      `${WRITE_SANDBOX_MARKER} must set disposable: true`,
    );
  }
}

function parseWriteMode(writeMode: string): WriteModeForSandbox {
  const normalized = writeMode.trim().toLowerCase();
  if (normalized === "dry-run" || normalized === "enabled") {
    return normalized;
  }
  throw new WriteSandboxError(
    "WRITE_MODE_INVALID",
    `WRITE_MODE must be "dry-run" or "enabled", got: ${JSON.stringify(writeMode)}`,
  );
}

function assertAllowFlagWhenEnabled(
  mode: WriteModeForSandbox,
  allowLegacyWritesValue: string | undefined,
): void {
  if (mode !== "enabled") {
    return;
  }
  if (allowLegacyWritesValue !== ALLOW_LEGACY_WRITES_ACK) {
    throw new WriteSandboxError(
      "WRITE_NOT_ACKNOWLEDGED",
      `ALLOW_LEGACY_WRITES must be exactly ${JSON.stringify(ALLOW_LEGACY_WRITES_ACK)} when WRITE_MODE=enabled`,
    );
  }
}

/**
 * Fail-closed guard for future DBF write routes.
 * Requires a disposable sandbox marker for both dry-run and enabled modes.
 */
export function validateWritableSandbox(input: ValidateWritableSandboxInput): WritableSandboxOk {
  const absolute = assertAbsoluteDataRoot(input.dataRoot);
  const dataRootReal = resolveOnDisk(absolute);
  const writeMode = parseWriteMode(input.writeMode);

  assertNotForbiddenRoot(dataRootReal);
  assertDisposableMarker(dataRootReal);
  assertAllowFlagWhenEnabled(writeMode, input.allowLegacyWritesValue);

  return { ok: true, dataRoot: path.normalize(absolute), dataRootReal, writeMode };
}
