# Phase 3 — Appointment status write (sandbox operator runbook)

**Purpose:** Exact operator flow to prove **appointment `STATUS` write** safely on a **disposable sandbox** — dry-run rehearsal, backup, optional enabled commit, verification, restore, reset.

**Status (code, 2026-05-17):**

| Band | Shipped? |
| --- | --- |
| Dry-run plan route | **Yes** — `PATCH …/status` with `WRITE_MODE=dry-run` → `committed: false`, no DBF mutation |
| Backup CLI | **Yes** — `pnpm legacy:backup` |
| Enabled sandbox commit | **Yes** — `WRITE_MODE=enabled` + sandbox marker + `ALLOW_LEGACY_WRITES` ack + `BACKUP_DIR` → persists **only** `SCHEDULE.STATUS` |

`writesPermitted` is **true** when `WRITE_MODE=enabled` and both `BACKUP_DIR` and `DATA_ROOT` are configured. Per-request sandbox marker and ack are still required for commit. Do not sign off a production pilot until steps **11–12** pass on **disposable** sandbox data only (see [phase-3-write-safe-qa-checklist.md](./phase-3-write-safe-qa-checklist.md)).

**Related:** [phase-3-write-safe-qa-checklist.md](./phase-3-write-safe-qa-checklist.md), [phase-3-appointment-status-dry-run.md](./phase-3-appointment-status-dry-run.md), [phase-3-disposable-write-sandbox.md](./phase-3-disposable-write-sandbox.md), [phase-3-backup-cli.md](./phase-3-backup-cli.md), [phase-3-audit-log-schema.md](./phase-3-audit-log-schema.md).

---

## Hard rules

| Rule | Requirement |
| --- | --- |
| **Never touch** | `/Users/Tamam/Desktop/Microdent/Microdent-Legacy` |
| **Read-only reference** | `/Users/Tamam/Desktop/Microdent/Microdent-Legacy-Copy` — copy **from** here into sandbox only |
| **Writable target** | `/Users/Tamam/Desktop/Microdent/Microdent-Write-Sandbox/DATA` |
| **Repo** | All commands from `/Users/Tamam/Desktop/Microdent/Microdent-Modern` |
| **Privacy** | Do not paste patient names, phones, comment text, chart numbers, raw DBF rows, or full API/audit JSON into tickets or chat. Record **pass/fail**, HTTP **codes**, `operationId`, and **numeric status codes** only |

---

## Paths and variables (set once per session)

```bash
cd /Users/Tamam/Desktop/Microdent/Microdent-Modern

export SANDBOX="/Users/Tamam/Desktop/Microdent/Microdent-Write-Sandbox"
export DATA_ROOT="${SANDBOX}/DATA"
export BACKUP_DIR="${SANDBOX}/backups"
export SQLITE_PATH="${SANDBOX}/mirror.sqlite"
export BRIDGE_URL="http://127.0.0.1:17890"
```

Choose **before** the run (local notes only — do not commit to git):

| Variable | Meaning |
| --- | --- |
| `APPT_ID` | Positive integer string, no leading zeros (e.g. `12345`) — an appointment that exists in sandbox `SCHEDULE.DBF` |
| `STATUS_BEFORE` | Current status code **0–5** (opaque integer) |
| `STATUS_AFTER` | Target status code **0–5**, must differ from `STATUS_BEFORE` for a meaningful write test |

Discover `APPT_ID` using local tools that do not export PHI (e.g. legacy UI on sandbox only, or a private query). Do **not** use `GET /v1/schedule/appointments` responses in tickets — that route can include patient display fields.

---

## 1. Node 22

```bash
nvm use 22
node -v   # expect v22.5.0 or higher
corepack enable   # if needed
pnpm install
```

**Pass:** `node -v` is **≥ 22.5.0** (required for `pnpm mirror:import-safe` and full `pnpm test`).

---

## 2. Automated tests

```bash
cd /Users/Tamam/Desktop/Microdent/Microdent-Modern
pnpm test
```

**Pass:** Monorepo test script completes green (contracts, bridge, sqlite-mirror, bridge-client, ui, app).

---

## 3. Web build (optional UI rehearsal)

```bash
pnpm build:web
```

**Pass:** `@microdent/web` production build succeeds. Use with [phase-3-appointment-status-dry-run-ui.md](./phase-3-appointment-status-dry-run-ui.md) only on **disposable** data and dev flags — not required for CLI-only QA.

---

## 4. Create disposable sandbox

Follow [phase-3-disposable-write-sandbox.md](./phase-3-disposable-write-sandbox.md) §4–6.

```bash
SOURCE="/Users/Tamam/Desktop/Microdent/Microdent-Legacy-Copy/DATA"
mkdir -p "${SANDBOX}/backups"
rsync -a --delete "${SOURCE}/" "${DATA_ROOT}/"
```

Create marker `${DATA_ROOT}/.microdent-write-sandbox.json`:

```json
{
  "schemaVersion": 1,
  "purpose": "disposable-write-sandbox",
  "createdAt": "2026-05-15T12:00:00.000Z",
  "sourceCopy": "Microdent-Legacy-Copy/DATA",
  "disposable": true,
  "allowedOperations": ["dbf-row-write"],
  "owner": "local-dev"
}
```

**Pass:**

- `test -d "${DATA_ROOT}"`
- `test -f "${DATA_ROOT}/.microdent-write-sandbox.json"`
- `realpath "${DATA_ROOT}"` is **not** under `Microdent-Legacy` or `Microdent-Legacy-Copy`

---

## 5. Mirror import (if needed)

Run when the Schedule panel or SQLite-backed routes must reflect sandbox DBFs. Skip if you only exercise the status route against DBF directly.

```bash
export DATA_ROOT="${SANDBOX}/DATA"
export SQLITE_PATH="${SANDBOX}/mirror.sqlite"
pnpm mirror:import-safe
```

**Pass:** Stdout shows table counts only (no names, phones, or row payloads). Re-run after any restore (step 13) if mirror consistency is in scope.

**Verify status (mirror, PHI-safe):**

```bash
sqlite3 "${SQLITE_PATH}" \
  "SELECT status_code FROM appointments WHERE appointment_id = '${APPT_ID}' LIMIT 1;"
```

Record the integer as `STATUS_BEFORE` in local notes only.

---

## 6. Start bridge — dry-run posture

```bash
pnpm dev:kill-ports
export DATA_ROOT="${SANDBOX}/DATA"
export WRITE_MODE=dry-run
unset ALLOW_LEGACY_WRITES
pnpm dev:bridge
```

Use a **second terminal** for HTTP checks. Leave bridge running until step 10.

**Pass:**

```bash
curl -sS "${BRIDGE_URL}/health"
curl -sS "${BRIDGE_URL}/debug/status"
```

Expect `"ok": true`, `"writeMode": "dry-run"`, `"writesPermitted": false`.

---

## 7. Call dry-run route

Record baseline **before** the request:

```bash
stat -f "%m %z" "${DATA_ROOT}/SCHEDULE.DBF"
shasum -a 256 "${DATA_ROOT}/SCHEDULE.DBF"
# If present:
for f in SCHEDULE.FPT SCHEDULE.CDX; do
  test -f "${DATA_ROOT}/${f}" && shasum -a 256 "${DATA_ROOT}/${f}"
done
```

Dry-run request (`STATUS_AFTER` must be 0–5):

```bash
curl -sS -X PATCH "${BRIDGE_URL}/v1/schedule/appointments/${APPT_ID}/status" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "X-Write-Intent: dry-run" \
  -d "{\"status\":${STATUS_AFTER}}" \
  | jq '{operationId, workflow, mode, committed, fieldsChanged, warnings}'
```

**Pass:**

| Check | Expected |
| --- | --- |
| HTTP | **200** |
| `workflow` | `appointment.statusUpdate` |
| `mode` | `dry-run` |
| `committed` | `false` |
| `fieldsChanged` | One entry: `table: "SCHEDULE"`, `field: "STATUS"`, `changeType: "set"` — **no** `before` / `after` |
| `warnings` | Empty or informational only (no commit blockers) |

---

## 8. Confirm no file changes (dry-run)

```bash
stat -f "%m %z" "${DATA_ROOT}/SCHEDULE.DBF"
shasum -a 256 "${DATA_ROOT}/SCHEDULE.DBF"
```

**Pass:** `mtime`, size, and `sha256` match step 7 baseline. Sidecar hashes unchanged if present.

**Pass (backup dir):** No new folder under `${BACKUP_DIR}` for this dry-run call.

---

## 9. Run backup (pre-write snapshot)

Stop bridge if it holds file locks, or use a fresh terminal with bridge stopped for backup-only.

```bash
export DATA_ROOT="${SANDBOX}/DATA"
export BACKUP_DIR="${SANDBOX}/backups"
export WORKFLOW="appointment.statusUpdate"
pnpm legacy:backup
```

Save from stdout: `operationId`, backup folder name, per-file `sha256` — **not** row data.

**Pass:**

- CLI prints `backup: created`
- `stat` on `${DATA_ROOT}/SCHEDULE.DBF` unchanged vs post–dry-run (backup is read-only copy)
- `manifest.json` lists `SCHEDULE.DBF` (+ `.FPT`/`.CDX` if present) with hashes only

Set `BACKUP_FOLDER` to the printed `{BACKUP_DIR}/{timestamp}__appointment.statusUpdate__{shortOpId}/` path.

---

## 10. Start bridge — enabled posture (real write band)

```bash
pnpm dev:kill-ports
export DATA_ROOT="${SANDBOX}/DATA"
export WRITE_MODE=enabled
export ALLOW_LEGACY_WRITES=I_UNDERSTAND_THIS_IS_A_DISPOSABLE_COPY
# When bridge wires audit on commit:
# export SQLITE_PATH="${SANDBOX}/mirror.sqlite"
pnpm dev:bridge
```

**Pass:** `/debug/status` shows `"writeMode": "enabled"`, `"writesPermitted": true` (requires `BACKUP_DIR` + `DATA_ROOT`), and `"writableSandbox": true` when marker + ack are valid.

---

## 11. Call status write route (enabled commit)

**Target** request (same URL; commit intent when global mode is enabled):

```bash
curl -sS -X PATCH "${BRIDGE_URL}/v1/schedule/appointments/${APPT_ID}/status" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "X-Write-Intent: commit" \
  -d "{\"status\":${STATUS_AFTER}}" \
  | jq '{operationId, workflow, mode, committed, fieldsChanged, warnings}'
```

**Pass:**

| Check | Expected |
| --- | --- |
| HTTP | **200** |
| `committed` | `true` |
| `warnings` | Empty or informational only |
| Response | No `PAT_NAME`, `TELEPHONE`, `COMMENT`, raw row, or before/after values |
| `SCHEDULE.DBF` | `sha256` differs from pre-commit baseline (status changed) |

---

## 12. Verify enabled write

### 12.1 Backup exists

```bash
test -d "${BACKUP_FOLDER}"
test -f "${BACKUP_FOLDER}/manifest.json"
```

Re-verify manifest hashes (see [phase-3-backup-cli.md](./phase-3-backup-cli.md)).

### 12.2 Audit log (if implemented)

When bridge persists write audit to `SQLITE_PATH`:

```bash
sqlite3 "${SQLITE_PATH}" <<'SQL'
SELECT operation_id, workflow_type, execution_mode, status, terminal_status,
       target_tables, target_record_ids
FROM write_audit_log
ORDER BY requested_at DESC
LIMIT 5;
SQL
```

**Pass:** Row for this `operationId` with `execution_mode` appropriate to real write; columns contain ids/codes only — no names, phones, notes, amounts, or row snapshots. See [phase-3-audit-log-schema.md](./phase-3-audit-log-schema.md).

**Today:** Skip with **N/A** if `SQLITE_PATH` was not set or migrations were not applied before commit.

### 12.3 `SCHEDULE.STATUS` changed

**Preferred (no DBF row dump):** Re-import mirror (step 5), then:

```bash
sqlite3 "${SQLITE_PATH}" \
  "SELECT status_code FROM appointments WHERE appointment_id = '${APPT_ID}' LIMIT 1;"
```

**Pass:** Value equals `STATUS_AFTER` (integer 0–5).

**Alternative:** Compare `sha256` of `${DATA_ROOT}/SCHEDULE.DBF` to pre-write baseline — must **differ** after a real commit.

### 12.4 No other field changed

**Pass (sidecars):** If `SCHEDULE.FPT` and `SCHEDULE.CDX` exist, their `sha256` matches pre-write baseline (status-only write should not touch memos/index files).

**Pass (narrow write contract):** Plan and implementation allowlist only `STATUS` on `SCHEDULE` for workflow `appointment.statusUpdate` — see [phase-3-appointment-write-mapping.md](./phase-3-appointment-write-mapping.md).

**Do not** diff full DBF rows or paste `GET /v1/schedule/appointments` bodies into evidence.

---

## 13. Restore from backup

Stop bridge and FoxPro locks on sandbox.

```bash
pnpm dev:kill-ports
```

For each file listed in `${BACKUP_FOLDER}/manifest.json` under `files/`:

```bash
cp "${BACKUP_FOLDER}/files/SCHEDULE.DBF" "${DATA_ROOT}/SCHEDULE.DBF"
# Repeat for SCHEDULE.FPT, SCHEDULE.CDX when present in files/
```

**Pass:** `shasum -a 256` on live `${DATA_ROOT}/SCHEDULE.DBF` matches manifest `sha256` for that backup.

`pnpm legacy:restore` is **not** shipped — manual copy only ([phase-3-backup-restore-plan.md](./phase-3-backup-restore-plan.md)).

---

## 14. Verify status reverted

Re-run mirror import if using SQLite verification (step 5), then:

```bash
sqlite3 "${SQLITE_PATH}" \
  "SELECT status_code FROM appointments WHERE appointment_id = '${APPT_ID}' LIMIT 1;"
```

**Pass:** Value equals `STATUS_BEFORE` again.

---

## 15. Reset sandbox

When the session ends or the tree is dirty:

```bash
pnpm dev:kill-ports
SANDBOX="/Users/Tamam/Desktop/Microdent/Microdent-Write-Sandbox"
SOURCE="/Users/Tamam/Desktop/Microdent/Microdent-Legacy-Copy/DATA"
rm -rf "${SANDBOX}/DATA" "${SANDBOX}/backups" "${SANDBOX}/mirror.sqlite"
mkdir -p "${SANDBOX}/backups"
rsync -a "${SOURCE}/" "${SANDBOX}/DATA/"
# Recreate .microdent-write-sandbox.json (step 4)
```

**Pass:** Legacy-Copy unchanged (`diff` optional, local only). Sandbox matches fresh copy from Copy.

---

## Privacy checks (all steps)

Apply before sharing any artifact:

| Check | Pass |
| --- | --- |
| No `PAT_NAME` | Not in curl output, manifests, audit queries, or tickets |
| No `TELEPHONE` | Same |
| No `COMMENT` | Same |
| No raw row | No DBF dumps or `rawRow` |
| No before/after row values | No `before`/`after` keys in plans or audit `detail_json` |
| No notes | No memo text or clinical notes |

Safe `jq` filter for plan responses:

```bash
jq '{operationId, workflow, mode, committed, fieldsChanged, warnings: [.warnings[]? | {code, severity}]}'
```

Do **not** run `rg` across live `DATA_ROOT` DBFs for PHI patterns — those files may contain real data on sandbox copied from Legacy-Copy.

---

## Quick reference

| Step | Action |
| --- | --- |
| 1 | `nvm use 22` |
| 2 | `pnpm test` |
| 3 | `pnpm build:web` |
| 4 | Create sandbox + marker |
| 5 | `pnpm mirror:import-safe` (if needed) |
| 6 | Bridge: `DATA_ROOT` + `WRITE_MODE=dry-run` |
| 7 | `PATCH …/status` dry-run |
| 8 | mtime/hash unchanged |
| 9 | `pnpm legacy:backup` |
| 10 | Bridge: `WRITE_MODE=enabled` + `ALLOW_LEGACY_WRITES=…` |
| 11 | `PATCH …/status` commit (enabled + sandbox + backup) |
| 12 | Backup + audit + STATUS + sidecars |
| 13 | Restore from backup folder |
| 14 | Status reverted |
| 15 | Reset sandbox |
