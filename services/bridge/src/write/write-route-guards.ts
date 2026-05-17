import type { Response } from "express";
import type { BridgeConfig, DataRootSet } from "../config.js";
import { validateWritableSandbox, WriteSandboxError } from "../write-safety/index.js";
import { httpStatusForWriteSandboxError } from "./map-write-sandbox-error.js";
import { ApiErrorBodySchema } from "@microdent/contracts";

export function sendWriteModeDisabled(res: Response): void {
  sendWriteError(res, 403, "WRITE_MODE_DISABLED", "WRITE_MODE is disabled");
}

export function sendWriteError(res: Response, status: number, code: string, message: string): void {
  const body = { error: { code, message } };
  ApiErrorBodySchema.parse(body);
  res.status(status).json(body);
}

export function tryValidateWritableSandbox(
  res: Response,
  input: {
    dataRoot: DataRootSet;
    writeMode: "dry-run" | "enabled";
    allowLegacyWritesValue: string | undefined;
  },
): boolean {
  try {
    validateWritableSandbox({
      dataRoot: input.dataRoot.path,
      writeMode: input.writeMode,
      allowLegacyWritesValue: input.allowLegacyWritesValue,
    });
    return true;
  } catch (err) {
    if (err instanceof WriteSandboxError) {
      const body = { error: { code: err.code, message: err.message } };
      ApiErrorBodySchema.parse(body);
      res.status(httpStatusForWriteSandboxError(err.code)).json(body);
      return false;
    }
    throw err;
  }
}

export function ensureBackupConfigured(res: Response, bridgeConfig: BridgeConfig): boolean {
  if (!bridgeConfig.backupDir.configured) {
    sendWriteError(res, 503, "WRITE_BACKUP_NOT_CONFIGURED", "BACKUP_DIR is not configured");
    return false;
  }
  return true;
}
