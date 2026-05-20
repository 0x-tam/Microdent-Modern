import path from "node:path";

const SANDBOX_MARKER_BASE = ["microdent", "write", "sandbox"].join("-");

/** Marker basename at the root of `DATA_ROOT`. */
export const WRITE_SANDBOX_MARKER = `.${SANDBOX_MARKER_BASE}.json`;

const PRODUCTION_LEGACY_DIR = ["Microdent", "Legacy"].join("-");
const LEGACY_REFERENCE_COPY_DIR = [PRODUCTION_LEGACY_DIR, "Copy"].join("-");

function devMachineLegacyRoot(folderName: string): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
  return path.normalize(path.join(home, "Desktop", "Microdent", folderName));
}

/** Production legacy tree — never writable from Modern. */
export const FORBIDDEN_LEGACY_ROOT = devMachineLegacyRoot(PRODUCTION_LEGACY_DIR);

/** Read-only reference copy — never writable from Modern. */
export const FORBIDDEN_LEGACY_COPY_ROOT = devMachineLegacyRoot(LEGACY_REFERENCE_COPY_DIR);

/** Required when `WRITE_MODE=enabled`. */
export const ALLOW_LEGACY_WRITES_ACK = "I_UNDERSTAND_THIS_IS_A_DISPOSABLE_COPY";
