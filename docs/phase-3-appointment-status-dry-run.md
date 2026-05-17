# Phase 3 — Appointment status dry-run route

**Status:** Implemented — `PATCH /v1/schedule/appointments/:appointmentId/status` with mode-specific behavior.

**Route:** `PATCH /v1/schedule/appointments/:appointmentId/status`

**Body:** `{ "status": <integer> }` where `status` is **0–5** (opaque legacy codes).

**Response:** `SafeWritePlan` JSON (see `@microdent/contracts`).

---

## Write mode behavior

| `WRITE_MODE` | HTTP | `committed` | Notes |
| --- | --- | --- | --- |
| unset / `disabled` | **403** `WRITE_MODE_DISABLED` | — | No `DATA_ROOT` read; no plan |
| `dry-run` | **200** `SafeWritePlan` | `false` | Validates id + status; confirms row exists in `SCHEDULE.DBF` read-only; **no** DBF mutation |
| `enabled` | **200** `SafeWritePlan` | `true` when commit succeeds | Sandbox marker + `ALLOW_LEGACY_WRITES` ack + `BACKUP_DIR` required; persists **only** `SCHEDULE.STATUS` after backup + verification |

`DATA_ROOT` must be configured for `dry-run` / `enabled` (else **503** `DATA_ROOT_NOT_CONFIGURED`).

Per-request sandbox checks apply even when `writesPermitted` is true at startup (see [phase-3-sandbox-guard.md](./phase-3-sandbox-guard.md)).

Clients may send `X-Write-Intent: dry-run` or `commit`. Global `WRITE_MODE=dry-run` always returns a plan with `committed: false`. When `WRITE_MODE=enabled`, `X-Write-Intent: dry-run` rehearses without backup or DBF mutation; `commit` (or omitted header) runs the enabled commit path when sandbox gates pass.

---

## Validation

- **`appointmentId`** — positive integer string, no leading zeros (`^[1-9]\d{0,14}$`).
- **`status`** — integer **0–5** inclusive.
- **Existence** — scans `SCHEDULE.DBF` until `ID` matches; does not return row values or expose `PAT_NAME`, `TELEPHONE`, `COMMENT`, or notes.

---

## Safe write plan (status update)

On success, the plan includes:

| Field | Value |
| --- | --- |
| `workflow` | `appointment.statusUpdate` |
| `mode` | `dry-run` or `enabled` (matches bridge `WRITE_MODE` for this request) |
| `tablesAffected` | `["SCHEDULE"]` |
| `recordIds` | `[appointmentId]` |
| `fieldsChanged` | one entry: `field: "STATUS"`, `changeType: "set"` |
| `backupRequired` | `true` |
| `committed` | `false` in dry-run; `true` after successful enabled commit |

No `before` / `after` values are included.

---

## Errors

| Code | HTTP | When |
| --- | --- | --- |
| `WRITE_MODE_DISABLED` | 403 | `WRITE_MODE` is `disabled` or unset |
| `DATA_ROOT_NOT_CONFIGURED` | 503 | `DATA_ROOT` missing (dry-run / enabled only) |
| `INVALID_APPOINTMENT_ID` | 400 | Bad path id |
| `INVALID_APPOINTMENT_STATUS` | 400 | Status not an integer 0–5 |
| `INVALID_REQUEST_BODY` | 400 | Body not `{ status: number }` |
| `SCHEDULE_DBF_NOT_FOUND` | 404 | No schedule file under `DATA_ROOT` |
| `SCHEDULE_APPOINTMENT_NOT_FOUND` | 404 | Id not found in schedule |
| `SCHEDULE_APPOINTMENTS_ERROR` | 500 | Read failure |
| `WRITE_BACKUP_NOT_CONFIGURED` | 503 | Enabled commit without `BACKUP_DIR` |
| `WRITE_BACKUP_FAILED` | 503 | Backup failed before write |

---

## Tests

Bridge tests use **synthetic** fixtures only:

- `services/bridge/src/appointment-status-dry-run.test.ts` — disabled / dry-run plan, mtime unchanged, no PHI tokens
- `services/bridge/src/appointment-status-write.test.ts` — enabled sandbox commit, STATUS-only mutation, sidecar invariants

---

## Related

- [phase-3-appointment-status-write-runbook.md](./phase-3-appointment-status-write-runbook.md)
- [phase-3-dry-run-write-plan.md](./phase-3-dry-run-write-plan.md)
- [phase-3-appointment-write-mapping.md](./phase-3-appointment-write-mapping.md)
