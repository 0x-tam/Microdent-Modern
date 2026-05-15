# Phase 2 — SQLite read routes (bridge)

**Status:** Implemented for low-risk GET routes when `SQLITE_PATH` is configured.

**Routes:**

| Route | Mirror table | DBF fallback source |
| --- | --- | --- |
| `GET /v1/reference/doctors` | `doctors` | `DOCTORS.DBF` |
| `GET /v1/reference/procedures` | `procedures` | `PROCCHRT.DBF` |
| `GET /v1/patients/search` | `patients` (`search_blob`) | `PATIENT.DBF` scan |
| `GET /v1/patients/:patientId/medical-summary` | `medical_summary` | `MEDICAL.DBF` |
| `GET /v1/patients/:patientId/profile` | `patients` (profile columns) | `PATIENT.DBF` by `ID` |

The React app and `@microdent/contracts` response shapes are unchanged. The bridge maps mirror columns to the same DTOs as DBF readers; raw SQLite rows and extra columns are never exposed.

---

## Configuration

| Variable | Required | Meaning |
| --- | --- | --- |
| `DATA_ROOT` | Yes (for these routes) | Absolute path to copied legacy `DATA/` (unchanged) |
| `SQLITE_PATH` | No | Absolute path to mirror `.sqlite` file from importers |

When `SQLITE_PATH` is unset or whitespace, behavior is **identical to Phase 1b** (DBF only).

When `SQLITE_PATH` is set, it must be an **absolute** path (same rule as `DATA_ROOT`).

Populate the mirror with existing importers (`importDoctors`, `importProcedures`, `importPatients`, `importMedicalSummary`, …) before expecting SQLite-backed responses.

Medical summary details: `docs/phase-2-sqlite-medical-summary-route.md`.

---

## Read path selection

For each request on the routes above:

1. If `SQLITE_PATH` is **not configured** → read DBF only.
2. If configured but the file is **missing**, **not openable**, or the route’s table is **absent** in `sqlite_master` → **fallback to DBF** (see below).
3. If the mirror is **usable** → read SQLite and return mapped DTOs.
4. If SQLite open/query **fails** at runtime → **fallback to DBF**.

### Invalid / unavailable mirror: **DBF fallback** (chosen behavior)

We **do not** return `MIRROR_UNAVAILABLE` on these routes. Rationale:

- These endpoints are **low-risk reference/search** reads already backed by DBF.
- A misconfigured or stale mirror should not block clinic UI when `DATA_ROOT` is healthy.
- Operators can fix `SQLITE_PATH` or re-import without a hard outage.

`MIRROR_UNAVAILABLE` remains reserved for future routes where SQLite is the only supported read model.

---

## DTO mapping (mirror → API)

**Doctors:** `doctor_id` → `doctorId`, `display_label` → `displayName`, `active` (0/1/null) → `active`. Rows with `source_deleted = 1` are omitted.

**Procedures:** `procedure_code`, `label` (→ `displayName`, null when label equals code), `procedure_class` → `category`, `category_code`, `class_id`, `chart_flag` → `chartRelevant`. Price/fee columns are not stored in the mirror.

**Patient search:** Same token rules as DBF (`search_blob` LIKE per word, max 20 rows). Returns `patientId`, `chartNumber`, `displayName`, `phoneMask` only.

**Patient profile:** One row by `patient_id` where `source_deleted = 0`. Returns the same nine safe fields as the DBF profile reader. See [phase-2-sqlite-patient-profile-route.md](./phase-2-sqlite-patient-profile-route.md).

---

## Tests

`services/bridge/src/sqlite-read-routes.test.ts` builds synthetic DBFs, runs `@microdent/sqlite-mirror` importers into a temp database, and asserts HTTP responses match contract schemas. Includes fallback when the configured SQLite file does not exist.

---

## Operational notes

- Re-import after refreshing `Microdent-Legacy-Copy`; the bridge does not auto-sync DBF → SQLite.
- Requires **Node 22.5+** for `node:sqlite` (`DatabaseSync`).
