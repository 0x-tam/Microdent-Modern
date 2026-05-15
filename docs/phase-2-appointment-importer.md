# Phase 2.3 — Safe appointment SQLite importer

**Status:** Implemented in `@microdent/sqlite-mirror`.

**Scope:** Batch import of **safe appointment fields only** from copied `SCHEDULE.DBF` into the SQLite mirror. No bridge read-path switch yet; no UI changes.

---

## API

```ts
import { importAppointments } from "@microdent/sqlite-mirror";

const result = await importAppointments({
  dataRoot: "/absolute/path/to/copied/DATA",
  sqlitePath: "/absolute/path/to/MICRODENT_MIRROR.sqlite",
  trigger: "cli", // optional: cli | manual | scheduled
});
```

- Applies pending schema migrations before import.
- Creates an `import_runs` row (`running` → terminal status).
- On row-level issues, appends sanitized rows to `import_errors` (no cell values).
- Replaces all rows in `appointments` on each successful transaction (full table refresh for this band).

---

## Imported fields

| Mirror column | JSON / API name | `SCHEDULE.DBF` source |
| --- | --- | --- |
| `appointment_id` | `appointmentId` | `ID` |
| `appointment_date` | `date` | `DATE` (UTC `YYYY-MM-DD`) |
| `start_time` | `time` | `TIME` |
| `duration_slots` | `durationSlots` | `DURATION` |
| `period_minutes` | `periodMinutes` | `PERIOD` when &gt; 0, else `NULL` |
| `room_id` | `room` | `ROOM` |
| `status_code` | `status` | `STATUS` |
| `doctor_id` | `docId` | `DOC_ID` (null when 0) |
| `patient_id` | `patientId` | `PAT_ID` (null when 0) |
| `proc_class` | `procClass` | `PROC_CLASS` |
| `vac_id` | `vacId` | `VAC_ID` |
| `recall` | `recall` | `RECALL` |
| `unreason` | `unreason` | `UNREASON` |
| `missed` | `missed` | `MISSED` (FoxPro logical) |
| `has_comment` | `hasComment` | derived from `COMMENT` presence only |
| `source_deleted` | — | DBF soft-delete flag |
| `imported_at` | — | ISO-8601 at import time |

Mapping logic matches `services/bridge/src/dbf/schedule-appointments.ts` (duplicated in `appointment-field-map.ts` to avoid coupling packages).

`end_time` and `source_row_hash` are left unused (no end-time derivation; no raw-row hashing).

---

## Blocked fields (never imported or logged)

- `PAT_NAME`
- `TELEPHONE`
- `COMMENT` body (only boolean `has_comment`)
- `CASENUM`
- Raw DBF row objects or arbitrary column maps

Importer opens `SCHEDULE.DBF` with `readMode: 'loose'` and does **not** persist memo text.

---

## Schema migration

`004_appointments_safe_fields.sql` adds schedule DTO columns to `appointments`:

- `duration_slots`, `period_minutes`, `proc_class`, `vac_id`, `recall`, `unreason`, `missed`, `has_comment`

---

## Tests

`services/sqlite-mirror/src/import-appointments.test.ts` uses **synthetic** `SCHEDULE.DBF` fixtures only (fake tokens). Asserts:

- Safe field values for known ids
- `import_runs` / `import_errors` audit rows
- SQLite dump does **not** contain decoy name, phone, comment, or casenum tokens

Requires **Node ≥ 22.5** (built-in `node:sqlite`).

---

## Operator notes

- Point `dataRoot` at **Microdent-Legacy-Copy** `DATA/` only — never production `Microdent-Legacy`.
- Do not commit mirror `.sqlite` files or real copy paths.
- Re-run `importAppointments` after refreshing the DBF copy; each run replaces `appointments` contents.

---

## Related docs

- `docs/phase-2-sqlite-schema.md` — migrations and driver decision
- `docs/phase-2-sqlite-mirror-plan.md` — full Phase 2 architecture
- `docs/phase-1b-calendar-backend.md` — schedule appointment DTO allowlist
