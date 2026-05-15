# Phase 2 — Treatments performance and SQLite migration plan

**Status:** Planning only — no importer implementation, no bridge route changes, no UI changes, no new dependencies.

**Scope:** Move **`GET /v1/patients/:patientId/treatments`** from a per-request **full `OPERTBL.DBF` scan** to a **SQLite-backed read model** populated by a bounded import job. The HTTP contract and Zod DTO stay aligned with Phase 1b; only the data source changes behind a feature flag.

**Folder policy (unchanged):**

| Path | Rule |
| --- | --- |
| `Microdent-Legacy` | Never read or modify |
| `Microdent-Legacy-Copy` | Read-only import source (`DATA_ROOT`) |
| `Microdent-Modern` | All code, docs, and SQLite artifacts |

**Related docs:**

- `docs/phase-1b-treatments-backend-spike.md` — current route and parser notes
- `docs/phase-1b-next-modules-mapping.md` — `OPERTBL` field inventory (names/types only)
- `docs/phase-2-sqlite-mirror-plan.md` — mirror architecture (band **2.6** defers treatments)
- `docs/phase-2-sqlite-schema.md` — Phase 2.1 schema (no `treatments` table yet)
- `packages/contracts/src/patient-treatments.ts` — canonical safe DTO
- `services/bridge/src/dbf/patient-treatments.ts` — current DBF reader

---

## 1. Current OPERTBL scan behavior (Phase 1b)

### 1.1 Route and contract

- **Endpoint:** `GET /v1/patients/:patientId/treatments`
- **Implementation:** `readPatientTreatmentsFromDbf` in `services/bridge/src/dbf/patient-treatments.ts`
- **Response:** `PatientTreatmentsResponse` — `treatments[]`, `truncated`, `privacyNote` (see `@microdent/contracts`)

### 1.2 Access pattern

On **every** treatments request for one patient:

1. Resolve `OPERTBL.DBF` under `DATA_ROOT` (registered basename, path sandbox).
2. Open with **`dbffile`** `encoding: "win1252"`, **`readMode: "loose"`** (required for Visual FoxPro `_NullFlags` column; strict mode fails on production headers).
3. **Optionally** load reference maps (same request, additional full scans):
   - `PROCCHRT.DBF` → procedure label lookup
   - `DOCTORS.DBF` → doctor label lookup
4. **Sequential `for await` over every active row** in `OPERTBL`:
   - Skip deleted rows (`DELETED` flag).
   - Compare stringified legacy **`ID`** to route `patientId` (no CDX/index use in bridge).
   - Map matching rows to `PatientTreatmentItem` via `toTreatmentItem`.
   - Stop **collecting** after **200** matches per patient (`PATIENT_TREATMENTS_MAX`); continue scanning to set `truncated: true` if more matches exist.
5. Sort in memory: `date` descending, then `treatmentId` (`OPNUM`) descending.
6. Return JSON; route validates with `PatientTreatmentsResponseSchema`.

### 1.3 Safe field mapping (runtime today)

| DTO field | Legacy column | Notes |
| --- | --- | --- |
| `treatmentId` | `OPNUM` | Stringified; row skipped if empty |
| `patientId` | `ID` | Route param echoed |
| `date` | `DATE` | ISO date via FoxPro formatter |
| `tooth` | `TOOTHNB` | `null` when zero/missing |
| `procedureCode` | `PROCNB` | Trimmed; `null` if empty |
| `procedureLabel` | *(join)* | From `PROCCHRT` map only — never `OPERTBL.PROCEDURE` |
| `doctorId` | `DOCT` | Stringified; `null` when zero |
| `doctorLabel` | *(join)* | From `DOCTORS` map |
| `status` | `STATUS` | Integer code or `null` |
| `hasDescription` | `DESC`, `DESCRIPT` | **Boolean only** — detects non-empty memo/char; **never returns text** |

### 1.4 UI coupling

- **App:** `PatientProfilePanel` Treatments tab calls `getPatientTreatments` only when tab active, profile loaded, bridge connected (`docs/phase-1b-treatments-ui.md`).
- **No prefetch** — but each tab visit still triggers a full backend scan today.

---

## 2. Performance and reliability risks

### 2.1 Scale (metadata only)

On the inspected read-only copy, `OPERTBL` header reports on the order of **~420k** active rows (~301 bytes/record). Each patient treatments request may touch **the entire file** even when the patient has few lines.

### 2.2 Cost model

| Cost | Per request (today) |
| --- | --- |
| `OPERTBL` sequential read | O(all rows) |
| `PROCCHRT` scan | O(reference rows) — small |
| `DOCTORS` scan | O(reference rows) — small |
| Patient filter | Applied **after** read — no legacy index hook |
| Cap behavior | Still scans **past** 200 matches to compute `truncated` |

**Symptoms:** Slow Treatments tab on large copies; elevated disk I/O; latency grows with table size, not with the patient’s row count. Concurrent profile tabs (multiple patients) multiply scans.

### 2.3 Parser / operational risk at request time

- **Loose mode** required — parser edge cases surface during **UI use**, not only during import.
- **Currency (`Y`) and fee columns** exist on rows but are not mapped to the DTO; parser failures on individual rows can fail the **whole** request (`read_error`).
- **Memo column `DESCRIPT`** is read only to derive `hasDescription` — still touches memo machinery during scan.

### 2.4 Reference join duplication

Procedure and doctor labels are resolved from DBF on **every** treatments request. Phase 2 already plans SQLite mirrors for `procedures` and `doctors`; treatments import should **reuse** those tables via SQL `LEFT JOIN`, not rescan DBFs.

---

## 3. Why SQLite import is better

Aligns with `docs/phase-2-sqlite-mirror-plan.md` §2:

| Benefit | For treatments |
| --- | --- |
| **Indexed lookup by `patient_id`** | One query (or small range) instead of full-file scan |
| **Parser work at import time** | Loose-mode / coercion failures → `import_errors`, not failed tab load |
| **Deterministic schema** | Mirror columns match Zod DTO; migrations version the shape |
| **Joins in SQL** | `procedure_label` / `doctor_label` from mirrored reference tables |
| **Auditability** | `import_runs` row counts and `import_errors` without debug logs |
| **Separation of concerns** | UI read path uses `node:sqlite` (Node ≥22.5 per `docs/phase-2-sqlite-schema.md`); DBF stays import-only |

SQLite remains a **derived read model**, not the legal record of care. Refresh by re-import from an updated **copy**, not dual-write.

---

## 4. Proposed `treatments` mirror table

Add in a new migration band (e.g. `003_treatments.sql`) after Phase 2.1 core tables exist. Table name: **`treatments`** (logical source id: `opertbl`).

### 4.1 Primary key

Composite natural key from legacy line identity:

| Column | Type | Source | Notes |
| --- | --- | --- | --- |
| `patient_id` | TEXT NOT NULL | `ID` | Stringified integer match to profile/search |
| `treatment_id` | TEXT NOT NULL | `OPNUM` | Stringified; same as DTO `treatmentId` |

**PRIMARY KEY (`patient_id`, `treatment_id`)**

Rationale: `OPNUM` is documented as unique within a patient’s history; global uniqueness across patients is not assumed.

### 4.2 Safe payload columns (DTO-aligned)

| Column | Type | Maps to DTO | Import rule |
| --- | --- | --- | --- |
| `treatment_date` | TEXT NOT NULL | `date` | `YYYY-MM-DD`; reject row if invalid after coercion |
| `tooth` | INTEGER NULL | `tooth` | `TOOTHNB`; NULL if zero |
| `procedure_code` | TEXT NULL | `procedureCode` | Trimmed `PROCNB`; NULL if empty |
| `procedure_label` | TEXT NULL | `procedureLabel` | Resolved at import from `procedures` table (same normalization as DBF reader) |
| `doctor_id` | TEXT NULL | `doctorId` | Stringified `DOCT`; NULL if zero |
| `doctor_label` | TEXT NULL | `doctorLabel` | Resolved at import from `doctors` table |
| `status` | INTEGER NULL | `status` | `STATUS` truncated integer |
| `has_description` | INTEGER NOT NULL | `hasDescription` | `0`/`1`; set from `DESC` / `DESCRIPT` **presence only** |
| `source_deleted` | INTEGER NOT NULL DEFAULT 0 | — | DBF deleted flag; API may still filter `= 0` |
| `imported_at` | TEXT NOT NULL | — | ISO-8601 of import row write |

**Optional (non-DTO, import metadata only):**

| Column | Type | Purpose |
| --- | --- | --- |
| `source_row_ordinal` | INTEGER NULL | DBF read order for `import_errors.row_index` correlation — not exposed via API |

Do **not** store `TRANSNUM`, `PLANNUM`, surfaces, quantities, or flags in Phase 2 treatments mirror unless a later band explicitly extends the contract.

### 4.3 Denormalized labels vs join-at-read

**Recommendation:** Store `procedure_label` and `doctor_label` on the row **at import time** (denormalized) so the treatments API remains a **single-table SELECT** matching today’s JSON shape. Re-import refreshes labels when reference tables change.

Alternative (open question): join `procedures` / `doctors` at read time — fewer stale labels, slightly more complex query.

---

## 5. Indexes

Create in the same migration or `004_treatments_indexes.sql` after bulk load (see §7).

| Index name | Columns | Serves |
| --- | --- | --- |
| *(PK)* | `patient_id`, `treatment_id` | Point lookups; uniqueness |
| `idx_treatments_patient` | `patient_id` | **Primary API path:** all lines for one patient |
| `idx_treatments_date` | `treatment_date` | Global date analytics / future admin tools |
| `idx_treatments_procedure_code` | `procedure_code` | Code frequency / reference validation (partial: `WHERE procedure_code IS NOT NULL`) |
| `idx_treatments_doctor` | `doctor_id` | Provider workload views (partial: `WHERE doctor_id IS NOT NULL`) |

**Recommended API query plan:**

```sql
-- Conceptual; not implementation
SELECT ... FROM treatments
WHERE patient_id = ? AND source_deleted = 0
ORDER BY treatment_date DESC, treatment_id DESC
LIMIT 201;  -- 200 + 1 to detect truncation without full scan
```

Using `LIMIT 201` on SQLite replaces the “scan entire file after 200 matches” truncation detection.

**Composite index (optional later):** `(patient_id, treatment_date DESC, treatment_id DESC)` if SQLite version and query planner warrant it after measurement.

---

## 6. Fields to import vs never import

### 6.1 Import (safe DTO + `has_description` only)

Importer allowlist — **same semantics** as `toTreatmentItem` / `rowHasDescription` in `patient-treatments.ts`:

- `ID`, `OPNUM`, `DATE`, `TOOTHNB`, `PROCNB`, `DOCT`, `STATUS`
- **Presence checks only** for `DESC`, `DESCRIPT` → `has_description` (no text persisted)
- DBF `DELETED` → `source_deleted`
- Resolved labels from mirrored **`procedures`** / **`doctors`** (import `procedures` and `doctors` before `treatments`)

### 6.2 Never import initially (explicit blocklist)

Do not create SQLite columns or importer mappings for:

| Category | Legacy examples (names only) |
| --- | --- |
| Memos / free text | `DESCRIPT`, `DESC` (content), `PROCEDURE`, `CLASSIF`, `SUBPROC` |
| Fees / money | `FEE_INIT`, `FEE`, `CHARGE`, `PROFIT`, `COST`, `PER_PROF`, `PROC_DISC` |
| Insurance / plan | `PLANNUM`, insurance-adjacent identifiers |
| Ledger linkage | `TRANSNUM` (defer to ledger band) |
| Raw row | Full DBF record JSON, arbitrary column dump |
| High-cardinality opaque | `SURFACE`, `QUANTITY`, `CAT_ID`, `SER_ID`, flags — until product asks |

**`has_description`** is the only signal that blocked text exists.

### 6.3 Reference tables

- **`PROCCHRT` / `DOCTORS`:** Imported in Phase 2.2 (`procedures`, `doctors`). Treatments import **depends** on those tables being populated first.
- Do not reintroduce per-request DBF scans for labels once SQLite path is enabled.

---

## 7. Import strategy

### 7.1 Placement in Phase 2 roadmap

Per `docs/phase-2-sqlite-mirror-plan.md` §9:

| Band | Work |
| --- | --- |
| **2.2–2.5** | Core mirror + schedule + medical (prerequisite reference data) |
| **2.6** | **`treatments` importer** + migration SQL |
| **2.6+** | Bridge `SqliteTreatmentsReadAdapter` + `READ_MODEL` flag |

Treatments **after** `procedures` and `doctors` importers; **before** ledger (`trans`) unless product prioritizes ledger.

### 7.2 Full import (first ship)

1. Apply `treatments` DDL (+ indexes).
2. Start `import_runs` row (`tables_requested` includes `opertbl` / `treatments`).
3. Stream `OPERTBL.DBF` once with **loose** mode (same as today).
4. For each non-deleted row:
   - Map allowlisted fields → insert batch.
   - On coercion failure: **quarantine** (skip row, append `import_errors`).
5. Batch `INSERT` (e.g. 500–1000 rows per transaction).
6. Record `row_counts.treatments` in run metadata.
7. Mark run `success` | `partial` | `failed`.

**No incremental / checksum skip for treatments until** at least two stable full runs on real copies (same policy as mirror plan §7.3).

### 7.3 Row-level cap and quarantine (import-time)

| Mechanism | Purpose |
| --- | --- |
| **`import_errors`** | Sanitized `error_code`, `message`, `source_table`=`treatments`, `source_file`=`OPERTBL.DBF`, optional `row_index` — **never cell values** |
| **Quarantine bad row** | Skip insert; continue import (`partial` run) |
| **Fatal table errors** | Unopenable DBF, header mismatch → `failed` run, zero or rollback table body |

Suggested error codes (non-PHI):

- `TREATMENT_INVALID_DATE`
- `TREATMENT_MISSING_OPNUM`
- `TREATMENT_ROW_PARSE_ERROR`
- `TREATMENT_PATIENT_ID_INVALID`

### 7.4 API-level cap (unchanged)

- Keep **`PATIENT_TREATMENTS_MAX = 200`** in contract behavior.
- SQLite path: `ORDER BY … LIMIT 201` → `truncated` if 201st row exists.
- DBF path remains until flag removed.

### 7.5 `import_errors` and `import_runs`

Reuse existing tables from `services/sqlite-mirror/sql/migrations/001_initial.sql`:

- **`import_runs.row_counts`:** JSON map including `"treatments": <n>`
- **`import_errors`:** per-quarantined-row or batched summary (prefer per-row only when count stays under operator threshold; otherwise aggregate code counts in `notes`)

### 7.6 Re-import / idempotency

- **`INSERT OR REPLACE`** on (`patient_id`, `treatment_id`).
- Full re-import truncates or replaces all `treatments` rows for consistency with copy snapshot (same as mirror plan §7.2).
- Orphan handling: rows in SQLite not in latest import may be deleted in a post-pass (`DELETE` where `imported_at < run.started_at`) — implementation detail.

### 7.7 Privacy during import

- Importer logs: run id, table name, counts, error codes only.
- No `console.log` of `DESCRIPT`, `DESC`, `PROCEDURE`, amounts, or patient names.
- CI uses **synthetic fixtures** only (mirror plan §8).

---

## 8. Bridge read-path migration

### 8.1 Repository pattern

Introduce `TreatmentsReadPort`:

| Adapter | When |
| --- | --- |
| `DbfTreatmentsReadAdapter` | Wraps existing `readPatientTreatmentsFromDbf` |
| `SqliteTreatmentsReadAdapter` | SQL query + same sort/limit/truncation semantics |

Wire in `createV1Router` behind config, e.g. `READ_MODEL=treatments:dbf|sqlite` or global `READ_MODEL=sqlite` with per-route override (see mirror plan §4).

### 8.2 Contract parity

- Same URL, status codes, error codes (`OPERTBL_DBF_NOT_FOUND` only on DBF path; SQLite path may use `MIRROR_STALE` / `TREATMENTS_NOT_IMPORTED` — product decision).
- **Contract tests:** golden JSON from fixture DBF vs fixture SQLite must match for the same synthetic input.

### 8.3 Stale / missing mirror

Options (mirror plan §8, §13):

1. **Fallback to DBF** when SQLite empty or older than threshold.
2. **Hard error** with operator message to run import CLI.

Document choice before enabling default in production.

---

## 9. UI migration

### 9.1 Phase 1b (today)

- Treatments tab → `GET /v1/patients/:patientId/treatments` (DBF-backed).
- No client changes required for mirror existence.

### 9.2 Phase 2.6+ (planned)

| Layer | Change |
| --- | --- |
| **React app** | **None required** if contract unchanged — still `getPatientTreatments` |
| **Bridge** | Switch default adapter to SQLite when mirror fresh |
| **Optional UX** | Show `lastImportedAt` from `GET /v1/meta/import-status` in profile footer (global mirror banner) |

### 9.3 Explicit non-goals (UI)

- No description body, fees, or raw row display.
- No `localStorage` of treatment rows.
- No prefetch until product requests (would benefit from SQLite but is separate).

---

## 10. Risks and open questions

### 10.1 Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Full `OPERTBL` import duration | Long CLI job on ~420k rows | Stream cursor; batch inserts; WAL; run off-hours |
| Memo read for `has_description` | Import still touches memo fields | Accept once at import; or spike “memo block present” without loading body if library supports |
| `OPNUM` uniqueness across patients | PK violation on import | Composite PK (`patient_id`, `treatment_id`); quarantine duplicates |
| Label drift vs `PROCCHRT` | Stale `procedure_label` | Re-import treatments after procedures refresh; or join-at-read |
| Partial import | Incomplete history in UI | `import_runs.status = partial`; bridge refuses SQLite or shows banner |
| Truncation semantics change | User trusts cap as “all history” | Keep `truncated` + banner; document cap in runbook |
| Parser strictness on currency columns | Import crash on bad bytes | Loose mode; skip row to `import_errors` |
| Concurrent import + reads | Readers see old snapshot | WAL; single-writer import lock |

### 10.2 Open questions

1. **Stale mirror policy** — fallback to DBF vs `503` for treatments when SQLite older than N hours?
2. **Denormalized labels** — store on `treatments` row vs join `procedures`/`doctors` at read time?
3. **`TRETPLAN` scope** — include planned (not posted) procedures in mirror later, or `OPERTBL` only for 2.6?
4. **Composite covering index** — worth `(patient_id, treatment_date DESC, treatment_id DESC)` on first ship?
5. **Import ordering with ledger** — when `TRANSNUM` is added in a later band, separate table vs column on `treatments`?
6. **Multi-clinic mapping** — per-site `PROCNB` normalization config in importer?
7. **Node 22.5 requirement** — mirror package already requires it; confirm bridge deployment target before enabling SQLite reads.
8. **Error visibility** — should Treatments tab surface “import partial” vs generic error?

---

## 11. Definition of done (this document)

- [x] `docs/phase-2-treatments-sqlite-plan.md` exists
- [x] Documents current scan, performance risk, SQLite rationale, schema, indexes, import/UI migration, risks
- [x] No PHI, memo text, fees, or sample row values
- [x] No legacy files modified; no application code changed in this band

---

## 12. Recommended next implementation steps (when approved)

1. Migration `003_treatments.sql` + indexes in `@microdent/sqlite-mirror`.
2. Importer module: stream `OPERTBL` → `treatments` + `import_errors` (fixture tests only in CI).
3. `SqliteTreatmentsReadAdapter` + feature flag on `GET .../treatments`.
4. Contract parity tests (DBF vs SQLite adapters).
5. Operator runbook: import order `doctors` → `procedures` → … → `treatments`; verify `import_runs` counts.
