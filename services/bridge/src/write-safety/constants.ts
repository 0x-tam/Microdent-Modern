import path from "node:path";

/** Marker basename at the root of `DATA_ROOT`. */
export const WRITE_SANDBOX_MARKER = ".microdent-write-sandbox.json";

/** Production legacy tree — never writable from Modern. */
export const FORBIDDEN_LEGACY_ROOT = path.normalize(
  "/Users/Tamam/Desktop/Microdent/Microdent-Legacy",
);

/** Read-only reference copy — never writable from Modern. */
export const FORBIDDEN_LEGACY_COPY_ROOT = path.normalize(
  "/Users/Tamam/Desktop/Microdent/Microdent-Legacy-Copy",
);

/** Required when `WRITE_MODE=enabled`. */
export const ALLOW_LEGACY_WRITES_ACK = "I_UNDERSTAND_THIS_IS_A_DISPOSABLE_COPY";
