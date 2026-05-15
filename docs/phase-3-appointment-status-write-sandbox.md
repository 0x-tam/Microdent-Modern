# Phase 3 — Appointment status write (sandbox only)

**Status:** Implemented — real `SCHEDULE.STATUS` writes when all safety gates pass.

**Route:** `PATCH /v1/schedule/appointments/:appointmentId/status`

**Body:** `{ "status": <integer> }` where `status` is **0–5**.

**Response:** `SafeWritePlan` JSON (`@microdent/contracts`). No row values, memos, or PHI.

---

## Write mode behavior

| `WRITE_MODE` | HTTP | File changes |
| --- | --- | --- |
| unset / `disabled` | **403** `WRITE_MODE_DISABLED` | None |
| `dry-run` | **200** `SafeWritePlan`, `committed: false` | None (validates sandbox marker) |
| `enabled` | **200** `SafeWritePlan`, `committed: true` on success | `SCHEDULE.STATUS` only, after backup |

`DATA_ROOT` must be configured for `dry-run` / `enabled`. `BACKUP_DIR` must be configured for `enabled`.

---

## Safety gates (`enabled`)

All must pass before any DBF mutation:

1. **`WRITE_MODE=enabled`**
2. **Disposable sandbox** — `DATA_ROOT/.microdent-write-sandbox.json` with `{ "disposable": true }`
3. **Not forbidden paths** — not under `Microdent-Legacy` or `Microdent-Legacy-Copy`
4. **`ALLOW_LEGACY_WRITES=I_UNDERSTAND_THIS_IS_A_DISPOSABLE_COPY`**
5. **`BACKUP_DIR`** — absolute path; workflow backup succeeds
6. **Validation** — positive integer `appointmentId`, `status` 0–5, row exists
7. **Post-write verify** — re-read `STATUS`; must match request and differ from pre-write value

`dry-run` requires gates 2–3 and 6 (marker + validation); skips allow flag and backup.

---

## Backup (`appointment.statusUpdate`)

Before write, copies from `DATA_ROOT` into `BACKUP_DIR`:

| File | Required |
| --- | --- |
| `SCHEDULE.DBF` | Yes |
| `SCHEDULE.FPT` | If present |
| `SCHEDULE.CDX` | If present |

Folder layout: `{BACKUP_DIR}/{utcTimestamp}__appointment.statusUpdate__{shortOpId}/files/` plus `manifest.json`.

If backup fails → **503** `WRITE_BACKUP_FAILED`; **no** `SCHEDULE` change.

CLI: `pnpm legacy:backup` with `WORKFLOW=appointment.statusUpdate` (see [phase-3-backup-cli.md](./phase-3-backup-cli.md)).

---

## Field allowlist

**Written:** `STATUS` only.

**Never written or returned:** `COMMENT`, `TELEPHONE`, `PAT_NAME`, `CASENUM`, memo/FPT payloads, raw rows.

---

## Audit

When `SQLITE_PATH` is configured and migrations apply, the bridge records write audit steps (`write.requested`, `write.backup_created`, `write.started`, `write.finished` or `failed`). Audit payloads exclude PHI (see [phase-3-audit-log-schema.md](./phase-3-audit-log-schema.md)).

---

## Operator env (enabled)

```bash
export WRITE_MODE=enabled
export DATA_ROOT="/Users/Tamam/Desktop/Microdent/Microdent-Write-Sandbox/DATA"
export BACKUP_DIR="/Users/Tamam/Desktop/Microdent/Microdent-Write-Sandbox/backups"
export ALLOW_LEGACY_WRITES=I_UNDERSTAND_THIS_IS_A_DISPOSABLE_COPY
# optional: export SQLITE_PATH="/absolute/path/to/mirror.sqlite"
```

Create sandbox per [phase-3-disposable-write-sandbox.md](./phase-3-disposable-write-sandbox.md). Never point `DATA_ROOT` at production Legacy or read-only Legacy-Copy.

---

## Errors (additional)

| Code | HTTP | When |
| --- | --- | --- |
| `WRITE_BACKUP_NOT_CONFIGURED` | 503 | `enabled` but `BACKUP_DIR` unset |
| `WRITE_BACKUP_FAILED` | 503 | Backup step failed |
| `WRITE_SANDBOX_MARKER_MISSING` | 403 | No marker file |
| `WRITE_NOT_ACKNOWLEDGED` | 403 | Missing/wrong `ALLOW_LEGACY_WRITES` |
| `SCHEDULE_STATUS_WRITE_FAILED` | 500 | DBF write error |
| `SCHEDULE_STATUS_VERIFY_FAILED` | 500 | Post-write status check failed |

---

## Tests

`services/bridge/src/appointment-status-write.test.ts` and `appointment-status-dry-run.test.ts` use **synthetic** `writeScheduleFixtures` only.

---

## Related

- [phase-3-appointment-status-dry-run.md](./phase-3-appointment-status-dry-run.md)
- [phase-3-sandbox-guard.md](./phase-3-sandbox-guard.md)
- [phase-3-appointment-write-mapping.md](./phase-3-appointment-write-mapping.md)
