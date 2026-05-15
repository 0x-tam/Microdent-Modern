# Phase 2 — SQLite mirror architecture plan

**Status:** Planning only — no SQLite implementation, no new dependencies, and no importer code in this band.

**Scope:** Define how **Microdent-Modern** should move from **direct DBF scans** (Phase 1b bridge) to a **local SQLite read model** fed by **copied** legacy data. The React app continues to call the bridge over loopback; it never opens DBF or SQLite files directly.

**Folder policy (unchanged):**

| Path | Rule |
| --- | --- |
| `Microdent-Legacy` | Never read or modify |
| `Microdent-Legacy-Copy` | Read-only import source (`DATA_ROOT` / copy of `DATA/`) |
| `Microdent-Modern` | All new code, docs, and SQLite artifacts |

---

## 1. Problem statement (today)

Phase 1b implements read-only features by **opening FoxPro/VFP DBF files under `DATA_ROOT`** and, for most clinic flows, **sequentially scanning** entire tables:

| Feature | Typical DBF access pattern |
| --- | --- |
| Patient search | Full scan of `PATIENT.DBF` until hit cap |
| Patient profile | Full scan of `PATIENT.DBF` per lookup |
| Schedule day view | Full scan of `SCHEDULE.DBF` for date range |
| Appointment patient names | Full scan of `PATIENT.DBF` for missing ids |
| Medical summary | Full scan of `MEDICAL.DBF` per patient |
| Reference doctors / procedures | Full scans of `DOCTORS.DBF`, `PROCCHRT.DBF` |

That design is **correct for development and proof-of-concept**: it respects read-only safety, path sandboxing, and privacy-shaped DTOs. It is **not ideal for production reliability and performance** when tables grow large, many screens load in one session, or the same reference data is read repeatedly.

---

## 2. Why a SQLite mirror improves reliability

### 2.1 No repeated large DBF scans per screen

Each UI navigation or search today can trigger another **cold sequential read** of multi-megabyte DBFs. SQLite lets the bridge answer from **indexed B-tree lookups** and **pre-filtered rows** after a bounded import job. User-facing latency becomes predictable; disk churn and parser work move to **import time**, not **every click**.

### 2.2 Easier joins

Clinic views naturally combine entities (appointment + patient display name + doctor label + room). DBF has **no relational engine** — the bridge must implement ad hoc multi-pass scans or in-memory maps. SQLite supports **normalized tables and JOINs** (or denormalized materialized columns) with a single query plan per endpoint.

### 2.3 Faster search

Patient search needs substring or prefix matching on a few columns. A full DBF scan is O(n) per query. SQLite can use **indexes on `display_name_normalized`, `chart_number`, `patient_id`** plus optional **FTS5** later (explicit decision — not required for Phase 2 MVP).

### 2.4 Stable schema validation

DBF headers vary by site era (FoxPro vs VFP, `_NullFlags`, memo columns). Import time is the right place to:

- Map legacy column names → canonical SQLite columns once
- Reject or quarantine rows that fail type coercion
- Record **schema version** and **source file metadata** in `import_runs`

The **runtime API** then reads a **known SQLite schema** validated by migrations, not rediscovering parser edge cases on every request.

### 2.5 Fewer parser surprises during UI use

`dbffile` behavior on damaged files, rare field types, or memo columns should surface during **import** (logged to `import_errors`, run marked partial/failed) — not mid-appointment grid render. The UI read path uses **sqlite3** (or built-in driver) with simpler failure modes.

---

## 3. Source of truth in Phase 2

| Layer | Role in Phase 2 |
| --- | --- |
| **Copied DBF tree** (`DATA_ROOT` → legacy copy) | **Import source only** — authoritative for *what legacy contains at last copy* |
| **SQLite file** | **Read model / cache** — optimized for bridge queries and UI |
| **Bridge HTTP API** | **Stable contract** for the app; implementation may read SQLite instead of DBF per route |
| **Legacy FoxPro app** | Unchanged; **no writes from Modern** to DBF in Phase 2 |

**Explicit non-goals for Phase 2:**

- No dual-write (DBF + SQLite)
- No appointment editing
- No ledger write
- No treating SQLite as the legal record of care — it is a **derived mirror**

When copy and live legacy diverge, **re-import** from a fresh copy; do not patch SQLite to “fix” legacy.

---

## 4. Proposed data flow

```text
┌─────────────────────┐
│  DBF copy on disk   │  Microdent-Legacy-Copy/DATA/*.DBF (+ .CDX/.FPT)
│  (read-only import) │
└──────────┬──────────┘
           │  sequential read @ import job only
           ▼
┌─────────────────────┐
│  Importer service   │  bridge subcommand or `services/bridge/src/import/`
│  (batch, idempotent)│  maps rows → SQLite; writes import_runs / import_errors
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  SQLite database    │  e.g. MICRODENT_MIRROR.sqlite under app data dir
│  (read model)       │  WAL mode; single-writer import; many readers
└──────────┬──────────┘
           │  SQL queries
           ▼
┌─────────────────────┐
│  Bridge API (GET)   │  same `/v1/...` contracts; feature flag per route
└──────────┬──────────┘
           │  HTTP loopback
           ▼
┌─────────────────────┐
│  React app          │  TanStack Query; no direct DB access
└─────────────────────┘
```

**Configuration sketch (planning):**

- `DATA_ROOT` — absolute path to copied `DATA/` (unchanged)
- `SQLITE_PATH` — absolute path to mirror file (new)
- `READ_MODEL=dbf|sqlite` — per-route or global override during migration (implementation detail in Phase 2.4+)

Importer runs **out of band** from UI requests (CLI, scheduled job, or bridge admin endpoint behind a flag — TBD; prefer CLI first to avoid accidental production triggers).

---

## 5. Suggested SQLite tables

Column lists are **canonical mirror shapes** aligned with existing Zod DTOs in `@microdent/contracts`, not raw DBF dumps. Memo and free-text clinical fields stay **out** until explicitly enabled.

### 5.1 Core domain (Phase 2 early)

**`patients`**

| Column | Purpose |
| --- | --- |
| `patient_id` | TEXT PRIMARY KEY — stringified legacy `ID` |
| `chart_number` | TEXT NULL — `CASENB` |
| `display_name` | TEXT NOT NULL — built with same rules as search/profile |
| `phone_mask` | TEXT NULL — last-four mask only, never full phone |
| `search_blob` | TEXT NOT NULL — normalized lowercase haystack for search |
| `source_deleted` | INTEGER NOT NULL DEFAULT 0 — DBF deleted flag |
| `imported_at` | TEXT NOT NULL — ISO-8601 |

**`doctors`**

| Column | Purpose |
| --- | --- |
| `doctor_id` | TEXT PRIMARY KEY |
| `display_label` | TEXT NOT NULL |
| `active` | INTEGER NULL — when legacy provides it |
| `source_deleted` | INTEGER |
| `imported_at` | TEXT |

**`procedures`**

| Column | Purpose |
| --- | --- |
| `procedure_code` | TEXT PRIMARY KEY |
| `label` | TEXT NOT NULL |
| `procedure_class` | TEXT NULL |
| `chart_flag` | INTEGER NULL |
| `source_deleted` | INTEGER |
| `imported_at` | TEXT |

**`appointments`**

| Column | Purpose |
| --- | --- |
| `appointment_id` | TEXT PRIMARY KEY — stable synthetic key if legacy has none (hash of natural key) |
| `appointment_date` | TEXT NOT NULL — `YYYY-MM-DD` |
| `start_time` | TEXT NULL |
| `end_time` | TEXT NULL |
| `patient_id` | TEXT NULL — FK → `patients` |
| `doctor_id` | TEXT NULL |
| `room_id` | TEXT NULL |
| `status_code` | TEXT NULL |
| `source_row_hash` | TEXT NULL — idempotency |
| `source_deleted` | INTEGER |
| `imported_at` | TEXT |

**`schedule_rooms`** (optional early; small reference)

| Column | Purpose |
| --- | --- |
| `room_id` | TEXT PRIMARY KEY |
| `label` | TEXT NOT NULL |
| `imported_at` | TEXT |

**`medical_summary`**

| Column | Purpose |
| --- | --- |
| `patient_id` | TEXT PRIMARY KEY |
| `has_medical_record` | INTEGER NOT NULL |
| `has_sensitive_medical_details` | INTEGER NOT NULL — derived from blocked columns only |
| `last_updated` | TEXT NULL |
| `last_dental_visit` | TEXT NULL |
| `flagged_condition_count` | INTEGER NOT NULL |
| `conditions_json` | TEXT NULL — JSON object of booleans; no free text |
| `imported_at` | TEXT |

**Never store in SQLite (Phase 2):** `PROBLEM`, `ALLERGY_TO`, `NOTES`, `QUICKNOTE`, full phones, addresses, memo payloads.

### 5.2 Deferred domain (later migration steps)

| Table | Legacy source (catalog id) | Notes |
| --- | --- | --- |
| `treatments` | `opertbl`, `tretplan` | Higher parser risk; after schedule stable |
| `ledger_entries` | `trans` | Financial; import last; read-only aggregates only |
| `chart_lines` | `chartdbf` | Odontogram; separate band |

### 5.3 Import metadata (required)

**`import_runs`**

| Column | Purpose |
| --- | --- |
| `run_id` | INTEGER PRIMARY KEY AUTOINCREMENT |
| `started_at` | TEXT NOT NULL |
| `finished_at` | TEXT NULL |
| `status` | TEXT NOT NULL — `running` \| `success` \| `partial` \| `failed` |
| `trigger` | TEXT NOT NULL — `cli` \| `manual` \| `scheduled` |
| `data_root_fingerprint` | TEXT NULL — hash of catalog basenames + sizes/mtimes, not row content |
| `tables_requested` | TEXT NOT NULL — JSON array |
| `tables_succeeded` | TEXT NULL — JSON array |
| `row_counts` | TEXT NULL — JSON map table → count |
| `notes` | TEXT NULL — non-PHI operator message |

**`import_errors`**

| Column | Purpose |
| --- | --- |
| `error_id` | INTEGER PRIMARY KEY AUTOINCREMENT |
| `run_id` | INTEGER NOT NULL — FK → `import_runs` |
| `source_table` | TEXT NOT NULL — logical id e.g. `patient` |
| `source_file` | TEXT NOT NULL — basename only |
| `error_code` | TEXT NOT NULL |
| `message` | TEXT NOT NULL — sanitized; no row values |
| `row_index` | INTEGER NULL — optional ordinal; never cell values |
| `created_at` | TEXT NOT NULL |

**`import_source_checksums`** (optional but recommended)

| Column | Purpose |
| --- | --- |
| `source_table` | TEXT |
| `file_name` | TEXT |
| `file_size` | INTEGER |
| `file_mtime` | TEXT |
| `content_hash` | TEXT NULL — hash of file bytes or header+record stream |
| `run_id` | INTEGER |
| PRIMARY KEY (`source_table`, `run_id`) |

Use checksums to **skip unchanged tables** on incremental re-import (optimization pass; full import still required first).

---

## 6. Indexes

Create after initial bulk load (or before if using `INSERT` batches — measure).

**`patients`**

- `idx_patients_display_name` on `display_name` (or normalized column)
- `idx_patients_chart_number` on `chart_number` WHERE `chart_number IS NOT NULL`
- `patient_id` is PRIMARY KEY

**`appointments`**

- `idx_appointments_date` on `appointment_date`
- `idx_appointments_patient` on `patient_id`
- `idx_appointments_room` on `room_id`
- `idx_appointments_doctor` on `doctor_id`
- Composite `idx_appointments_date_room` on (`appointment_date`, `room_id`) for day-room grid

**`medical_summary`**

- `patient_id` PRIMARY KEY (lookup by patient only in Phase 2)

**`import_runs`**

- `idx_import_runs_finished` on `finished_at DESC` for “last successful import” banner

---

## 7. Import strategy

### 7.1 Full import first

1. Create schema (migrations version `001_initial.sql`).
2. Truncate or `DROP`+recreate mirror tables (or new file path).
3. Import in dependency order: **doctors → procedures → patients → rooms → appointments → medical_summary**.
4. Build indexes.
5. Record `import_runs` with counts.

### 7.2 Idempotent re-import

- **Patients / doctors / procedures:** `INSERT OR REPLACE` by primary key; same `patient_id` overwrites row.
- **Appointments:** natural key = (`appointment_date`, `start_time`, `patient_id`, `room_id`, …) — document exact legacy fields during implementation; store `source_row_hash` to detect changes.
- **Medical summary:** one row per `patient_id`; re-import replaces derived flags only.

Re-running import on the **same copy** should yield **identical** SQLite content (deterministic mapping).

### 7.3 Checksums per source table

Before reading rows, compute **file size + mtime** (minimum) or **SHA-256 of file** (stronger). Store in `import_source_checksums`. If unchanged since last successful run, skip table body read (Phase 2 optimization).

### 7.4 `import_runs` audit

Every import attempt creates a run row; terminal status and per-table counts are mandatory. Operators troubleshoot from `import_errors` without enabling debug logs.

### 7.5 Free-text and memo policy

| Content | Phase 2 default |
| --- | --- |
| Memo columns (`M` type) | **Do not import** |
| `PROBLEM`, `ALLERGY_TO`, `NOTES` | **Do not import** — only boolean `has_sensitive_medical_details` |
| Patient `QUICKNOTE` | **Do not import** |
| Enablement | Separate feature flag + migration band; never default-on |

---

## 8. Safety and operations

| Rule | Implementation expectation |
| --- | --- |
| No PHI in logs | Log run ids, table names, counts, error codes — never names, phones, or clinical text |
| No DBF writes | Importer opens DBF read-only; bridge keeps Phase 1 write guards |
| No live production DATA reads | `DATA_ROOT` must point at **copy**; document in runbook |
| User-visible freshness | `GET /v1/meta/import-status` (or extend `/health`) returns `lastImportedAt`, `status`, `tablesReady` — no row samples |
| SQLite location | Outside repo; user data dir; not committed to git |
| EXE / FoxPro | Never launched by Modern |

**Stale mirror UX:** If SQLite is missing or older than policy threshold, bridge **falls back to DBF** (feature flag) or returns **503 MIRROR_STALE** with clear message — product decision in §10.

---

## 9. Migration phases (execution order)

| Step | Deliverable | UI / API impact |
| --- | --- | --- |
| **2.1** | SQLite schema only + migration runner + empty DB | None; tests prove schema applies |
| **2.2** | Importer: `doctors`, `procedures`, `patients` | None; CLI + `import_runs` |
| **2.3** | Importer: `schedule_rooms`, `appointments` | None |
| **2.4** | Bridge reads patient search + schedule from SQLite; DBF path retained behind flag | Search + calendar faster |
| **2.5** | Importer: `medical_summary` | Profile medical tab reads SQLite |
| **2.6** | Importer: `treatments` (oper/tretplan) | Treatment views when built |
| **2.7** | Importer: `ledger_entries` last | Ledger read-only when built |

Between steps, **contract tests** stay green: same JSON shapes whether backed by DBF or SQLite.

---

## 10. What not to do (Phase 2)

- **No dual writes** to DBF and SQLite from the app
- **No appointment editing** or schedule mutation APIs
- **No ledger write** or payment posting
- **No destructive migrations** on operator DB files — forward-only SQL migrations; backup SQLite before schema bump
- **No exposing raw DBF rows** via new debug routes
- **No new npm dependencies** until explicitly approved (prefer Node built-in `node:sqlite` when available, or document exception in ADR)
- **No reading `Microdent-Legacy`** production tree

---

## 11. Bridge route migration map (planning)

| Route | Phase 2.4+ read from SQLite |
| --- | --- |
| `GET /v1/patients/search` | Yes (priority) |
| `GET /v1/patients/:id/profile` | Yes |
| `GET /v1/schedule/appointments` | Yes |
| `GET /v1/reference/doctors` | Yes (after 2.2) |
| `GET /v1/reference/procedures` | Yes (after 2.2) |
| `GET /v1/patients/:id/medical-summary` | Yes (after 2.5) |
| `GET /v1/legacy/catalog` | Still DBF headers from copy (or cache metadata in SQLite) |
| `GET /v1/tables/:id/rows` | Remains fixture-only |

Implement **repository interface** in bridge: `PatientReadPort` with `DbfPatientReadAdapter` and `SqlitePatientReadAdapter`.

---

## 12. Recommended first implementation task

**Phase 2.1 — SQLite schema-only band**

1. Add `services/bridge/sql/migrations/001_initial.sql` creating:
   - `import_runs`, `import_errors`, `import_source_checksums`
   - `patients`, `doctors`, `procedures`, `appointments`, `schedule_rooms`, `medical_summary` (empty)
   - indexes listed in §6 (can be in `002_indexes.sql` if load order matters)
2. Add `applyMigrations(sqlitePath)` using **approved** SQLite driver (no importer yet).
3. Unit test: temp file → migrations apply → `sqlite_master` table list matches expected.
4. Document `SQLITE_PATH` env in bridge README.

**Why first:** Establishes the read-model contract and audit tables before any row movement; unblocks parallel work on importer mapping specs.

**Second task (2.2):** Importer CLI `pnpm --filter @microdent/bridge import --tables doctors,procedures,patients` with synthetic/fixture DBF only in CI; real copy tested locally by operator.

---

## 13. Risks and open decisions

| Risk | Mitigation |
| --- | --- |
| SQLite driver choice vs “no new dependencies” | Prefer Node 22+ `node:sqlite`; if unavailable, single approved native dep with ADR |
| Mapping drift across clinic sites | Versioned `import_mapping` config per table; quarantine bad rows |
| Large `PATIENT.DBF` import memory | Stream DBF cursor; batch `INSERT` transactions (e.g. 500 rows) |
| Appointment natural key ambiguity | Spike on copy: document unique key; use `source_row_hash` |
| Stale mirror vs fresh copy | Show `lastImportedAt`; define max age; fallback policy (§8) |
| Incremental import correctness | Start full-only; add checksum skip after two stable full runs |
| FTS vs `LIKE` search | Start with `search_blob LIKE`; FTS5 optional later |
| Concurrent import + API reads | WAL mode; import exclusive lock; readers see previous snapshot until commit |
| Sensitive column creep | Code review checklist; importer allowlist per table |

**Open decisions (need product/ops input):**

1. **SQLite file path** — per-user app data vs beside `DATA_ROOT` copy?
2. **Importer trigger** — CLI only vs guarded HTTP `POST /v1/admin/import`?
3. **Stale mirror behavior** — fallback to DBF vs hard error?
4. **Re-import cadence** — manual on copy refresh vs nightly job?
5. **Postgres later** — keep SQL dialect portable (avoid SQLite-only JSON operators in shared queries)?

---

## 14. Definition of done (this document)

- [x] `docs/phase-2-sqlite-mirror-plan.md` exists
- [x] No application code changed
- [x] No PHI or DBF row values included
- [x] No legacy paths modified

---

## 15. Related docs

- `docs/master-build-plan.md` — Phase 2 / 3 alignment
- `docs/phase-1b-legacy-catalog.md` — known DBF basenames
- `docs/phase-1b-patient-search-backend.md` — search DTO and blocked fields
- `docs/phase-1b-medical-summary-backend.md` — medical DTO and blocked memos
- `services/bridge/src/dbf/legacy-catalog-registry.ts` — import source file list
