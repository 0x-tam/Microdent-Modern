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
    return "Bridge did not respond on loopback. Open Settings when the app loads, or restart after verifying sandbox paths in setup.";
  }
  if (/sandbox|write-sandbox|not.*writable|forbidden.*data_root/i.test(raw)) {
    return "DATA_ROOT did not pass the disposable sandbox guard. Point setup at a Write-Sandbox folder with the marker — never production legacy.";
  }
  if (/WRITE_MODE|write.*blocked|writes.*disabled/i.test(raw)) {
    return "Writes are blocked for this build. Read-only use is safe; enable sandbox pilot only per phase-7 runbook.";
  }
  if (/backup|BACKUP_DIR/i.test(raw)) {
    return "Backup folder missing or invalid. Set BACKUP_DIR in setup before enabling sandbox commits.";
  }
  if (/DATA_ROOT|SQLITE|not_absolute|not_directory|not_file|missing path/i.test(raw)) {
    return "Desktop paths are invalid or missing. Re-open setup and verify absolute sandbox folders and files exist.";
  }

  return "Startup failed. See PILOT-START-HERE troubleshooting (bridge, mirror, paths) before retrying.";
}

export const STARTUP_FAILURE_FOOTER =
  "Troubleshooting: docs/PILOT-START-HERE.md. If paths look correct, rebuild bridge and web, then restart.";

/** True when the operator can fix paths via first-run setup (offer re-open setup). */
export function isPathRelatedStartupFailure(message: string): boolean {
  return /setup|paths are invalid|DATA_ROOT|SQLITE|not_absolute|not_directory|not_file|missing path|sandbox paths/i.test(
    message,
  );
}
