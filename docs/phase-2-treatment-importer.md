# Phase 2.6 — Safe treatment SQLite importer

**Status:** Implemented in `@microdent/sqlite-mirror`.

**Scope:** Batch import of **safe treatment fields only** from copied `OPERTBL.DBF` into the SQLite mirror. No bridge read-path switch yet; no UI changes.

---

## API

```ts
import { importTreatments } from "@microdent/sqlite-mirror";

const result = await importTreatments({
  dataRoot: "/absolute/path/to/copied/DATA",
  sqlitePath: "/absolute/path/to/MICRODENT_MIRROR.sqlite",
  trigger: "cli", // optional: cli | manual | scheduled
});
```

- Applies pending schema migrations before import.
- Creates an `import_runs` row (`running` → terminal status).
- On row-level issues, appends sanitized rows to `import_errors` (no cell values).
- Replaces all rows in `treatments` on each successful transaction (full table refresh for this band).
- Opens `OPERTBL.DBF` with `readMode: "loose"` and `encoding: "win1252"` (required for production Visual FoxPro `_NullFlags` headers).
- Resolves `procedure_label` and `doctor_label` from mirrored **`procedures`** and **`doctors`** tables — run `importProcedures` and `importDoctors` first.

---

## Imported fields

| Mirror column | JSON / API name | `OPERTBL.DBF` source |
| --- | --- | --- |
| `patient_id` | `patientId` | `ID` |
| `treatment_id` | `treatmentId` | `OPNUM` |
| `treatment_date` | `date` | `DATE` (ISO `YYYY-MM-DD` or null) |
| `tooth` | `tooth` | `TOOTHNB` (null when zero) |
| `procedure_code` | `procedureCode` | `PROCNB` (trimmed; null if empty) |
| `procedure_label` | `procedureLabel` | From `procedures` mirror only — never `OPERTBL.PROCEDURE` |
| `doctor_id` | `doctorId` | `DOCT` (stringified; null when zero) |
| `doctor_label` | `doctorLabel` | From `doctors` mirror |
| `status` | `status` | `STATUS` |
| `has_description` | `hasDescription` | Presence of `DESC` / `DESCRIPT` only — **no text stored** |
| `source_deleted` | — | DBF soft-delete flag |
| `imported_at` | — | ISO-8601 at import time |

Mapping logic matches `services/bridge/src/dbf/patient-treatments.ts` (duplicated in `treatment-field-map.ts` to avoid coupling packages).

---

## Blocked fields (never imported or logged)

- `DESCRIPT`, `DESC` (content), `PROCEDURE`, `CLASSIF`, `SUBPROC`
- Fees and money: `FEE_INIT`, `FEE`, `CHARGE`, `PROFIT`, `COST`, …
- Insurance / plan: `PLANNUM`, …
- Ledger linkage: `TRANSNUM` (deferred to ledger band)
- Payments, insurance, raw DBF row objects

---

## Schema migrations

| File | Purpose |
| --- | --- |
| `005_treatments.sql` | `treatments` table (composite PK `patient_id`, `treatment_id`) |
| `006_treatments_indexes.sql` | Patient, date, procedure, doctor indexes |

---

## Import metadata

| Table | Usage |
| --- | --- |
| `import_runs` | `tables_requested` / `tables_succeeded` include `treatments`; `row_counts.treatments` |
| `import_errors` | Codes such as `TREATMENT_MISSING_OPNUM`, `TREATMENT_PATIENT_ID_INVALID`, `TREATMENT_INVALID_DATE`, `OPERTBL_DBF_NOT_FOUND` — no cell values |

Row-level skips yield `partial` when any rows import successfully; fatal open/scan failures yield `failed`.

---

## Tests

`services/sqlite-mirror/src/import-treatments.test.ts` uses **synthetic** `OPERTBL.DBF` fixtures only. Asserts:

- Safe field values and reference labels for known ids
- `has_description` without persisting memo/char body
- `import_runs` / `import_errors` audit rows
- SQLite dump does **not** contain decoy description, procedure text, or fee tokens

Requires **Node ≥ 22.5** (built-in `node:sqlite`).

---

## Operator notes

- Import order: **`importDoctors`** → **`importProcedures`** → **`importTreatments`** (labels depend on reference tables).
- Point `dataRoot` at **Microdent-Legacy-Copy** `DATA/` only — never production `Microdent-Legacy`.
- Do not commit mirror `.sqlite` files or real copy paths.
- Re-run `importTreatments` after refreshing the DBF copy; each run replaces `treatments` contents.

---

## Related docs

- `docs/phase-2-treatments-sqlite-plan.md` — performance and bridge migration plan
- `docs/phase-1b-treatments-backend-spike.md` — current DBF route
- `docs/phase-2-reference-importers.md` — doctors and procedures importers
- `packages/contracts/src/patient-treatments.ts` — canonical safe DTO
