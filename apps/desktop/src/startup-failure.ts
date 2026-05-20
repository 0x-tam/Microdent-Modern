/** Map startup errors to operator-facing actions (no paths or PHI). */
export function formatStartupFailure(err: unknown): string {
  const raw =
    err instanceof Error ? err.message.trim() : String(err ?? "").trim();
  if (raw.length === 0) {
    return "Unknown startup error.";
  }

  if (/setup window closed/i.test(raw)) {
    return "Setup was closed before paths were saved. Restart the desktop app and complete first-run setup.";
  }
  if (/server\.js|bridge.*dist|ENOENT.*bridge/i.test(raw)) {
    return "Bridge server not built. Run: pnpm --filter @microdent/bridge run build";
  }
  if (/index\.html|web.*dist|ENOENT.*web/i.test(raw)) {
    return "Web UI dist is missing. Run: pnpm build:web";
  }
  if (/EADDRINUSE|17890|address already in use/i.test(raw)) {
    return "Bridge port 17890 is in use. Close other Microdent bridge processes or change bridgePort in desktop config.";
  }
  if (/health|timeout|ECONNREFUSED|ETIMEDOUT/i.test(raw)) {
    return "Bridge did not respond on loopback. Check sandbox paths in setup and rebuild the bridge.";
  }
  if (/DATA_ROOT|SQLITE|not_absolute|not_directory|not_file|missing path/i.test(raw)) {
    return "Desktop paths are invalid or missing. Re-open setup and verify absolute sandbox folders and files exist.";
  }

  return raw;
}

export const STARTUP_FAILURE_FOOTER =
  "If paths look correct: rebuild bridge (pnpm --filter @microdent/bridge run build) and web (pnpm build:web), then restart.";
