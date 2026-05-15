# Phase 2.5 — Safe medical summary SQLite importer

**Status:** Implemented in `@microdent/sqlite-mirror`.

**Scope:** Batch import of the same conservative medical summary as `GET /v1/patients/:patientId/medical-summary` from copied `MEDICAL.DBF` into the `medical_summary` mirror table. No bridge read-path switch yet; no UI changes.

---

## API

```ts
import { importMedicalSummary } from "@microdent/sqlite-mirror";

const result = await importMedicalSummary({
  dataRoot: "/absolute/path/to/copied/DATA",
  sqlitePath: "/absolute/path/to/MICRODENT_MIRROR.sqlite",
  trigger: "cli", // optional: cli | manual | scheduled
});
```

- Applies pending schema migrations before import.
- Creates an `import_runs` row (`running` → terminal status).
- On row-level issues (missing `PATIENT_ID`), appends sanitized rows to `import_errors` (no cell values).
- Replaces all rows in `medical_summary` on each successful transaction (full table refresh for this band).

---

## Imported fields

| Mirror column | API / JSON name | Source |
| --- | --- | --- |
| `patient_id` | `patientId` | `PATIENT_ID` (latest row per patient by `DATE`) |
| `has_medical_record` | `hasMedicalRecord` | Always `1` when a row is stored |
| `has_sensitive_medical_details` | `hasSensitiveMedicalDetails` | Derived from blocked columns only |
| `last_updated` | `lastUpdated` | `DATE` |
| `last_dental_visit` | `lastDentalVisit` | `LAST_DENTA` |
| `flagged_condition_count` | `flaggedConditionCount` | Count of screening flags that resolved to `true` |
| `conditions_json` | `conditions` | JSON object of FoxPro `L` screening booleans |
| `imported_at` | — | ISO-8601 at import time |

Row selection matches the bridge reader: for each `PATIENT_ID`, the non-deleted row with the greatest questionnaire `DATE` wins (ties keep the later scanned row).

Mapping logic lives in `services/bridge/src/dbf/patient-medical-summary.ts` and is exposed to importers via `@microdent/bridge/import-source` (`readAllMedicalSummariesFromDbf`).

---

## Blocked fields (never imported or logged)

- `PROBLEM`, `ALLERGY_TO`, `NOTES` (and any other memo / free-text columns)
- Raw DBF row objects or arbitrary `MEDICAL` columns
- `privacyNote` (API-only fixed string; not stored in SQLite)

`has_sensitive_medical_details` may be `1` when blocked fields appear populated; their values are never written to SQLite.

---

## Import metadata

| Table | Usage |
| --- | --- |
| `import_runs` | One row per call; `tables_requested` includes `medical_summary`; `row_counts` JSON map |
| `import_errors` | Sanitized codes/messages only; optional `row_index`; **no cell values** |

Common error codes: `MEDICAL_DBF_NOT_FOUND`, `MEDICAL_READ_ERROR`, `INVALID_PATIENT_ID`, `SQLITE_WRITE_ERROR`, `DATA_ROOT_INVALID`.

---

## Tests

`services/sqlite-mirror/src/import-medical-summary.test.ts` uses **synthetic** `MEDICAL.DBF` fixtures only (decoy problem/allergy tokens). Asserts:

- Safe summary fields for patient `777` (latest `DATE`, flagged counts, condition booleans in `conditions_json`)
- `import_runs` / `import_errors` audit rows
- SQLite dump does **not** contain decoy free-text tokens or blocked column names

Requires **Node ≥ 22.5** (built-in `node:sqlite`). Root `pnpm test` builds `@microdent/bridge` before `@microdent/sqlite-mirror`.

---

## Operator notes

- Point `dataRoot` at **Microdent-Legacy-Copy** `DATA/` only — never production `Microdent-Legacy`.
- Do not commit mirror `.sqlite` files or real copy paths.
- Re-run `importMedicalSummary` after refreshing the DBF copy; each run replaces `medical_summary` contents.
- Import after `patients` when validating joins; medical summary does not FK-enforce patient existence.

---

## Related docs

- `docs/phase-1b-medical-summary-backend.md` — HTTP contract and blocked memos
- `docs/phase-2-sqlite-mirror-plan.md` — `medical_summary` table and Phase 2.5 band
- `docs/phase-2-sqlite-schema.md` — migrations and driver decision
