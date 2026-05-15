import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { WRITE_SANDBOX_MARKER } from "../write-safety/constants.js";

/** Synthetic disposable sandbox marker for bridge write tests. */
export function writeSandboxMarker(dataRoot: string): void {
  writeFileSync(
    join(dataRoot, WRITE_SANDBOX_MARKER),
    `${JSON.stringify({ disposable: true })}\n`,
    "utf8",
  );
}
