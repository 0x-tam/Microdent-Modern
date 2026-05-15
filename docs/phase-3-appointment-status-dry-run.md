# Phase 3 — Appointment status dry-run route

**Status:** Implemented — plan-only mutation; **no DBF writes**.

**Route:** `PATCH /v1/schedule/appointments/:appointmentId/status`

**Body:** `{ "status": <integer> }` where `status` is **0–5** (opaque legacy codes).

**Response:** `SafeWritePlan` JSON (see `@microdent/contracts`). Always `committed: false` in this band.

---

## Write mode behavior

| `WRITE_MODE` | HTTP | Notes |
| --- | --- | --- |
| unset / `disabled` | **403** `WRITE_MODE_DISABLED` | No `DATA_ROOT` read; no plan |
| `dry-run` | **200** `SafeWritePlan` | Validates id + status; confirms row exists in `SCHEDULE.DBF` read-only |
| `enabled` | **200** `SafeWritePlan` | Same as dry-run; adds warning `REAL_WRITE_NOT_IMPLEMENTED`; still **no** file changes |

`DATA_ROOT` must be configured for `dry-run` / `enabled` (else **503** `DATA_ROOT_NOT_CONFIGURED`).

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
| `committed` | `false` |

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

---

## Tests

Bridge tests (`services/bridge/src/appointment-status-dry-run.test.ts`) use **synthetic** fixtures only:

- disabled → 403, mtime unchanged
- dry-run → 200 plan, `committed: false`, no PHI tokens in JSON, mtime unchanged
- enabled → 200 plan + `REAL_WRITE_NOT_IMPLEMENTED`, mtime unchanged
- invalid status → 400
- missing appointment → 404
- `SCHEDULE.DBF` mtime unchanged after each case

---

## Related

- [phase-3-dry-run-write-plan.md](./phase-3-dry-run-write-plan.md)
- [phase-3-appointment-write-mapping.md](./phase-3-appointment-write-mapping.md)
