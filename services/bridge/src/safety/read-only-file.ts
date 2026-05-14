import { constants } from "node:fs";
import { open } from "node:fs/promises";

/**
 * Open an existing file read-only (`O_RDONLY`). Does not create files or directories.
 */
export async function openFileReadOnly(absolutePath: string) {
  return open(absolutePath, constants.O_RDONLY);
}
