# Phase 8 — Log redaction review

**Date:** 2026-05-17  
**Scope:** Bridge, mirror import CLI, desktop supervisor, write/audit paths.

## Rules (unchanged)

- No raw DBF/SQLite row payloads in logs or HTTP bodies
- No full phone, address, email, insurance, medical text, payment amounts, memos, or schedule `COMMENT` / `PAT_NAME` / `TELEPHONE`
- No before/after values in `SafeWritePlan` or `write_audit` detail JSON
- Validation failures must not echo sensitive field contents
- No full absolute `DATA_ROOT`, `BACKUP_DIR`, or timestamped backup folder paths in CLI `console.log` output (basename / `operationId` only)

## Reviewed areas

| Area | Finding |
| --- | --- |
| Write commit handlers | Error messages are generic codes only |
| Backup manifest CLI | Filename/size/sha256 only; fixture tests assert no secret tokens in manifest |
| Backup CLI report (`printLegacyBackupReport`) | Logs `operationId`, workflow, file count, timestamped folder **basename**, and member basenames — not parent `BACKUP_DIR` or `DATA_ROOT` paths |
| Restore CLI report (`printLegacyRestoreReport`) | Same basename-only policy as backup — `backupFolder` and `dataRoot` basenames only |
| Write audit meta (`GET /v1/meta/write-audit-recent`) | When `SQLITE_PATH` is set: `operationId`, `workflow`, `terminalStatus`, `requestedAt`, `finishedAt` only — no `target_record_ids`, actor fields, or step `detail_json` |
| Mirror import CLI (`printMirrorImportSafeReport`) | Table names, row counts, and status only — no `import_errors.message` or filesystem paths |
| Schedule write validation | Overlap/conflict paths do not log `TIME` raw values on failure |
| Patient demographics write | Profile re-read uses safe DTO; phone columns never logged |
| Rate limit middleware | Returns `RATE_LIMITED` without request body |
| Desktop supervisor | Logs health status and exit codes only |

## Forbidden log patterns (grep targets)

- `SYNTHETIC_*` fixture tokens in CLI or HTTP output
- Schedule/patient field names used as payload carriers: `PAT_NAME`, `TELEPHONE`, `COMMENT`, `CASENUM`
- Full absolute backup paths: prefer `backupFolder: <timestamp>__<workflow>__<id>` basename, not `backupDir: /…/…`
- Raw DBF row bodies, `before`/`after` in write plans, `rawRow` dumps

## Sandbox validation (operator / CI)

Run the synthetic write-validation band (temp `DATA_ROOT` only — never Legacy or Legacy-Copy):

```bash
pnpm sandbox:validate
```

Equivalent:

```bash
pnpm --filter @microdent/bridge exec vitest run src/sandbox/sandbox-validation-band.test.ts
```

See [phase-3-sandbox-validation.md](./phase-3-sandbox-validation.md) for prerequisites and optional real-write sub-suite (`SANDBOX_VALIDATE_REAL=1`).

## Follow-ups (not blocking pilot)

- Structured JSON logging with explicit allowlist fields
- Periodic grep CI for forbidden tokens in `services/bridge/src` log strings
