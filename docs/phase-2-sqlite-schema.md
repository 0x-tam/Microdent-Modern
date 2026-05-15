# Phase 2.1 — SQLite mirror schema

**Status:** Schema and migration runner only. No DBF import, no bridge read paths, no UI changes.

**Package:** `@microdent/sqlite-mirror` (`services/sqlite-mirror`)

---

## SQLite driver decision

| Check | Result |
| --- | --- |
| Project default Node (v20.x) | `node:sqlite` **not** available |
| Node ≥ 22.5 | Built-in `node:sqlite` (`DatabaseSync`) **available** |
| Third-party package (e.g. `better-sqlite3`) | **Not added** — deferred unless Node 22+ cannot be used in deployment |

**Decision:** Use **built-in `node:sqlite`** only. The mirror package declares `"engines": { "node": ">=22.5.0" }`. Bridge and web packages remain on the root `>=18` engine; only mirror migrations and tests require Node 22.5+.

Operators and CI jobs that run mirror tests or future import CLI must use Node 22.5 or newer. No extra npm dependency was introduced for Phase 2.1.

---

## Schema overview

Canonical read-model tables aligned with `docs/phase-2-sqlite-mirror-plan.md`. No PHI columns (no full phones, addresses, memo text, or clinical free text).

### Import metadata

| Table | Purpose |
| --- | --- |
| `import_runs` | Audit row per import attempt (`status`, `"trigger"`, JSON counts) |
| `import_errors` | Sanitized errors linked to `run_id` (no cell values) |
| `schema_migrations` | Runner bookkeeping (not domain data) |

### Domain (empty after 2.1)

| Table | Primary key |
| --- | --- |
| `patients` | `patient_id` |
| `doctors` | `doctor_id` |
| `procedures` | `procedure_code` |
| `schedule_rooms` | `room_id` |
| `appointments` | `appointment_id` |
| `medical_summary` | `patient_id` |

`import_source_checksums` is planned for incremental import (Phase 2.2+) and is **not** created yet.

---

## Indexes

Defined in `sql/migrations/002_indexes.sql`:

| Index | Table | Columns |
| --- | --- | --- |
| `idx_patients_display_name` | `patients` | `display_name` |
| `idx_patients_chart_number` | `patients` | `chart_number` (partial: `WHERE chart_number IS NOT NULL`) |
| `idx_appointments_date` | `appointments` | `appointment_date` |
| `idx_appointments_patient` | `appointments` | `patient_id` |
| `idx_appointments_room` | `appointments` | `room_id` |
| `idx_appointments_doctor` | `appointments` | `doctor_id` |
| `idx_appointments_date_room` | `appointments` | `appointment_date`, `room_id` |
| `idx_import_runs_finished` | `import_runs` | `finished_at DESC` |

Primary keys on domain tables do not need separate indexes.

---

## Migration behavior

**Location:** `services/sqlite-mirror/sql/migrations/*.sql` (lexicographic order).

| File | Contents |
| --- | --- |
| `001_initial.sql` | Tables, foreign keys, `PRAGMA foreign_keys` |
| `002_indexes.sql` | Secondary indexes |

**API:** `applyMigrations(sqlitePath)` from `@microdent/sqlite-mirror`:

1. Verifies Node ≥ 22.5 (for `node:sqlite`).
2. Creates parent directories for `sqlitePath` if needed.
3. Opens the database, sets `journal_mode=WAL` and `foreign_keys=ON`.
4. For each `.sql` file not listed in `schema_migrations`, runs the script inside a transaction and records the version (filename without `.sql`).
5. Skips already-applied versions on re-run (idempotent).

**Planned env (not wired in bridge yet):** `SQLITE_PATH` — absolute path to the mirror file (e.g. user app data dir, not in git).

---

## Intentionally not implemented (Phase 2.1)

- DBF / legacy file reads and row import
- `import_source_checksums` table
- Importer CLI or bridge admin routes
- Bridge `READ_MODEL=sqlite` or repository adapters
- `GET /v1/meta/import-status`
- Real `DATA_ROOT` or production copy usage in automated tests
- UI changes
- npm SQLite dependencies

Next band (2.2): importer for `doctors`, `procedures`, `patients` writing `import_runs` / `import_errors`, still using copied DBF only at import time.

---

## Related docs

- `docs/phase-2-sqlite-mirror-plan.md` — full Phase 2 architecture
- `services/sqlite-mirror/sql/migrations/` — source SQL
