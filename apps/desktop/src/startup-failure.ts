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
  if (/server\.js|bridge.*dist|ENOENT.*bridge|clinic service files.*missing|not built/i.test(raw)) {
    return "Bridge server not built. Run: pnpm --filter @microdent/bridge run build";
  }
  if (/index\.html|web.*dist|ENOENT.*web/i.test(raw)) {
    return "Web UI dist is missing. Run: pnpm build:web";
  }
  if (/EADDRINUSE|17890|address already in use|port.*in use/i.test(raw)) {
    return "Clinic service port is in use. Close other Microdent processes or restart the app.";
  }
  if (/health|timeout|ECONNREFUSED|ETIMEDOUT|mirror unreachable/i.test(raw)) {
    return "Bridge did not respond on loopback (mirror health check timed out). Open Settings when the app loads, or restart after verifying sandbox paths in setup.";
  }
  if (/BACKUP_DIR|backup.*folder|backup.*required/i.test(raw)) {
    if (/write|enabled|required|missing|not set|commits/i.test(raw)) {
      return "Backup folder is required before sandbox commits. Set BACKUP_DIR in setup when write mode is enabled.";
    }
    return "Backup folder missing or invalid. Set BACKUP_DIR in setup before enabling sandbox commits.";
  }
  if (/sandbox|write-sandbox|not.*writable|forbidden.*data_root/i.test(raw)) {
    return "DATA_ROOT did not pass the disposable sandbox guard. Point setup at a Write-Sandbox folder with the marker — never production legacy.";
  }
  if (/WRITE_MODE|write.*blocked|writes.*disabled/i.test(raw)) {
    return "Writes are blocked for this build. Read-only use is safe; enable sandbox pilot only per phase-7 runbook.";
  }
  if (/SQLITE_PATH|sqlite.*missing|sqlite.*not found|ENOENT.*\.sqlite/i.test(raw)) {
    if (/not_file|expected a file|missing|ENOENT|not found/i.test(raw)) {
      return "Mirror SQLite file is missing. Re-open setup and confirm SQLITE_PATH points to an existing file outside the install folder.";
    }
  }
  if (/DATA_ROOT|not_absolute|not_directory|missing path/i.test(raw)) {
    return "Desktop paths are invalid or missing. Re-open setup and verify absolute sandbox folders and files exist.";
  }

  return "Startup failed. See PILOT-START-HERE troubleshooting (bridge, mirror, paths) before retrying.";
}

export const STARTUP_FAILURE_FOOTER =
  "Troubleshooting: docs/PILOT-START-HERE.md. If paths look correct, rebuild bridge and web, then restart.";

/** True when the operator can fix paths via first-run setup (offer re-open setup). */
export function isPathRelatedStartupFailure(message: string): boolean {
  return /setup|paths are invalid|Mirror SQLite|DATA_ROOT|SQLITE|not_absolute|not_directory|not_file|missing path|sandbox paths|Backup folder/i.test(
    message,
  );
}
