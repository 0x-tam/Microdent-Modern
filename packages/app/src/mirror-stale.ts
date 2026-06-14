import type { MirrorStatusResponse } from "@microdent/contracts";
import type { BridgeHealthPhase } from "./bridge-health.js";

/** Default age after which mirror import metadata is treated as stale (48 hours). */
export const MIRROR_IMPORT_STALE_MS = 48 * 60 * 60 * 1000;

function parseFinishedAtMs(finishedAt: string): number | null {
  const ms = Date.parse(finishedAt);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Latest `finishedAt` across per-table import summaries (metadata only).
 */
export function newestMirrorImportFinishedAtMs(
  latestImportRuns: MirrorStatusResponse["latestImportRuns"],
): number | null {
  let newest: number | null = null;
  for (const run of latestImportRuns) {
    const ms = parseFinishedAtMs(run.finishedAt);
    if (ms === null) continue;
    if (newest === null || ms > newest) newest = ms;
  }
  return newest;
}

/**
 * True when SQLite mirror is in use but import audit shows the last successful run is older than policy.
 */
export function isMirrorImportStale(
  status: MirrorStatusResponse,
  nowMs: number,
  staleMs: number = MIRROR_IMPORT_STALE_MS,
): boolean {
  if (!status.sqliteUsable || status.latestImportRuns.length === 0) {
    return false;
  }
  if (status.sourceChangedSinceImport) {
    return true;
  }
  const newest = newestMirrorImportFinishedAtMs(status.latestImportRuns);
  if (newest === null) return false;
  return nowMs - newest > staleMs;
}

export type MirrorStaleBannerCopy = {
  label: string;
  body: string;
};

/**
 * Non-blocking banner copy when mirror imports are stale; null when not applicable.
 * Uses `GET /v1/mirror/status` metadata only (no `import_errors` text).
 */
export function resolveMirrorStaleBanner(
  phase: BridgeHealthPhase,
  status: MirrorStatusResponse | null,
  copy: MirrorStaleBannerCopy,
  nowMs: number = Date.now(),
  staleMs: number = MIRROR_IMPORT_STALE_MS,
): MirrorStaleBannerCopy | null {
  if (phase !== "connected" || status === null) return null;
  if (!isMirrorImportStale(status, nowMs, staleMs)) return null;
  return copy;
}
