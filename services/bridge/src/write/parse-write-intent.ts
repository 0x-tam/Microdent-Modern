/** Per-request override from `X-Write-Intent` (see phase-3 dry-run write plan). */
export type WriteIntent = "dry-run" | "commit";

/**
 * Parse `X-Write-Intent`. Omitted or unrecognized values default to `commit` on an enabled bridge.
 */
export function parseWriteIntentHeader(value: string | string[] | undefined): WriteIntent {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw.trim() === "") {
    return "commit";
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === "dry-run" || normalized === "dry_run") {
    return "dry-run";
  }
  return "commit";
}
