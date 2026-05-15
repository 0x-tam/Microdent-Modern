# Phase 3 — Write-safe QA checklist

**Purpose:** Operator and engineer pre-flight checklist **before any real DBF mutation**. Confirms dry-run posture, backup, audit, sandbox guards, and restore rehearsal on **disposable** data only.

**Status:** Foundation band — backup CLI, write-safety guard, write-mode config, and SQLite audit utilities exist; **mutation routes and `SafeWritePlan` HTTP responses are not shipped yet**. Sections marked **(future)** apply once write routes land; sections marked **(today)** can be executed now.

**Related:** [phase-3-disposable-write-sandbox.md](./phase-3-disposable-write-sandbox.md), [phase-3-sandbox-guard.md](./phase-3-sandbox-guard.md), [phase-3-write-mode-config.md](./phase-3-write-mode-config.md), [phase-3-backup-cli.md](./phase-3-backup-cli.md), [phase-3-dry-run-write-plan.md](./phase-3-dry-run-write-plan.md), [phase-3-audit-log-schema.md](./phase-3-audit-log-schema.md), [phase-3-backup-restore-plan.md](./phase-3-backup-restore-plan.md).

---

## Hard rules (every run)

| Rule | Requirement |
| --- | --- |
| **Never touch** | `/Users/Tamam/Desktop/Microdent/Microdent-Legacy` — no reads for write QA, no copies from production for mutation tests |
| **Read-only reference** | `/Users/Tamam/Desktop/Microdent/Microdent-Legacy-Copy` — reference and sandbox **source** only; never set `DATA_ROOT` here for write or backup rehearsal when avoidable |
| **Writable target** | `/Users/Tamam/Desktop/Microdent/Microdent-Write-Sandbox/DATA` (or a temp dir with the same marker contract) |
| **Repo boundary** | All commands run from `/Users/Tamam/Desktop/Microdent/Microdent-Modern` |
| **Privacy** | Do not paste patient names, phones, appointment comment text, chart numbers, raw DBF rows, or full API/audit JSON into tickets or chat. Record **pass/fail**, error **codes**, and **operationId** only |

---

## Before you start

| Item | Requirement |
| --- | --- |
| **Node 22** | **Node ≥ 22.5.0** for SQLite mirror audit migration/tests and full monorepo `pnpm test` (see §1). Bridge-only smoke can use Node 18+, but this checklist assumes **22.5+** end-to-end |
| **pnpm** | `pnpm@9.15.0` per root `packageManager` |
| **Legacy FoxPro** | Closed — no EXE holding DBF locks on the sandbox `DATA` tree |
| **Sign-off owner** | Named operator + reviewer before any `WRITE_MODE=enabled` pilot |

---

## 1. Node 22 setup **(today)**

| Step | Action | Pass |
| --- | --- | --- |
| 1.1 | Install Node **22.5+** (nvm, fnm, or official installer) | `node -v` reports `v22.5` or higher |
| 1.2 | From repo root: `corepack enable` (if needed), `pnpm install` | Install completes without engine errors |
| 1.3 | `node -e "const v=process.version.slice(1).split('.').map(Number); process.exit(v[0]>22||(v[0]===22&&v[1]>=5)?0:1)"` | Exit code **0** |
| 1.4 | (Optional) `pnpm test` at repo root | All workspace tests green on Node 22.5+ |

**Fail:** Run bridge-only checks on Node 18 only if SQLite audit sections (§10) are deferred — document that gap in sign-off.

---

## 2. Clean port startup **(today)**

Run from repo root.

| Step | Action | Pass |
| --- | --- | --- |
| 2.1 | `pnpm dev:kill-ports` | Completes without error |
| 2.2 | `pnpm dev:ports` | Ports **17890**, **5173**, and **4173** show nothing listening (or only processes you intend to replace) |
| 2.3 | Export sandbox `DATA_ROOT` (absolute): `export DATA_ROOT="/Users/Tamam/Desktop/Microdent/Microdent-Write-Sandbox/DATA"` | Path exists after §3 |
| 2.4 | Terminal A: `unset WRITE_MODE` (or `export WRITE_MODE=disabled`); `pnpm dev:bridge` | Process stays up; no `DATA_ROOT` startup error |
| 2.5 | `curl -sS http://127.0.0.1:17890/health` | JSON includes `"ok": true` and a `version` string |
| 2.6 | `curl -sS http://127.0.0.1:17890/debug/status` (non-production Node env) | `writeMode` is `"disabled"`; `writesPermitted` is **false** |

**Fail clues:** Relative `DATA_ROOT`, port in use — repeat 2.1; forbidden path — fix `DATA_ROOT` (§3).

---

## 3. Create disposable write sandbox **(today)**

Follow [phase-3-disposable-write-sandbox.md](./phase-3-disposable-write-sandbox.md) §4–6.

| Step | Action | Pass |
| --- | --- | --- |
| 3.1 | Ensure sandbox **does not** live inside the git repo | Path is `/Users/Tamam/Desktop/Microdent/Microdent-Write-Sandbox/...` |
| 3.2 | Copy **from Legacy-Copy only** (not from `Microdent-Legacy`): `rsync -a --delete "/Users/Tamam/Desktop/Microdent/Microdent-Legacy-Copy/DATA/" "/Users/Tamam/Desktop/Microdent/Microdent-Write-Sandbox/DATA/"` | Copy completes |
| 3.3 | `mkdir -p "/Users/Tamam/Desktop/Microdent/Microdent-Write-Sandbox/backups"` | Directory exists and is writable |
| 3.4 | Create marker at `…/DATA/.microdent-write-sandbox.json` with `"disposable": true` and `"schemaVersion": 1` | File present (see §4) |
| 3.5 | `export DATA_ROOT="/Users/Tamam/Desktop/Microdent/Microdent-Write-Sandbox/DATA"` | `test -d "$DATA_ROOT"` succeeds |

**Synthetic-only alternative (no clinic PHI in backup rehearsal):** Skip 3.2 for backup-only gate and use §6.1 automated synthetic fixtures instead. Use full sandbox (3.2) before any enabled-mode pilot.

---

## 4. Verify sandbox marker **(today)**

| Step | Action | Pass |
| --- | --- | --- |
| 4.1 | `test -f "$DATA_ROOT/.microdent-write-sandbox.json"` | Exit **0** |
| 4.2 | Parse JSON: `disposable` is **true**, `schemaVersion` is supported (**1**) | Invalid/missing → **fail** |
| 4.3 | Confirm `realpath` of `DATA_ROOT` is **not** under `Microdent-Legacy` or `Microdent-Legacy-Copy` | Paths outside forbidden trees |
| 4.4 | Run guard unit tests: `pnpm --filter @microdent/bridge test src/write-safety/write-safety.test.ts` | All cases green (temp dirs + synthetic marker only) |

**Expected guard codes** (if a future route calls `validateWritableSandbox`): `WRITE_SANDBOX_MARKER_MISSING`, `WRITE_SANDBOX_MARKER_INVALID`, `WRITE_TARGET_FORBIDDEN_LEGACY`, `WRITE_TARGET_FORBIDDEN_LEGACY_COPY` — see [phase-3-sandbox-guard.md](./phase-3-sandbox-guard.md) §4.

---

## 5. Run `legacy:backup` on synthetic schedule files **(today)**

### 5.1 Automated synthetic rehearsal (recommended — no PHI)

| Step | Action | Pass |
| --- | --- | --- |
| 5.1.1 | `pnpm --filter @microdent/bridge test src/backup/legacy-backup.test.ts` | All tests pass |
| 5.1.2 | Review test intent (not stdout PHI) | Backup copies `SCHEDULE.DBF` (+ optional `.FPT`/`.CDX`); **source mtime unchanged**; manifest lists **basename, size, sha256** only |

Tests use `writeScheduleFixtures` with tokens `SYNTHETIC_COMMENT_TOKEN_XX` / `SYNTHETIC_NAME_TOKEN_YY` — those strings must **never** appear in CLI stdout or `manifest.json`.

### 5.2 Manual backup on disposable sandbox

| Step | Action | Pass |
| --- | --- | --- |
| 5.2.1 | `export BACKUP_DIR="/Users/Tamam/Desktop/Microdent/Microdent-Write-Sandbox/backups"` | Absolute path |
| 5.2.2 | `export WORKFLOW="appointment.statusUpdate"` | Matches [phase-3-backup-cli.md](./phase-3-backup-cli.md) |
| 5.2.3 | `pnpm legacy:backup` | Prints `backup: created`, `operationId`, per-file `size` and `sha256` |
| 5.2.4 | `stat -f "%m %z" "$DATA_ROOT/SCHEDULE.DBF"` before and after | **mtime and size unchanged** on source |

**Fail:** `DATA_ROOT` or `BACKUP_DIR` under forbidden legacy path; missing `SCHEDULE.DBF`; relative env paths.

---

## 6. Verify backup manifest **(today)**

| Step | Action | Pass |
| --- | --- | --- |
| 6.1 | Locate folder `{BACKUP_DIR}/{utcTimestamp}__appointment.statusUpdate__{shortOpId}/` from CLI output | Directory exists |
| 6.2 | Open `manifest.json` | Contains `operationId`, `workflow`, `createdAt`, `dataRootRealpath`, `files[]` |
| 6.3 | For each `files[]` entry, re-hash: `shasum -a 256 "…/files/{filename}"` (or `openssl dgst -sha256`) | Matches manifest `sha256` |
| 6.4 | Confirm `files/` contains `SCHEDULE.DBF` and any present sidecars | No unexpected basenames for this workflow |
| 6.5 | **Privacy scan** on `manifest.json` and CLI output | No `PAT_NAME`, `TELEPHONE`, `COMMENT` field values; no row payloads; no `before`/`after` objects |

**Not yet available:** `pnpm legacy:backup-verify`, header `recordCount` in manifest, disk-space preflight — see gaps §16.

---

## 7. `WRITE_MODE=disabled` — write route rejects **(today + future)**

### 7.1 Config and diagnostics **(today)**

| Step | Action | Pass |
| --- | --- | --- |
| 7.1.1 | Stop bridge; `unset WRITE_MODE`; start `pnpm dev:bridge` | Starts clean |
| 7.1.2 | `curl -sS http://127.0.0.1:17890/debug/status` | `"writeMode": "disabled"`, `"writesPermitted": false` |
| 7.1.3 | `export WRITE_MODE=disabled`; restart bridge; re-check `/debug/status` | Same as 7.1.2 |
| 7.1.4 | `export WRITE_MODE=not-a-mode`; restart; `/debug/status` | Falls back to `"disabled"` (fail closed) |

### 7.2 Mutation HTTP **(future — when `/v1` write routes exist)**

| Step | Action | Pass |
| --- | --- | --- |
| 7.2.1 | With `WRITE_MODE=disabled`, `POST`/`PATCH` a documented mutation (e.g. appointment status) | **403** `WRITE_MODE_DISABLED` |
| 7.2.2 | Response body | No `SafeWritePlan`; no PHI in error JSON |
| 7.2.3 | `stat` workflow DBFs under `DATA_ROOT` | mtime/size unchanged |

**Today substitute:** 7.1 satisfies write-mode gate until 7.2 is unblocked.

---

## 8. `WRITE_MODE=dry-run` — no file mtime changes **(today + future)**

### 8.1 Sandbox guard with dry-run **(today)**

| Step | Action | Pass |
| --- | --- | --- |
| 8.1.1 | `export WRITE_MODE=dry-run`; restart bridge | `/debug/status` shows `"dry-run"`; `writesPermitted` still **false** until write routes ship |
| 8.1.2 | `pnpm legacy:backup` (unchanged env) | Still read-only on source; mtime unchanged (§5.2.4) |

Dry-run guard semantics: marker **required**; `ALLOW_LEGACY_WRITES` **not** required — see [phase-3-sandbox-guard.md](./phase-3-sandbox-guard.md) §3.

### 8.2 Mutation dry-run **(future)**

| Step | Action | Pass |
| --- | --- | --- |
| 8.2.1 | `export WRITE_MODE=dry-run`, valid sandbox marker, allowlisted workflow env | Bridge starts |
| 8.2.2 | Record `stat -f "%m" "$DATA_ROOT/SCHEDULE.DBF"` (and `.FPT` if present) | Baseline captured |
| 8.2.3 | Execute mutation with `X-Write-Intent: dry-run` or global dry-run | **200** with `committed: false` |
| 8.2.4 | Re-`stat` same files | **mtime unchanged** |
| 8.2.5 | No new files under `BACKUP_DIR` for that operation | Dry-run must not create backup folders |

---

## 9. `SafeWritePlan` contains no values **(future)**

When mutation routes return `SafeWritePlan` per [phase-3-dry-run-write-plan.md](./phase-3-dry-run-write-plan.md) §4:

| Step | Action | Pass |
| --- | --- | --- |
| 9.1 | Capture plan JSON from successful dry-run (redact before sharing) | Inspect locally only |
| 9.2 | `fieldsChanged[]` | Each entry has `table`, `recordId`, `field`, `changeType` only — **no** `before`, `after`, or value properties |
| 9.3 | Plan root | No `PAT_NAME`, `TELEPHONE`, `COMMENT` keys or string values resembling clinic data |
| 9.4 | Plan root | No `rawRow`, memo bodies, amounts, or absolute `DATA_ROOT` paths |
| 9.5 | Allowed | `operationId`, `workflow`, `tablesAffected`, `recordIds`, status **codes**, `warnings[].code` |

**Today substitute:** `pnpm --filter @microdent/bridge test` (contracts/bridge) when `SafeWritePlanSchema` lands; until then, mark **N/A** on sign-off with date.

---

## 10. Audit log has no PHI **(today)**

SQLite audit tables: migration `007_write_audit.sql`; writers in `@microdent/sqlite-mirror`.

| Step | Action | Pass |
| --- | --- | --- |
| 10.1 | `export SQLITE_PATH="/tmp/microdent-write-qa-audit.sqlite"` (or another **non-repo** path) | Absolute path outside Modern repo |
| 10.2 | `pnpm --filter @microdent/sqlite-mirror test src/write-audit.test.ts` | All tests pass, including forbidden-payload rejection |
| 10.3 | Apply migrations and inspect schema (optional): `pnpm --filter @microdent/sqlite-mirror test src/apply-migrations.test.ts` | `write_audit_log`, `write_audit_steps`, `write_errors` exist |
| 10.4 | If querying manually: `sqlite3 "$SQLITE_PATH" "SELECT operation_id, workflow_type, execution_mode, target_tables, target_record_ids FROM write_audit_log LIMIT 5;"` | Only synthetic ids/tables from tests — **no** names, phones, notes, amounts |
| 10.5 | Confirm forbidden keys never persist: `before`, `after`, `rawRow`, `patientName`, `noteText`, `amount` | Guard tests cover nested rejection |

**Future:** After bridge wires audit on mutation, repeat 10.4 for one dry-run `operation_id` from the API — still no PHI columns.

---

## 11. Enabled mode blocked until explicitly allowed **(today + future)**

| Step | Action | Pass |
| --- | --- | --- |
| 11.1 | `export WRITE_MODE=enabled`; restart bridge; `GET /debug/status` | `writeMode` is `"enabled"` but **`writesPermitted` is false** (current foundation) |
| 11.2 | Without `ALLOW_LEGACY_WRITES=I_UNDERSTAND_THIS_IS_A_DISPOSABLE_COPY`, call `validateWritableSandbox` via unit test or future route | **403** / `WRITE_NOT_ACKNOWLEDGED` when enabled path runs |
| 11.3 | Set `ALLOW_LEGACY_WRITES` to wrong value | Still rejected |
| 11.4 | Set exact ack **and** sandbox marker **and** (future) `WRITE_BACKUP_DIR` + `WRITE_AUDIT_LOG` | Commit still blocked until `writesPermitted()` and backup preflight pass |
| 11.5 | **Policy** | No production `Microdent-Legacy` path; enabled pilot requires written sign-off (§15) |

**Today:** 11.1 + `write-safety.test.ts` enabled/ack cases satisfy the gate; real commits remain impossible.

---

## 12. Privacy checks (all artifacts) **(today)**

Apply to **backup stdout**, `manifest.json`, **(future)** mutation responses, **(future)** JSONL audit, server logs, and screenshots.

| Check | Pass criterion |
| --- | --- |
| **No `PAT_NAME`** | No patient name strings in operator-captured artifacts |
| **No `TELEPHONE`** | No phone digits or full phone fields |
| **No `COMMENT`** | No appointment memo / comment body |
| **No raw row** | No full DBF row maps, hex dumps, or `rawRow` |
| **No before/after values** | No `before`/`after` keys or prior/new field values in plans or audit `detail_json` |
| **Synthetic tokens** | If using test fixtures, tokens like `SYNTHETIC_*` must not leak into manifests or tickets |

Use `rg -i 'PAT_NAME|TELEPHONE|COMMENT|rawRow|"before"|"after"'` on **manifest and plan files only** — not on live `DATA_ROOT` DBFs (those may contain real PHI on sandbox copied from Legacy-Copy).

---

## 13. Restore rehearsal **(today — manual)**

`legacy:restore` is **not** implemented; rehearse manual restore per [phase-3-backup-restore-plan.md](./phase-3-backup-restore-plan.md) §7.

| Step | Action | Pass |
| --- | --- | --- |
| 13.1 | Stop bridge and ensure no FoxPro lock on sandbox | No open handles |
| 13.2 | Pick the backup folder from §6 | `manifest.json` + `files/` intact |
| 13.3 | Record baseline hashes of live `SCHEDULE.DBF` (and sidecars) under `DATA_ROOT` | Saved locally |
| 13.4 | **Simulate corruption** on disposable sandbox only: e.g. `truncate -s 0` or append one byte to `SCHEDULE.DBF` | Hash differs from manifest |
| 13.5 | Restore **whole workflow group**: copy each `files/{basename}` → `$DATA_ROOT/{basename}` (overwrite) | All manifest `files[]` members restored |
| 13.6 | Re-hash live files | Match manifest `sha256` |
| 13.7 | `pnpm legacy:backup` again | New backup succeeds; prior backup folder unchanged |
| 13.8 | Optional: `diff -rq` sandbox `DATA` vs Legacy-Copy | Expect differences until sandbox refresh; Legacy-Copy itself **unchanged** |

**Never** restore into `Microdent-Legacy` or `Microdent-Legacy-Copy`.

---

## 14. Automated regression bundle **(today)**

Run before sign-off on Node 22.5+:

```bash
cd /Users/Tamam/Desktop/Microdent/Microdent-Modern
pnpm --filter @microdent/bridge test src/write-safety/write-safety.test.ts
pnpm --filter @microdent/bridge test src/backup/legacy-backup.test.ts
pnpm --filter @microdent/bridge test src/config.test.ts
pnpm --filter @microdent/sqlite-mirror test src/write-audit.test.ts
```

| Suite | Pass |
| --- | --- |
| write-safety | Forbidden legacy/copy paths; marker required |
| legacy-backup | Synthetic SCHEDULE; manifest hashes; source mtime stable |
| config | `WRITE_MODE` defaults and parsing |
| write-audit | PHI-safe payloads; forbidden keys rejected |

---

## 15. Sign-off table

Complete after §1–14. Use **Pass / Fail / N/A** and initials only — no PHI in this table.

| # | Gate | Pass | Initials | Date |
| --- | --- | --- | --- | --- |
| 1 | Node 22.5+ verified | | | |
| 2 | Clean ports + bridge health | | | |
| 3 | Disposable sandbox created (or synthetic-only backup path documented) | | | |
| 4 | Sandbox marker valid | | | |
| 5 | `legacy:backup` on synthetic and/or sandbox | | | |
| 6 | Manifest hashes verified | | | |
| 7 | `WRITE_MODE=disabled` diagnostics (and 403 when routes exist) | | | |
| 8 | Dry-run causes no source mtime change | | | |
| 9 | `SafeWritePlan` value-free (or N/A until routes ship) | | | |
| 10 | Audit log PHI-safe | | | |
| 11 | Enabled mode not permitted without ack + future gates | | | |
| 12 | Privacy scan clean on captured artifacts | | | |
| 13 | Manual restore rehearsal successful | | | |
| 14 | Automated regression bundle green | | | |

**Approver (writes pilot):** __________________ **Date:** __________

**Blockers to real DBF mutation:** Any **Fail** above, or any **N/A** in rows 7–9 without an approved follow-up ticket.

---

## 16. Known gaps (honest coverage)

| Area | Gap | Workaround in this checklist |
| --- | --- | --- |
| Mutation routes | No `POST`/`PATCH` write APIs yet | §7.1, §8.1, §11.1 + unit tests |
| `SafeWritePlan` HTTP | Schema planned, not exposed | §9 N/A + dry-run plan doc |
| `writesPermitted` | Always `false` in config | `/debug/status` + §11 |
| Restore CLI | No `pnpm legacy:restore` | §13 manual copy |
| Backup verify CLI | No `legacy:backup-verify` | §6 manual `shasum` |
| `WRITE_AUDIT_LOG` JSONL | Bridge append not wired | §10 SQLite writer tests |
| Forbidden copy on backup | Backup env blocks **Legacy** root; copy path allowed for `DATA_ROOT` if operator chooses | Prefer synthetic §5.1 or disposable sandbox §3 |
| `legacy:backup` on real copy | Sandbox may contain PHI on disk — treat backups as confidential | Do not export manifest off-machine |
| Mirror re-import after restore | Not automatic | Re-run `pnpm mirror:import-safe` after restore if mirror is in scope |

---

## Definition of done (this document)

- [x] `docs/phase-3-write-safe-qa-checklist.md` exists
- [x] No application code changed
- [x] No PHI in document body
- [x] No files modified under `Microdent-Legacy` or `Microdent-Legacy-Copy`
