import { WriteSandboxError } from "../write-safety/index.js";

export function httpStatusForWriteSandboxError(code: WriteSandboxError["code"]): number {
  switch (code) {
    case "WRITE_DATA_ROOT_NOT_ABSOLUTE":
    case "WRITE_MODE_INVALID":
      return 500;
    default:
      return 403;
  }
}
