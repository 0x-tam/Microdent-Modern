# Phase 2 — SQLite patient profile route

**Status:** Implemented for `GET /v1/patients/:patientId/profile` when `SQLITE_PATH` is configured.

**Route:** `GET /v1/patients/:patientId/profile`  
**Mirror table:** `patients` (safe profile columns only)  
**DBF fallback:** `PATIENT.DBF` (unchanged Phase 1b reader)

The response shape and `@microdent/contracts` schema are unchanged. The bridge maps mirror columns to the same DTO as the DBF reader; raw SQLite rows, `search_blob`, and non-safe columns are never exposed.

---

## Configuration

| Variable | Required | Meaning |
| --- | --- | --- |
| `DATA_ROOT` | Yes | Absolute path to copied legacy `DATA/` |
| `SQLITE_PATH` | No | Absolute path to mirror `.sqlite` from `importPatients` |

When `SQLITE_PATH` is unset or whitespace, behavior is **identical to Phase 1b** (DBF only).

Populate profile fields in the mirror with `importPatients` (migration `003_patients_profile_columns` adds `reverse_name`, `active`, `doctor_id`, `entry_date`, `last_visit`).

---

## Read path selection

1. If `SQLITE_PATH` is **not configured** → read `PATIENT.DBF` only.
2. If configured but the file is **missing**, **not openable**, or the `patients` table is **absent** → **fallback to DBF**.
3. If the mirror is **usable** → `SELECT` one non-deleted row by `patient_id`; map to `PatientProfileResponse`.
4. If SQLite open/query **fails** at runtime → **fallback to DBF**.
5. If SQLite returns **no row** for the id → `404 PATIENT_NOT_FOUND` (no DBF fallback).

Invalid or unavailable mirrors use **DBF fallback**, same as reference/search SQLite routes (no `MIRROR_UNAVAILABLE` on this endpoint).

---

## Fields returned (unchanged)

| JSON field | Mirror column |
| --- | --- |
| `patientId` | `patient_id` |
| `chartNumber` | `chart_number` |
| `displayName` | `display_name` |
| `phoneMask` | `phone_mask` |
| `reverseName` | `reverse_name` |
| `active` | `active` (0/1 → boolean; `null` when unreadable) |
| `doctorId` | `doctor_id` |
| `entryDate` | `entry_date` |
| `lastVisit` | `last_visit` |

**Not exposed:** full phone, address, email, employer, insurance, notes/memos, `search_blob`, or any other mirror column.

---

## Tests

`services/bridge/src/sqlite-patient-profile-routes.test.ts` builds a synthetic `PATIENT.DBF`, runs `importPatients` into a temp database (migrations applied), and asserts HTTP responses match `PatientProfileResponseSchema`. Includes DBF fallback when the configured SQLite file is missing and DBF-only mode when `SQLITE_PATH` is unset.

Existing DBF-only coverage remains in `services/bridge/src/patient-profile-routes.test.ts`.

---

## Related docs

- [phase-1b-patient-profile-backend.md](./phase-1b-patient-profile-backend.md) — DBF field sources and error codes
- [phase-2-sqlite-read-routes.md](./phase-2-sqlite-read-routes.md) — shared SQLite read/fallback pattern for other routes
