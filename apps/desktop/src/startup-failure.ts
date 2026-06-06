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
    return "Clinic service is missing from this build. Rebuild the release package before giving it to a clinic.";
  }
  if (/index\.html|web.*dist|ENOENT.*web/i.test(raw)) {
    return "Clinic workspace is missing from this build. Rebuild the release package before giving it to a clinic.";
  }
  if (/EADDRINUSE|17890|address already in use|port.*in use/i.test(raw)) {
    return "The local clinic service is already running or blocked by another Microdent Modern window. Close other Microdent Modern windows and try again.";
  }
  if (/health|timeout|ECONNREFUSED|ETIMEDOUT|mirror unreachable/i.test(raw)) {
    return "The local clinic service did not start in time. Restart Microdent Modern, then re-open setup if the app asks for clinic folders.";
  }
  if (/BACKUP_DIR|backup.*folder|backup.*required/i.test(raw)) {
    if (/write|enabled|required|missing|not set|commits/i.test(raw)) {
      return "Backup folder is required before sandbox edits. Choose a backup folder in setup before enabling edits.";
    }
    return "Backup folder missing or invalid. Choose a backup folder in setup before enabling sandbox edits.";
  }
  if (/sandbox|write-sandbox|not.*writable|forbidden.*data_root/i.test(raw)) {
    return "The selected clinic data folder is not a safe disposable sandbox copy. Choose a sandbox copy, never the live legacy folder.";
  }
  if (/WRITE_MODE|write.*blocked|writes.*disabled/i.test(raw)) {
    return "Writes are blocked for this build. Read-only use is safe; enable sandbox pilot only per phase-7 runbook.";
  }
  if (/SQLITE_PATH|sqlite.*missing|sqlite.*not found|ENOENT.*\.sqlite/i.test(raw)) {
    if (/not_file|expected a file|missing|ENOENT|not found/i.test(raw)) {
      return "The fast local copy is missing. Re-open setup and let Microdent Modern create or select the local copy outside the install folder.";
    }
  }
  if (/DATA_ROOT|not_absolute|not_directory|missing path/i.test(raw)) {
    return "Clinic folders are invalid or missing. Re-open setup and choose the clinic data, local copy, and backup locations.";
  }

  return "Startup failed. See PILOT-START-HERE troubleshooting before retrying.";
}

export const STARTUP_FAILURE_FOOTER =
  "Troubleshooting: docs/PILOT-START-HERE.md. If setup looks correct, rebuild the release package, then restart.";

/** True when the operator can fix paths via first-run setup (offer re-open setup). */
export function isPathRelatedStartupFailure(message: string): boolean {
  return /setup|paths are invalid|Mirror SQLite|DATA_ROOT|SQLITE|not_absolute|not_directory|not_file|missing path|sandbox paths|Backup folder/i.test(
    message,
  );
}
