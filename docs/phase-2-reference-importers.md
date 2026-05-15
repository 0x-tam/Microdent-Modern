# Phase 2.2 — Reference importers (doctors & procedures)

**Status:** Implemented in `@microdent/sqlite-mirror` — synthetic DBF fixtures in CI only; no production copy in automated tests.

**Scope:** Import safe reference rows from copied legacy `DATA/` into the SQLite mirror. Does **not** import patients, appointments, medical data, ledger data, or PHI.

---

## API

From `@microdent/sqlite-mirror`:

| Function | Source DBF | Mirror table |
| --- | --- | --- |
| `importDoctors({ dataRoot, sqlitePath })` | `DOCTORS.DBF` | `doctors` |
| `importProcedures({ dataRoot, sqlitePath })` | `PROCCHRT.DBF` | `procedures` |

Optional `trigger`: `cli` (default) \| `manual` \| `scheduled`.

Each call:

1. Runs `applyMigrations(sqlitePath)` if needed.
2. Opens an `import_runs` row (`status = running`).
3. Reads DBF via bridge reference readers (`@microdent/bridge/import-source`) — same mapping as `GET /v1/reference/doctors` and `GET /v1/reference/procedures`.
4. Replaces the target table inside a transaction (`DELETE` + `INSERT OR REPLACE`).
5. Finishes the run with `success` or `failed` and sanitized `import_errors` when applicable.

---

## Imported fields

### Doctors (`DOCTORS.DBF` → `doctors`)

| Mirror column | API / DTO field | Legacy source |
| --- | --- | --- |
| `doctor_id` | `doctorId` | `DOCTOR_NB` |
| `display_label` | `displayName` | `NAME` (fallback `Doctor {id}`) |
| `active` | `active` | `SCHEDULE` (0/1 only → integer; else NULL) |
| `source_deleted` | — | Always `0` (soft-deleted DBF rows are skipped) |
| `imported_at` | — | ISO-8601 at import time |

### Procedures (`PROCCHRT.DBF` → `procedures`)

| Mirror column | API / DTO field | Legacy source |
| --- | --- | --- |
| `procedure_code` | `procedureCode` | `PROCNB` |
| `label` | `displayName` | `PROCEDURE` (fallback `procedureCode` when blank) |
| `procedure_class` | `category` | `CLASS` |
| `category_code` | `categoryCode` | `CATAGORY` |
| `class_id` | `classId` | `CLASS_ID` (NULL when zero) |
| `chart_flag` | `chartRelevant` | `CHART` (0/1) |
| `source_deleted` | — | Always `0` |
| `imported_at` | — | ISO-8601 at import time |

Migration `003_procedures_reference_columns.sql` adds `category_code` and `class_id`.

---

## Blocked fields (never stored)

### Doctors

Contact, credentials, schedule grid, notes, tax, and all other `DOCTORS.DBF` columns — see `docs/phase-1b-reference-doctors.md`.

### Procedures

All `PRICE*`, `PER_PROF`, `QTY*`, `TRANS_CODE`, `GROUP`, `USER`, memos, and raw row maps — see `docs/phase-1b-reference-procedures.md`.

---

## Import metadata

| Table | Usage |
| --- | --- |
| `import_runs` | One row per `importDoctors` / `importProcedures` call; JSON `tables_requested`, `tables_succeeded`, `row_counts` |
| `import_errors` | Sanitized codes/messages only; optional `row_index`; **no cell values** |

`data_root_fingerprint` hashes basename + size + mtime for the source DBF (not row content).

---

## Tests

`services/sqlite-mirror/src/import-doctors.test.ts` and `import-procedures.test.ts` build **synthetic** DBF files in temp dirs, import into a temp SQLite file, and assert:

- Expected safe columns are present.
- Private/fee fields do not appear in the database JSON dump.
- Missing DBF → `failed` run + `import_errors` row.

Requires **Node ≥ 22.5** (`node:sqlite`). Root `pnpm test` builds `@microdent/bridge` before `@microdent/sqlite-mirror`.

---

## Related

- `docs/phase-2-sqlite-schema.md` — migrations and driver choice
- `docs/phase-2-sqlite-mirror-plan.md` — full Phase 2 architecture
- `services/bridge/src/import-source.ts` — shared DBF readers for importers
