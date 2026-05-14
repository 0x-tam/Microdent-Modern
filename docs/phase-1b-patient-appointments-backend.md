# Phase 1b — Patient appointment history (backend)

Read-only API to load a **single patient’s** appointments from `SCHEDULE.DBF` for use by the patient profile screen later. This reuses the **same safe appointment DTO** as the calendar schedule band.

## Route

**`GET /v1/patients/:patientId/appointments?from=YYYY-MM-DD&to=YYYY-MM-DD`**

### Why this shape (not extending `GET /v1/schedule/appointments`)

- **Calendar** queries stay capped at **14 inclusive days** with an optional **room** filter — tuned for the schedule grid.
- **Patient history** needs a **wider window (up to 365 inclusive days)** and is always scoped to one patient. A dedicated sub-resource under `/v1/patients/...` keeps validation, limits, and product meaning clear without overloading the schedule endpoint with two different range rules.

## Query parameters

| Param | Required | Notes |
|-------|------------|--------|
| `from` | yes | `YYYY-MM-DD`, valid calendar date |
| `to` | yes | `YYYY-MM-DD`, on or after `from` |

## Path parameter

- **`patientId`** — same rule as **`GET /v1/patients/:patientId/profile`**: positive integer string, **no leading zeros** (`^[1-9]\d{0,14}$`).

## Date range limits

- **Inclusive** day span must be **≤ 365** calendar days.
- **`from` > `to`** → `400` with `INVALID_PATIENT_APPOINTMENTS_QUERY`.

## HTTP responses

| Status | When |
|--------|------|
| **200** | Success; body `{ "appointments": [...] }` |
| **400** | Invalid `patientId` → `INVALID_PATIENT_ID`; invalid/missing `from`/`to` or range → `INVALID_PATIENT_APPOINTMENTS_QUERY` |
| **404** | `SCHEDULE.DBF` missing under `DATA_ROOT` → `SCHEDULE_DBF_NOT_FOUND` |
| **500** | DBF open/parse failure → `PATIENT_APPOINTMENTS_ERROR` (generic message; no row logging) |
| **503** | `DATA_ROOT` not configured → `DATA_ROOT_NOT_CONFIGURED` |

## Fields returned (safe DTO)

Same as schedule appointments: `id`, `date`, `time`, `durationSlots`, `periodMinutes`, `room`, `status`, `docId`, `patId`, `patient` (safe summary from `PATIENT.DBF` when present), `procClass`, `vacId`, `recall`, `unreason`, `missed`, `hasComment`.

## Fields blocked / never returned

- `PAT_NAME` from `SCHEDULE.DBF`
- `TELEPHONE` from schedule rows
- `COMMENT` **content** (only `hasComment` boolean)
- `CASENUM` / case identifiers from schedule
- Raw DBF rows or memo bodies

Patient summaries on the wire follow the schedule contract: **no** `phoneMask` on appointment payloads.

## Privacy and safety

- Responses are built through **`rowToAppointment`** + **`mergePatientSummariesIntoScheduleAppointments`** only; schedule name/phone/comment text are not mapped into JSON.
- Errors do not embed parser internals or row dumps.
- **No writes** and no appointment editing.

## Bridge client

- **`getPatientAppointments(patientId, { from, to })`** — validates `patientId` and date range locally (same Zod rules as the server) then calls the route above.

## Connecting to patient profile UI (later)

1. Load profile with **`getPatientProfile(patientId)`** (existing).
2. Load history with **`getPatientAppointments(patientId, { from, to })`** using a window the product chooses (≤ 365 days).
3. Render the appointment list from the safe DTO only; do not add notes or schedule `PAT_NAME`.

## Patient id matching (`PAT_ID`)

The bridge normalizes **`SCHEDULE.PAT_ID`** to a string (numeric → truncated decimal string, otherwise trimmed). It is compared to the path **`patientId`** with **strict string equality** after path validation.

**Uncertainty:** If legacy data stores `PAT_ID` with **leading zeros** or **non-numeric** forms that do not match the canonical profile id string, those rows **will not** match the API path id even when they refer to the same person. Aligning legacy cleanup or normalization would be a data migration concern, not something this read-only API invents at response time.
