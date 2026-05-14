# Phase 1b — Calendar / schedule (backend only)

Read-only **`GET /v1/schedule/rooms`** and **`GET /v1/schedule/appointments`** read **`SC_ROOM.DBF`**, optional **`DICSCHED.DBF`**, **`SCHEDULE.DBF`**, and (for appointments only) **`PATIENT.DBF`** under **`DATA_ROOT`**. This band is **API + contracts + bridge client + tests only** — no calendar UI.

## Routes

### `GET /v1/schedule/rooms`

- **503** if `DATA_ROOT` is not configured.
- **404** with `SC_ROOM_DBF_NOT_FOUND` if **`SC_ROOM.DBF`** is absent.
- **500** with `SCHEDULE_ROOMS_ERROR` on unexpected read failures (no row payloads in the message).

Reads **`DICSCHED.DBF`** when present: **first non-deleted row only**, fields **`ROOM1`–`ROOM25`** (trimmed strings) as display labels keyed by room index — no other DICSCHED columns are returned.

### `GET /v1/schedule/appointments?from=YYYY-MM-DD&to=YYYY-MM-DD&room=optional`

- **503** if `DATA_ROOT` is not configured.
- **400** with `INVALID_SCHEDULE_QUERY` if **`from`** / **`to`** are missing, invalid calendar dates, **`from` > `to`**, inclusive range **longer than 14 days**, or **`room`** is not a digit-only integer string.
- **404** with `SCHEDULE_DBF_NOT_FOUND` if **`SCHEDULE.DBF`** is absent.
- **500** with `SCHEDULE_APPOINTMENTS_ERROR` on unexpected read failures.

Scans **`SCHEDULE.DBF`** sequentially (skips soft-deleted rows), filters by **`DATE`** inclusive in `[from, to]` (UTC date-only comparison on decoded FoxPro `D` fields), optional numeric **`ROOM`** filter, and stops after **1000** matching appointments. Then collects distinct non-zero **`PAT_ID`** values from those rows and performs **one** additional sequential scan of **`PATIENT.DBF`** (skips deleted rows), stopping early once every requested id has been resolved. Each appointment JSON includes a **`patient`** object or **`null`**; names are **never** taken from **`SCHEDULE.PAT_NAME`**.

## Contracts (`@microdent/contracts`)

- **`ScheduleRoomsResponseSchema`** / **`ScheduleRoomItemSchema`** / **`ScheduleRoomActiveDaysSchema`**
- **`ScheduleAppointmentsResponseSchema`** / **`ScheduleAppointmentItemSchema`** / **`ScheduleAppointmentPatientSummarySchema`**
- **`ScheduleAppointmentsQuerySchema`** — validates **`from`**, **`to`**, optional **`room`**, and **14-day inclusive** span cap.

## Room response fields

| JSON field | Source | Notes |
| --- | --- | --- |
| `room` | `SC_ROOM.ROOM` | Integer chair/column index. |
| `displayName` | `DICSCHED.ROOM{n}` (first row) | `null` if missing or blank after trim. |
| `activeDays` | `SC_ROOM.DAY1` … `DAY7` | Booleans; **DAY1 = Sunday … DAY7 = Saturday** per `docs/phase-1b-calendar-mapping.md` (legacy UI order not fully proven). |
| `doctorId` | `SC_ROOM.DOCT` | `null` when `0` or missing. |

## Appointment response fields

| JSON field | Source (SCHEDULE) | Notes |
| --- | --- | --- |
| `id` | `ID` | Stringified. |
| `date` | `DATE` | `YYYY-MM-DD` (UTC calendar components). |
| `time` | `TIME` | Trimmed character field; not parsed to ISO clock in this pass. |
| `durationSlots` | `DURATION` | Slot count. |
| `periodMinutes` | `PERIOD` | `null` when `0` or missing; clients may assume **30** when null (common default in replacement tooling — not enforced here). |
| `room` | `ROOM` | Integer. |
| `status` | `STATUS` | Opaque integer; replacement script documents 0–5 — legacy may differ. |
| `docId` | `DOC_ID` | Integer. |
| `patId` | `PAT_ID` | Stringified numeric key; unchanged from the schedule row. |
| `patient` | `PATIENT.DBF` (by `ID` = `patId`) | **`null`** when `patId` is zero, when **`PATIENT.DBF`** is missing, or when no row matches. Otherwise **`{ patientId, displayName, chartNumber }`** only — same safe derivation as patient search (`NAME`, or `FIRST_NAME` + `LAST_NAME`, or `REV_NAME`, else `Patient {id}`), chart from **`CASENB`**. **No `phoneMask`** on schedule appointments. |
| `procClass` | `PROC_CLASS` | Integer. |
| `vacId` | `VAC_ID` | Integer. |
| `recall` | `RECALL` | Integer. |
| `unreason` | `UNREASON` | Integer. |
| `missed` | `MISSED` | Boolean from FoxPro logical. |
| `hasComment` | `COMMENT` | **Boolean only** — memo/text body is never returned. |

## Intentionally blocked (never returned)

- **`SCHEDULE.PAT_NAME`** is **not** read for the API (patient display names come only from **`PATIENT.DBF`** as above).
- **`TELEPHONE`**, **`COMMENT`** body, **`CASENUM`**, raw DBF row maps, arbitrary **`DICSCHED`** strings outside **`ROOM1`–`ROOM25`** on the first row.
- No masked phone field on schedule appointment items (unlike **`GET /v1/patients/search`** hits).

Logs and error responses do **not** include appointment row payloads.

## Bridge client (`@microdent/bridge-client`)

- **`getScheduleRooms()`** → `GET /v1/schedule/rooms`
- **`getScheduleAppointments({ from, to, room? })`** → `GET /v1/schedule/appointments?...`

## Date range rule

**Inclusive** calendar days between **`from`** and **`to`** must be **≤ 14** (e.g. same-day query = 1 day; **15** inclusive days returns **400**).

## Automated tests

Bridge **`schedule-routes.test.ts`** builds **synthetic** `SC_ROOM`, `DICSCHED`, `SCHEDULE`, and `PATIENT` DBFs in a temp directory (fake tokens only — no real PHI). Covers rooms success, appointments success + resolved **`patient`** summaries + privacy strings absent in JSON, missing **`PATIENT.DBF`** (all **`patient`:** **`null`**), date validation, 14-day cap, 1000-row cap, missing files, missing `DATA_ROOT`, and room filter.

Bridge-client tests cover URL construction for appointments.

## Running against a copied `DATA_ROOT`

```bash
export DATA_ROOT="/Users/Tamam/Desktop/Microdent/Microdent-Legacy-Copy/DATA"
# start the bridge (see repo README), then:
curl -sS "http://127.0.0.1:17890/v1/schedule/rooms" | jq .
curl -sS "http://127.0.0.1:17890/v1/schedule/appointments?from=2026-01-05&to=2026-01-11" | jq .
```

Use a **short, non-overlapping** date window on a **copy** of data; do not paste JSON containing identifiers into public tickets.

## Semantics uncertainty (short)

- **`TIME`** padding and non-`HH:MM` variants are accepted as trimmed strings only.
- **`STATUS`** values beyond the six documented in `schedule_replacement.py` are passed through unchanged.
- **`DAY1`–`DAY7` weekday order** follows the mapping doc’s assumption; confirm against legacy UI if labels shift.
- **`DICSCHED`**: only the **first** active row is read for **`ROOMn`**; alternate language rows are ignored in this pass.
- **`COMMENT`** as true VFP memo (`M` + FPT): `hasComment` uses non-emptiness without returning text; memo read failures are treated as “no comment” if the field cannot be evaluated without errors (conservative for privacy).
