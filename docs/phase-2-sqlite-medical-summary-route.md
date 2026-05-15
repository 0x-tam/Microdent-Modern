# Phase 2 — SQLite read: patient medical summary

**Status:** Implemented for `GET /v1/patients/:patientId/medical-summary` when `SQLITE_PATH` is configured.

**Scope:** Read-only bridge route. Same JSON contract as Phase 1b. No UI changes required — the Medical tab already calls `getPatientMedicalSummary`.

---

## Route

| Route | Mirror table | DBF fallback source |
| --- | --- | --- |
| `GET /v1/patients/:patientId/medical-summary` | `medical_summary` | `MEDICAL.DBF` |

---

## Configuration

| Variable | Required | Meaning |
| --- | --- | --- |
| `DATA_ROOT` | Yes | Absolute path to copied legacy `DATA/` (unchanged) |
| `SQLITE_PATH` | No | Absolute path to mirror `.sqlite` from importers |

When `SQLITE_PATH` is unset or whitespace, behavior is **identical to Phase 1b** (DBF only).

Populate `medical_summary` with `importMedicalSummary` (or `runMirrorImportSafe`) before expecting SQLite-backed responses.

---

## Read path selection

1. If `SQLITE_PATH` is **not configured** → read `MEDICAL.DBF` only.
2. If configured but the file is **missing**, **not openable**, or `medical_summary` is **absent** in `sqlite_master` → **fallback to DBF**.
3. If the mirror is **usable** → read SQLite for the requested `patientId`.
4. If SQLite query **fails** or `conditions_json` is invalid → **fallback to DBF**.

When SQLite is used and no row exists for the patient → **200** with `hasMedicalRecord: false` (same as DBF “no matching row”).

When SQLite is used successfully, **`MEDICAL.DBF` is not required** for that request (operators may still keep DBF for fallback).

### Invalid / unavailable mirror: **DBF fallback**

Same policy as other Phase 2 read routes (`docs/phase-2-sqlite-read-routes.md`): misconfigured mirrors do not block the Medical tab when `DATA_ROOT` is healthy.

---

## Fields returned (unchanged)

Validated by `PatientMedicalSummaryResponseSchema` (`strict`).

| JSON field | Mirror source |
| --- | --- |
| `patientId` | path param |
| `hasMedicalRecord` | `has_medical_record` |
| `hasSensitiveMedicalDetails` | `has_sensitive_medical_details` |
| `lastUpdated` | `last_updated` |
| `lastDentalVisit` | `last_dental_visit` |
| `flaggedConditionCount` | `flagged_condition_count` |
| `conditions` | `conditions_json` (parsed; boolean flags only) |
| `privacyNote` | constant (not stored in mirror) |

### Never exposed

`PROBLEM`, `ALLERGY_TO`, `NOTES`, raw DBF/SQLite rows, arbitrary `MEDICAL` columns, or `conditions_json` on the wire.

Importer and DBF reader compute `hasSensitiveMedicalDetails` from blocked columns without serializing their values.

---

## Implementation

- SQLite reader: `services/bridge/src/sqlite/patient-medical-summary.ts`
- Route wiring: `services/bridge/src/routes/v1.ts`
- Shared empty summary / privacy note: `services/bridge/src/dbf/patient-medical-summary.ts`
- Mirror usability: `services/bridge/src/sqlite/mirror-usable.ts` (`medical_summary` table name)

---

## Tests

`services/bridge/src/sqlite-medical-summary-routes.test.ts`:

- Temp DB via `applyMigrations` + `importMedicalSummary` on **synthetic** `MEDICAL.DBF`
- Asserts contract shape, latest-row semantics (patient `777`), and absence of blocked tokens in JSON
- Missing patient → `hasMedicalRecord: false`
- Mirror works after `MEDICAL.DBF` removed post-import
- Fallback when `SQLITE_PATH` points at a missing file
- DBF-only when `SQLITE_PATH` unset

Existing DBF tests remain in `services/bridge/src/patient-medical-summary-routes.test.ts`.

---

## Related docs

- `docs/phase-1b-medical-summary-backend.md` — HTTP contract and blocked memos
- `docs/phase-2-medical-summary-importer.md` — mirror import
- `docs/phase-2-sqlite-read-routes.md` — shared fallback policy
