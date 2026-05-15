# Phase 2.2 — Safe patient SQLite importer

**Status:** Implemented in `@microdent/sqlite-mirror`.

**Scope:** Batch import of **safe patient fields only** from copied `PATIENT.DBF` into the SQLite mirror. No bridge read-path switch yet; no UI changes.

---

## API

```ts
import { importPatients } from "@microdent/sqlite-mirror";

const result = await importPatients({
  dataRoot: "/absolute/path/to/copied/DATA",
  sqlitePath: "/absolute/path/to/MICRODENT_MIRROR.sqlite",
  trigger: "cli", // optional: cli | manual | scheduled
});
```

- Applies pending schema migrations before import.
- Creates an `import_runs` row (`running` → terminal status).
- On row-level issues, appends sanitized rows to `import_errors` (no cell values).
- Replaces all rows in `patients` on each successful transaction (full table refresh for this band).

---

## Imported fields

| Mirror column | JSON / API name | `PATIENT.DBF` source |
| --- | --- | --- |
| `patient_id` | `patientId` | `ID` |
| `chart_number` | `chartNumber` | `CASENB` |
| `display_name` | `displayName` | `NAME`, else `FIRST_NAME` + `LAST_NAME`, else `REV_NAME`, else `Patient {id}` |
| `reverse_name` | `reverseName` | `REV_NAME` |
| `phone_mask` | `phoneMask` | `HOME_PHONE`, else `MOBILE` — **last four digits only** |
| `active` | `active` | `ACTIVE` (FoxPro logical) |
| `doctor_id` | `doctorId` | `DOCTOR_NB` |
| `entry_date` | `entryDate` | `ENTRY_DATE` |
| `last_visit` | `lastVisit` | `LASTVISIT` |
| `search_blob` | (internal) | Lowercase join of `ID`, `CASENB`, `NAME`, `REV_NAME`, `FIRST_NAME`, `LAST_NAME` |
| `source_deleted` | — | DBF soft-delete flag |
| `imported_at` | — | ISO-8601 at import time |

Mapping logic matches `services/bridge/src/dbf/patient-dbf-helpers.ts` (duplicated in `patient-field-map.ts` to avoid coupling packages).

---

## Blocked fields (never imported or logged)

- Full phone numbers (`HOME_PHONE`, `MOBILE` raw values)
- Address block (`STREET`, `CITY`, `STATE`, `ZIP`, …)
- `EMAIL`, employer, insurance, `SS`, `DL`
- Memos (`QUICKNOTE`, `PAT_M_COMP`, any `M` column body)
- Medical, payments, treatments, ledger columns
- Notes / memos / free text
- Raw DBF row objects or arbitrary column maps

Importer opens `PATIENT.DBF` with `readMode: 'loose'` and does **not** rely on memo payloads for mapping.

---

## Schema migration

`003_patients_profile_columns.sql` adds profile columns to `patients`:

- `reverse_name`, `active`, `doctor_id`, `entry_date`, `last_visit`

---

## Tests

`services/sqlite-mirror/src/import-patients.test.ts` uses **synthetic** `PATIENT.DBF` fixtures only (fake tokens). Asserts:

- Safe field values for a known id
- `import_runs` / `import_errors` audit rows
- SQLite dump does **not** contain decoy street, email, full phone, or memo tokens

Requires **Node ≥ 22.5** (built-in `node:sqlite`).

---

## Operator notes

- Point `dataRoot` at **Microdent-Legacy-Copy** `DATA/` only — never production `Microdent-Legacy`.
- Do not commit mirror `.sqlite` files or real copy paths.
- Re-run `importPatients` after refreshing the DBF copy; each run replaces `patients` contents.

---

## Related docs

- `docs/phase-2-sqlite-schema.md` — migrations and driver decision
- `docs/phase-2-sqlite-mirror-plan.md` — full Phase 2 architecture
- `docs/phase-1b-patient-search-backend.md` — search DTO allowlist
- `docs/phase-1b-patient-profile-backend.md` — profile DTO allowlist
