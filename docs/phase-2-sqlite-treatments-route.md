# Phase 2 — SQLite-backed patient treatments route

**Status:** Implemented for `GET /v1/patients/:patientId/treatments` when `SQLITE_PATH` is configured.

**Mirror table:** `treatments` (from `importTreatments` in `@microdent/sqlite-mirror`).

**DBF fallback:** `OPERTBL.DBF` (+ `PROCCHRT.DBF` / `DOCTORS.DBF` label joins), same as Phase 1b.

The React **Treatments** tab and `@microdent/contracts` `PatientTreatmentsResponse` shape are unchanged.

---

## Configuration

| Variable | Required | Meaning |
| --- | --- | --- |
| `DATA_ROOT` | Yes | Absolute path to copied legacy `DATA/` |
| `SQLITE_PATH` | No | Absolute path to mirror `.sqlite` from importers |

When `SQLITE_PATH` is unset or whitespace → **DBF only** (Phase 1b behavior).

Populate the mirror before expecting SQLite-backed responses:

1. `importProcedures` and `importDoctors` (label resolution at import time)
2. `importTreatments` (safe OPERTBL fields only)

Or run the bundled safe import command documented in `docs/phase-2-mirror-import-command.md`.

Requires **Node 22.5+** for `node:sqlite` (`DatabaseSync`).

---

## Read path selection

1. `SQLITE_PATH` **not configured** → read DBF only.
2. Configured but file **missing**, **not openable**, or `treatments` **absent** in `sqlite_master` → **fallback to DBF**.
3. Mirror **usable** → read SQLite, map to `PatientTreatmentsResponse`.
4. SQLite query **fails** at runtime → **fallback to DBF**.

No `MIRROR_UNAVAILABLE` on this route — a bad mirror must not block the UI when `DATA_ROOT` is healthy.

---

## DTO mapping (mirror → API)

| Mirror column | API field |
| --- | --- |
| `treatment_id` | `treatmentId` |
| `patient_id` | `patientId` |
| `treatment_date` | `date` |
| `tooth` | `tooth` |
| `procedure_code` | `procedureCode` |
| `procedure_label` | `procedureLabel` |
| `doctor_id` | `doctorId` |
| `doctor_label` | `doctorLabel` |
| `status` | `status` |
| `has_description` (0/1) | `hasDescription` |

Response envelope: `truncated`, `privacyNote` (same literal as DBF path).

Rows with `source_deleted = 1` are omitted. Mirror-only columns (`imported_at`, `source_deleted`) are never returned on the wire.

**Never exposed:** `DESCRIPT`, `DESC`, memo text, fees, charges, payments, insurance, raw SQLite rows.

---

## Cap and sort

- **Cap:** `PATIENT_TREATMENTS_MAX` (200) per patient. `truncated` is true when more than 200 non-deleted mirror rows exist for the patient.
- **Selection order:** first 200 rows by SQLite `rowid` ASC (matches OPERTBL import/scan order).
- **Wire order:** same sort as DBF — newest `date` first, then descending `treatmentId`.

---

## Tests

`services/bridge/src/patient-treatments-routes.test.ts`:

- Synthetic `OPERTBL.DBF` + migrations + `importTreatments` into a temp database
- Asserts safe fields, cap/truncated, privacy (no secrets in JSON)
- Fallback when configured SQLite file is missing
- DBF-only when `SQLITE_PATH` is unset

---

## Operational notes

- Re-import treatments after refreshing `Microdent-Legacy-Copy`; the bridge does not auto-sync.
- Stale or empty mirror with a valid `treatments` table returns an empty list (not DBF fallback) until import is run again.
