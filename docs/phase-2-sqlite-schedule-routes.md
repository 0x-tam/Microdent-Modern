# Phase 2 — SQLite schedule appointment read routes

**Status:** Implemented for `GET /v1/schedule/appointments` and `GET /v1/patients/:patientId/appointments` when `SQLITE_PATH` is configured.

**Routes:**

| Route | Mirror table | Patient summaries | DBF fallback |
| --- | --- | --- | --- |
| `GET /v1/schedule/appointments` | `appointments` | `LEFT JOIN patients` on `patient_id` | `SCHEDULE.DBF` + `PATIENT.DBF` lookup |
| `GET /v1/patients/:patientId/appointments` | `appointments` (filtered by `patient_id`) | same join | same |

Response shapes and query validation are unchanged (14-day inclusive cap on schedule; 365-day cap on patient history; optional `room` on schedule only).

---

## Configuration

| Variable | Required | Meaning |
| --- | --- | --- |
| `DATA_ROOT` | Yes | Copied legacy `DATA/` (still required for route availability and DBF fallback) |
| `SQLITE_PATH` | No | Absolute path to mirror `.sqlite` from importers |

When `SQLITE_PATH` is unset or whitespace → **DBF only** (Phase 1b behavior).

Populate appointments with `importAppointments` and patients with `importPatients` before expecting joined summaries from the mirror.

---

## Read path selection

1. `SQLITE_PATH` **not configured** → DBF scan + `PATIENT.DBF` summary merge.
2. Configured but file **missing**, **not openable**, or **`appointments` table absent** → DBF fallback.
3. Mirror **usable** → SQL read with filters; patient block from `patients` when joined.
4. SQLite query **fails** at runtime → DBF fallback.

Invalid or stale mirrors do **not** return `MIRROR_UNAVAILABLE`; clinic UI keeps working from DBF when `DATA_ROOT` is healthy.

---

## DTO mapping (mirror → API)

Same safe appointment DTO as DBF (`ScheduleAppointmentItem`):

| Mirror column | API field |
| --- | --- |
| `appointment_id` | `id` |
| `appointment_date` | `date` |
| `start_time` | `time` |
| `duration_slots` | `durationSlots` |
| `period_minutes` | `periodMinutes` (null when 0/missing) |
| `room_id` | `room` |
| `status_code` | `status` |
| `doctor_id` | `docId` (0 when null) |
| `patient_id` | `patId` (`"0"` when null) |
| `proc_class` | `procClass` |
| `vac_id` | `vacId` |
| `recall` | `recall` |
| `unreason` | `unreason` |
| `missed` | `missed` |
| `has_comment` | `hasComment` |

**Patient join** (`patients` row, `source_deleted = 0`): `patientId`, `displayName`, `chartNumber` only. No `phoneMask` on appointments.

Rows with `appointments.source_deleted = 1` are omitted (aligned with DBF soft-delete skip).

---

## Blocked fields (never returned)

- `SCHEDULE.PAT_NAME` / schedule name columns (not in mirror)
- `TELEPHONE`
- `COMMENT` text (only `hasComment` boolean)
- `CASENUM`
- Raw SQLite rows or extra mirror columns on the wire

---

## Filters preserved

| Filter | Schedule route | Patient route |
| --- | --- | --- |
| `from` / `to` | Required; max 14 inclusive days | Required; max 365 inclusive days |
| `room` | Optional integer | N/A |
| `patientId` | N/A | Path param |

Max **1000** appointments per response (schedule route).

---

## Implementation

- `services/bridge/src/sqlite/schedule-appointments.ts` — mirror read + join
- `services/bridge/src/schedule-appointments-read.ts` — SQLite vs DBF coordinator
- `services/bridge/src/routes/v1.ts` — route wiring

---

## Tests

`services/bridge/src/sqlite-schedule-routes.test.ts` — synthetic fixtures from `test-fixtures/schedule-fixtures.ts`, `importAppointments` + `importPatients`, HTTP contract checks, DBF fallback when mirror file missing, mirror-only when `SCHEDULE.DBF` absent under `DATA_ROOT`.

---

## Operational notes

- Re-import after refreshing copied data; the bridge does not auto-sync DBF → SQLite.
- Requires **Node 22.5+** for `node:sqlite` (`DatabaseSync`).
- Today dashboard, Schedule panel, and Patient Appointments UI consume the same endpoints; no client changes required when enabling `SQLITE_PATH`.
