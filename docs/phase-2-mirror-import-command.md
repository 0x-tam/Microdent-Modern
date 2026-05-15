# Phase 2 — Safe mirror import command

**Status:** Implemented — operator CLI and programmatic API in `@microdent/sqlite-mirror`.

**Scope:** One command applies SQLite migrations and imports **safe** tables only from a read-only `DATA_ROOT` copy. Does **not** import ledger amounts, chart notes, treatment descriptions, payment details, or raw DBF rows.

---

## Command

From the repo root (requires **Node ≥ 22.5** for `node:sqlite`):

```bash
export DATA_ROOT="/absolute/path/to/Microdent-Legacy-Copy/DATA"
export SQLITE_PATH="/absolute/path/to/MICRODENT_MIRROR.sqlite"
pnpm mirror:import-safe
```

Both variables must be **absolute** paths. The shell wrapper and CLI refuse to run when either is unset, blank, or relative.

**Stdout** prints counts and status only, for example:

```text
migrations: applied=2 skipped=4
doctors: status=success rows=12 errors=0
procedures: status=success rows=840 errors=0
patients: status=success rows=15234 errors=0
appointments: status=success rows=98210 errors=0
medical_summary: status=success rows=12000 errors=0
treatments: status=partial rows=419800 errors=12
overall: partial
```

No patient names, phones, clinical text, paths, or row payloads are printed.

---

## Import order

1. Schema migrations (`applyMigrations`)
2. `doctors` ← `DOCTORS.DBF`
3. `procedures` ← `PROCCHRT.DBF`
4. `patients` ← `PATIENT.DBF`
5. `appointments` ← `SCHEDULE.DBF` (skipped if file absent)
6. `medical_summary` ← `MEDICAL.DBF` (skipped if file absent)
7. `treatments` ← `OPERTBL.DBF` (skipped if file absent; loose read mode)

Each table write creates its own `import_runs` audit row. Optional sources record `skipped` when the DBF is missing under `DATA_ROOT`.

---

## Blocked data (never imported)

| Area | Excluded |
| --- | --- |
| Ledger | `TRANS.DBF` amounts, payment metadata |
| Chart | `CHARTDBF.DBF` odontogram lines, `NOTE` memos |
| Treatments | `DESCRIPT`, `DESC`, fees, charges, insurance fields |
| Schedule | `PAT_NAME`, `TELEPHONE`, `COMMENT` body |
| Medical | `PROBLEM`, `ALLERGY_TO`, `NOTES` |
| Patients | Full phones, addresses, memos (see `docs/phase-2-patient-importer.md`) |

---

## Programmatic API

```ts
import { runMirrorImportSafe, loadMirrorEnvFromProcess } from "@microdent/sqlite-mirror";

const loaded = loadMirrorEnvFromProcess();
if (!loaded.ok) throw new Error("configure DATA_ROOT and SQLITE_PATH");

const result = await runMirrorImportSafe(loaded.env);
```

Individual importers remain available: `importDoctors`, `importProcedures`, `importPatients`, `importAppointments`, `importMedicalSummary`, `importTreatments`.

---

## Tests

- `services/sqlite-mirror/src/mirror-env.test.ts` — env validation
- `services/sqlite-mirror/src/import-appointments.test.ts` — synthetic `SCHEDULE.DBF` only
- Existing importer tests for doctors, procedures, patients

CI uses **synthetic fixtures** only; never point tests at a real clinic copy.

---

## Related docs

- `docs/phase-2-sqlite-schema.md` — schema and migrations
- `docs/phase-2-reference-importers.md` — doctors & procedures
- `docs/phase-2-patient-importer.md` — patients
- `docs/phase-2-sqlite-mirror-plan.md` — full Phase 2 architecture
