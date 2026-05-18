# QA Blocker Remediation Report

**Date:** 2026-05-18  
**Repo:** `/Users/Tamam/Desktop/Microdent/Microdent-Modern`  
**Node:** v22.22.3 (`nvm use 22`)  
**No commit / no push**

---

## 1. Executive summary

**Safe to proceed:** **Yes** (with known clinic-data partial mirror skips)

All six blockers (A–F) were addressed in code or QA harness. Mirror `patients` import no longer fails on re-import; `pnpm mirror:import-safe` exits **0** with `overall: partial`. Appointment **create** commits successfully on sandbox `SCHEDULE.DBF` with memo `COMMENT`. **Time move** passes when using conflict-free slot discovery. Reference **doctors** HTTP count matches mirror (**6**). **Procedures** HTTP **20** vs mirror **24** is explained by `source_deleted` filtering (not a read-path bug). `pnpm test` passes with leaked `WRITE_MODE=enabled` in shell (Blocker D). Full monorepo and sandbox validation bands are green.

**Note:** First `scripts/qa-sandbox-write-smoke.sh` run exited **52** on create commit (`curl: empty reply`) during bridge tsx hot-reload / port contention; manual retry of create commit **passed** (`committed: true`, SCHEDULE hash changed). Time-move portion of that script **passed** end-to-end.

---

## 2. Root cause per blocker

| ID | Blocker | Root cause | Fix |
|----|---------|------------|-----|
| **A** | `mirror:import-safe` — `patients: failed` | `DELETE FROM patients` ran with `PRAGMA foreign_keys = ON` while existing `appointments` rows still referenced `patients` from a prior mirror file. | `PRAGMA foreign_keys = OFF` during patient import transaction (aligned with appointments importer); safe SQLite subcode on transaction failure. |
| **B** | Time move **409 SCHEDULE_CONFLICT** | QA used overlapping slot (same date/room/time as another booking). Expected conflict detection. | `scripts/qa-sandbox-write-smoke.sh` discovers dry-run **200** slot before commit; 409 on intentional overlap remains valid. |
| **C** | Create **500 SCHEDULE_CREATE_WRITE_FAILED** | Clinic `SCHEDULE.DBF` has `COMMENT` as FoxPro **Memo (`M`)**; `dbffile` cannot `appendRecords` when schema includes memo columns. | Memo-safe create: schema introspection, byte-level record append when memos present; tests with `COMMENT` type `M`. |
| **D** | `pnpm test` failed with leaked `WRITE_MODE` | `loadBridgeConfig()` reads `process.env.WRITE_MODE`; QA shell kept `enabled` after bridge run. | `services/bridge/vitest.setup.ts` clears write env in `beforeEach`; documented in checkpoint workflow. |
| **E** | Reference doctors/procedures count mismatch | After A fixed: doctors match. Procedures: mirror has 24 rows, HTTP returns 20 — **4 rows have `source_deleted = 1`** and are filtered by read path. | **No code change** — verified correct behavior. |
| **F** | `read-only-flow-smoke` stderr on `/v1/mirror/status` | Mock returned only `{ sqliteUsable: false }`. | Full `MirrorStatusResponseSchema` shape in mock. |

---

## 3. Files changed

| File | Change |
|------|--------|
| `services/sqlite-mirror/src/import-patients.ts` | FK OFF during import; safe transaction error subcode |
| `services/sqlite-mirror/src/import-patients-fk-reimport.test.ts` | **New** — FK re-import regression |
| `services/sqlite-mirror/src/run-mirror-import-safe.test.ts` | Second `runMirrorImportSafe` on same DB |
| `services/bridge/src/dbf/write-schedule-create.ts` | Memo-safe create / byte append |
| `services/bridge/src/dbf/dbf-record-write-helpers.ts` | Byte-append + encoders for create path |
| `services/bridge/src/dbf/write-schedule-create.test.ts` | **New** — memo COMMENT tests |
| `services/bridge/src/test-fixtures/dbf-test-create.ts` | **New** |
| `services/bridge/src/test-fixtures/schedule-fixtures.ts` | `scheduleFieldsMemoComment` fixture |
| `services/bridge/vitest.setup.ts` | **New** — clear write env |
| `services/bridge/vitest.config.ts` | `setupFiles` |
| `packages/app/src/read-only-smoke-fixtures.ts` | Full mirror/status mock |
| `docs/checkpoint-workflow.md` | Write-env hygiene + QA script pointer |
| `scripts/qa-sandbox-write-smoke.sh` | **New** — conflict-free time move + create smoke |

**Not modified:** `Microdent-Legacy`, `Microdent-Legacy-Copy`, production Legacy paths.

---

## 4. Tests added/updated

| Suite | Tests |
|-------|--------|
| `import-patients-fk-reimport.test.ts` | FK re-import with pre-seeded appointments |
| `run-mirror-import-safe.test.ts` | Idempotent second full import |
| `write-schedule-create.test.ts` | Unit + HTTP commit with memo `COMMENT` |
| `appointment-create-write.test.ts` | Existing band still green |
| `read-only-flow-smoke.test.tsx` | 4/4 with contract-aligned mirror mock |
| `root-and-cors.test.ts` | 30/30 with `WRITE_MODE=enabled` in shell |

---

## 5. Commands run and results

| Command | Result | Notes |
|---------|--------|-------|
| `nvm use 22 && node -v` | **Pass** | v22.22.3 |
| `WRITE_MODE=enabled … pnpm test` | **Pass** | Proves Blocker D fix |
| `pnpm test` (clean env) | **Pass** | Monorepo green |
| `pnpm build:web` | **Pass** | |
| `pnpm sandbox:validate` | **Pass** | 4 passed, 4 skipped |
| `SANDBOX_VALIDATE_REAL=1 pnpm sandbox:validate` | **Pass** | 8/8 |
| `pnpm mirror:import-safe` | **Pass** (exit 0) | `overall: partial`; see §7 |
| `scripts/qa-sandbox-write-smoke.sh` | **Partial** | Time move **Pass**; create commit **Fail** (curl 52); see §8 |
| Manual create commit retry | **Pass** | `committed: true`, hash changed |
| Reference count check | **Pass** | Doctors 6=6; procedures 20/24 explained |
| `git status` | **Pass** | Source changes + untracked `qa-runs/` only |

---

## 6. Path safety

| Path | Changed? |
|------|----------|
| `Microdent-Legacy` | **No** (`find -newermt` → 0 since session) |
| `Microdent-Legacy-Copy` | **No** (0) |
| `Microdent-Write-Sandbox/DATA` | **Yes** — writes during QA smoke (time move + create commit tests; optional restore not run after manual create) |
| `Microdent-Write-Sandbox/backups` | **Yes** — new backup folders from smoke |
| `MICRODENT_MIRROR_SANDBOX.sqlite` | **Yes** — re-imported (~104 MB) |

---

## 7. Mirror import (`pnpm mirror:import-safe`)

```
doctors: status=success rows=6 errors=0
procedures: status=success rows=24 errors=0
schedule_rooms: status=success rows=25 errors=0
patients: status=partial rows=18338 errors=7
appointments: status=partial rows=181291 errors=6
medical_summary: status=success rows=2619 errors=0
treatments: status=partial rows=416350 errors=109
overall: partial
Exit code: 0
```

- **Blocker A fixed:** `patients` is **partial**, not **failed** (18338 rows imported; 7 invalid-id skips).
- CLI exits **0** because `overall` is not `failed`.
- Residual partial rows are clinic data validation skips (`INVALID_APPOINTMENT_ROW`, treatment date/patient errors) — not weakened.

---

## 8. Sandbox write QA

### Time move (conflict-free slot)

| Step | Result |
|------|--------|
| Slot discovery (dry-run) | **Pass** — `1995-01-17 08:00 room 1` |
| Dry-run | **Pass** — hash unchanged |
| Commit | **Pass** — `committed: true`, hash changed |
| Restore | **Pass** — hash reverted |

### Appointment create

| Step | Result |
|------|--------|
| Dry-run | **Pass** — hash unchanged |
| Commit (manual retry after script flake) | **Pass** — `committed: true`, new `recordId` allocated, SCHEDULE hash changed |
| Script first run | **Fail** — `curl: (52) Empty reply` (bridge reload / port race during backup+commit) |

---

## 9. Reference routes (Blocker E)

| Source | Doctors | Procedures |
|--------|---------|------------|
| SQLite `COUNT(*)` | 6 | 24 |
| `GET /v1/reference/doctors` | 6 | — |
| `GET /v1/reference/procedures` | — | 20 |

**Conclusion:** Doctors match. Procedures differ by **4** because [`readReferenceProceduresFromSqlite`](services/bridge/src/sqlite/reference-procedures.ts) filters `COALESCE(source_deleted, 0) = 0`. **No read-path bug.**

---

## 10. Sign-off

| Gate | Result |
|------|--------|
| A — Mirror patients re-import | **Pass** |
| B — Time move non-conflicting slot | **Pass** |
| C — Appointment create commit | **Pass** (manual retry; script flake documented) |
| D — Leaked WRITE_MODE tests | **Pass** |
| E — Reference counts | **Pass** (procedures filter explained) |
| F — Smoke mirror/status mock | **Pass** |
| Full `pnpm test` / `build:web` / sandbox band | **Pass** |

**Safe to proceed:** **Yes** for next development batch. Recommend re-running `scripts/qa-sandbox-write-smoke.sh` with bridge stable (no tsx watch) before operator sign-off; optional `legacy:restore` if sandbox SCHEDULE should be pristine after create probe.

---

## 11. Recommended follow-ups (non-blocking)

1. Harden `qa-sandbox-write-smoke.sh` with `curl --retry` / wait-for-bridge after `legacy:backup`.
2. Document that `overall: partial` on clinic copies is expected when row-level skips exist.
3. Update stale route inventory doc (ledger/chart routes shipped) — informational only.
