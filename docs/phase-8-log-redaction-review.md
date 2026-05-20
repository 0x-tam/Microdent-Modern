# Phase 8 — Log redaction review

**Date:** 2026-05-21 (distribution RC sweep)  
**Scope:** Bridge, mirror import CLI, desktop supervisor, QA scripts, staged pilot artifacts.

## Rules (unchanged)

- No raw DBF/SQLite row payloads in logs or HTTP bodies
- No full phone, address, email, insurance, medical text, payment amounts, memos, or schedule `COMMENT` / `PAT_NAME` / `TELEPHONE`
- No before/after values in `SafeWritePlan` or `write_audit` detail JSON
- Validation failures must not echo sensitive field contents
- No full absolute `DATA_ROOT`, `BACKUP_DIR`, `SQLITE_PATH`, or timestamped backup folder paths in CLI `console.log` / `console.error` output (basename / `operationId` / error **code** only)
- No `process.env` dumps; no request body logging on write routes
- Desktop and bridge child processes must not forward stdout/stderr containing operator paths to the console

## Reviewed areas

| Area | Finding |
| --- | --- |
| Write commit handlers | Error messages are generic codes only |
| Backup manifest CLI | Filename/size/sha256 only; fixture tests assert no secret tokens in manifest |
| Backup CLI report (`printLegacyBackupReport`) | Logs `operationId`, workflow, file count, timestamped folder **basename**, and member basenames — not parent `BACKUP_DIR` or `DATA_ROOT` paths |
| Restore CLI report (`printLegacyRestoreReport`) | Same basename-only policy as backup — `backupFolder` and `dataRoot` basenames only |
| Restore CLI errors | `WriteSandboxError` logged as **code** only (not message) |
| Write audit meta (`GET /v1/meta/write-audit-recent`) | When `SQLITE_PATH` is set: `operationId`, `workflow`, `terminalStatus`, `requestedAt`, `finishedAt` only — no `target_record_ids`, actor fields, or step `detail_json` |
| Mirror import CLI (`printMirrorImportSafeReport`) | Table names, row counts, and status only — no `import_errors.message` or filesystem paths |
| Schedule write validation | Overlap/conflict paths do not log `TIME` raw values on failure |
| Patient demographics write | Profile re-read uses safe DTO; phone columns never logged |
| Rate limit middleware | Returns `RATE_LIMITED` without request body |
| Bridge `server.ts` startup | Logs listen host/port and `writeMode` only; startup failures log `err.message` (no stack / no path echo) |
| Bridge env parse (`config.ts`, `mirror-env.ts`) | Relative-path errors are generic — no `got: "…"` path echo |
| Writable sandbox guard | `WRITE_DATA_ROOT_NOT_ABSOLUTE` message has no path echo |
| Desktop `main.ts` | Post-setup log uses `maskOperatorPath` for data/sqlite hints |
| Desktop `bridge-supervisor.ts` | Spawns `[node, bridgeEntry]` only; child stdout/stderr discarded (health via HTTP) |
| QA scripts (`qa-sandbox-run.sh`, `qa-sandbox-write-smoke.sh`) | Logs workflows, HTTP codes, operation IDs, hash prefixes, backup basenames — not env or bodies |
| QA write-smoke chart readback failure | Failure line omits chart number value |
| Staging / verify scripts | Counts and relative artifact names only |

## Distribution RC artifact safety (staged tree)

Enforced by `scripts/stage-pilot-release.mjs` and `scripts/verify-pilot-release.mjs`:

| Must never appear in `dist/pilot-release/MicrodentModern/` | Notes |
| --- | --- |
| Clinic **DATA** / DBF trees (except bridge test `fake_tiny.dbf` in source build only) | `SCHEDULE.DBF` explicitly rejected |
| `.sqlite` / `.sqlite3` mirror files | Operator provides on disk |
| `backups/` runtime data | Placeholder `README.txt` only |
| `logs/` runtime data | Placeholder `README.txt` only |
| `.env` / secrets | Filtered at copy + post-scan |
| `.log` files | Filtered at copy + post-scan |
| `Microdent-Legacy`, `Write-Sandbox`, `Legacy-Copy` path segments | Source and staged scan |
| Developer home / repo checkout paths in templates | `assertConfigTemplateSafe` |

Staged logging: file/dir **counts** only — no absolute paths, no PHI.

See [windows-pilot-release-layout.md](./windows-pilot-release-layout.md) for the full layout.

## Forbidden log patterns (grep targets)

- `SYNTHETIC_*` fixture tokens in CLI or HTTP output
- Schedule/patient field names used as payload carriers: `PAT_NAME`, `TELEPHONE`, `COMMENT`, `CASENUM`
- Full absolute backup paths: prefer `backupFolder: <timestamp>__<workflow>__<id>` basename, not `backupDir: /…/…`
- Raw DBF row bodies, `before`/`after` in write plans, `rawRow` dumps
- `got: ${JSON.stringify(...)}` or `Got: ${DATA_ROOT}` in shell/CLI output
- Real developer machine paths in CLI `--help` examples (use `/absolute/path/to/…` placeholders)

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

## Deferred (acceptable / follow-up)

- CLI usage examples with **placeholder** paths (`/absolute/path/to/…`) — intentional operator docs, not live values
- `qa-sandbox-readback` **stdout** (not stderr): numeric status, slot, or chart for automation — callers must treat stdout as sensitive in real clinics
- `qa-sandbox-preflight` missing-artifact lines include repo-relative `services/bridge/dist/…` (build machine only)
- `@microdent/bridge-client` schema mismatch warn (dev/test only; keys/counts, no row values)
- Structured JSON logging with explicit allowlist fields
- Periodic grep CI for forbidden tokens in `services/bridge/src` log strings
