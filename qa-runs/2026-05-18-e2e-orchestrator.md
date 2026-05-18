# Microdent Modern — E2E QA Orchestrator Report

**Run date:** 2026-05-18  
**Session start (UTC):** `2026-05-18T09:53:10Z`  
**Repo:** `/Users/Tamam/Desktop/Microdent/Microdent-Modern`  
**Operator mode:** No commits, no push, no Legacy/Legacy-Copy writes

---

## 1. Executive summary

**Safe to proceed:** **No**

Preflight toolchain and automated sandbox band tests passed. Disposable sandbox creation, path sentinels, and three of four operator write workflows (status update, demographics update, blocked-field guards) behaved as expected on `Microdent-Write-Sandbox/DATA` only. **Blockers:** `pnpm mirror:import-safe` exited non-zero (`patients` import failed; `appointments`/`treatments` partial); appointment **time move** returned **409 SCHEDULE_CONFLICT** for the chosen slot; appointment **create** commit did not complete successfully (dry-run OK; commit path failed / **500** on follow-up probe). Phase H `pnpm test` failed once because `WRITE_MODE=enabled` leaked into the test shell; with env cleared, full suite is green again. Manual UI checklist was not run (no browser automation). Recommend fixing mirror patient import and re-running G2/G3 with conflict-free fixtures before pilot sign-off.

---

## 2. Command log

| Phase | Command | Pass/Fail | Notes |
|-------|---------|-----------|-------|
| A | `cd QA_REPO` | Pass | |
| A | `nvm use 22 && node -v` | Pass | v22.22.3 (≥ 22.5) |
| A | `pnpm test` | Pass | All workspace tests green |
| A | `pnpm build:web` | Pass | Vite build OK |
| A | `git status --porcelain` (preflight) | Pass | Clean at start |
| A | `pnpm --filter @microdent/app exec vitest run read-only-flow-smoke` | Pass | 4/4; stderr schema mismatch on mocked `/v1/mirror/status` (informational) |
| B | `export SOURCE_DATA_ROOT SANDBOX_ROOT` | Pass | |
| B | `pnpm legacy:create-sandbox` | Pass | `create-sandbox: ok`, 470 files, marker present |
| B | `test -f DATA_ROOT/.microdent-write-sandbox.json` | Pass | |
| B | `test -d BACKUP_DIR` | Pass | |
| B | `realpath DATA_ROOT` | Pass | Under `Microdent-Write-Sandbox` |
| B | Path sentinels (`find -newermt`) | Pass | Legacy=0, Legacy-Copy=0 |
| C | `export DATA_ROOT SQLITE_PATH` | Pass | |
| C | `pnpm mirror:import-safe` | **Fail** | Exit 1; `patients: failed`; `appointments: partial`; `treatments: partial`; `overall: failed` |
| C | PHI scan on mirror log | Pass | No forbidden tokens in import stdout |
| C | `sqlite3 … import_runs` | Partial | Latest `partial`, `tables_succeeded=["treatments"]` |
| C | `sqlite3 … import_errors` (aggregates) | Pass | Counts only |
| D | `pnpm sandbox:validate` | Pass | 4 passed, 4 skipped |
| D | `SANDBOX_VALIDATE_REAL=1 pnpm sandbox:validate` | Pass | 8 passed, 0 skipped |
| D | Path sentinels | Pass | Legacy=0, Legacy-Copy=0 |
| E | `pnpm dev:kill-ports` | Pass | |
| E | `pnpm dev:ports` | Pass | Ports free after kill |
| E | `pnpm dev:bridge` (background) | Pass | `WRITE_MODE=enabled`, ack, `DATA_ROOT`, `SQLITE_PATH`, `BACKUP_DIR` |
| E | `pnpm dev:web` (background) | Pass | Started; not exercised in browser |
| E | `curl BRIDGE_URL/health` | Pass | `ok: true` |
| F | `GET /health` | Pass | |
| F | `GET /v1/mirror/status` | Pass | `sqliteUsable: true`, 7 imported tables |
| F | `GET /v1/legacy/catalog` | Pass | 11 tables, all present |
| F | `GET /v1/meta/write-capability` | Pass | `enabled`, `writesPermitted: true`, `writableSandbox: true` |
| F | `GET /debug/status` | Pass | Enabled write flags (non-prod) |
| F | `GET /v1/patients/search?q=<2-char mirror token>` | Pass | HTTP 200, `resultCount: 20` (token not logged) |
| F | `GET /v1/patients/10/profile` | Pass | `patientId`, `active`; chartNumber null |
| F | `GET /v1/schedule/appointments?from&to` | Pass | `appointmentCount: 11` (date range only) |
| F | `GET /v1/patients/10/appointments` | Pass | Empty list for range |
| F | `GET …/medical-summary` | Pass | Structural keys only |
| F | `GET …/treatments` | Pass | No `descript`/`fee` keys |
| F | `GET …/chart` | Pass | `entryCount: 52` |
| F | `GET …/ledger` | Pass | `hasAmount: false`, privacy note present |
| F | `GET /v1/reference/doctors`, `/procedures` | Pass | Counts 1/1 (mirror partial may under-represent) |
| F | Forbidden-token scan on HTTP log | **Fail*** | *False positive:* `privacyNote` strings contain substrings `descript`, `fee`, `amount` |
| G | Sandbox preflight (`realpath`, marker) | Pass | |
| G1 | Status dry-run / commit / restore | Pass | Hashes revert; audit row for status update |
| G1 | Blocked `COMMENT` on status PATCH | Pass | HTTP 400 |
| G2 | Time move dry-run / commit | **Fail** | HTTP **409** (`SCHEDULE_CONFLICT`) for appt 100, room 1, time 18:00 |
| G2 | Time move restore + blocked `PAT_NAME` | Pass / Pass | Restore hash OK; blocked 400 |
| G3 | Create dry-run | Pass | SCHEDULE hash unchanged |
| G3 | Create commit | **Fail** | No SCHEDULE hash change; follow-up probe **500** `SCHEDULE_CREATE_WRITE_FAILED` |
| G3 | Create restore + blocked `TELEPHONE` | Pass / Pass | |
| G4 | Demographics dry-run / commit / restore | Pass | PATIENT hashes revert |
| G4 | Blocked `HOME_PHONE` | Pass | HTTP 400 |
| G | Path sentinels (post-writes) | Pass | Legacy=0, Legacy-Copy=0 |
| G | Optional `pnpm mirror:import-safe` | **Fail** | Same patient import failure |
| H | `pnpm dev:kill-ports` | Pass | |
| H | `pnpm test` (with write env leaked) | **Fail** | 1 test: `root-and-cors` expected disabled write mode |
| H | `pnpm test` (env unset) | Pass | 188/188 app + full monorepo when re-run clean |
| H | `pnpm build:web` | Pass | |
| H | `git status` | Pass* | Only untracked `qa-runs/` (*expected QA artifacts) |
| H | Path sentinels | Pass | Legacy=0, Legacy-Copy=0 |

**Supporting logs:** `qa-runs/2026-05-18-preflight.log`, `qa-runs/2026-05-18-e2e-commands.log`, `qa-runs/2026-05-18-mirror-import.log`, `qa-runs/2026-05-18-http.log`, `qa-runs/2026-05-18-phase-g*.log`

---

## 3. Skipped steps

| Step | Reason |
|------|--------|
| E4 Manual UI checklist (phase-1b §1–13) | **SKIPPED — no browser** (bridge/web started; no IDE browser MCP UI walkthrough) |
| Cursor IDE browser automation | Not used |
| `GET /v1/meta/write-audit-recent` after G | Audit verified via `sqlite3 write_audit_log` instead |
| `GET /v1/tables/:tableId/rows` | Out of scope per plan (full row payloads) |

---

## 4. Files changed during QA

| Location | Change |
|----------|--------|
| `Microdent-Modern/qa-runs/*` | **Created** — logs, scripts, this report (untracked in git) |
| `Microdent-Write-Sandbox/DATA/**` | **Replaced** via `legacy:create-sandbox`; DBF writes + restores during G |
| `Microdent-Write-Sandbox/backups/**` | **Created** — workflow backup folders (see §6) |
| `~/Desktop/Microdent/MICRODENT_MIRROR_SANDBOX.sqlite` | **Created/updated** (~104 MB) |
| `Microdent-Legacy` | **Not modified** |
| `Microdent-Legacy-Copy` | **Not modified** |
| Application source in repo | **Not modified** |

---

## 5. Legacy / Legacy-Copy / sandbox status

| Tree | Status |
|------|--------|
| `Microdent-Legacy` | Unchanged (`find -newermt QA_START_ISO` → **0** files) |
| `Microdent-Legacy-Copy` | Unchanged (**0** new files) |
| `Microdent-Write-Sandbox/DATA` | Fresh copy from Legacy-Copy at B; operator writes only here |
| `Microdent-Write-Sandbox/backups` | Preserved across sandbox reset; new backup dirs appended in G |

---

## 6. Backup folders created (names only)

```
20260518T100648Z__appointment.statusUpdate__3e8a3191
20260518T100648Z__appointment.statusUpdate__7de150a5
20260518T100654Z__appointment.timeMove__05f36be3
20260518T100928Z__appointment.timeMove__52b71102
20260518T100944Z__appointment.create__2541ab1f
20260518T100946Z__appointment.create__9bba08f4
20260518T100957Z__patient.demographics.update__ab993ee4
20260518T100958Z__patient.demographics.update__2d7b5e7c
20260518T101107Z__appointment.create__1bd92009
20260518T101112Z__appointment.create__bbe65778
```

---

## 7. Mirror file

| Property | Value |
|----------|--------|
| Path | `/Users/Tamam/Desktop/Microdent/MICRODENT_MIRROR_SANDBOX.sqlite` |
| Size | ~104 MB |
| Latest import | `partial` / `overall: failed` |
| Notable errors (counts) | `patient` INVALID_PATIENT_ID×7, PATIENT_IMPORT_TRANSACTION_FAILED×1; `appointments` INVALID_APPOINTMENT_ROW×12; `treatments` date/patient errors |

---

## 8. PHI exposure

| Question | Answer |
|----------|--------|
| PHI in shared QA logs? | **No** intentional patient names/phones/amounts logged |
| Forbidden-token scan | **Inconclusive / false positive** on F HTTP log due to static `privacyNote` text matching pattern (`descript`, `fee`, `amount`) |
| Mirror import stdout | **Pass** — counts only |
| Write response bodies in report | **No** — operation/workflow/HTTP codes only |

---

## 9. Write scope confirmation

All enabled commits and restores targeted **`/Users/Tamam/Desktop/Microdent/Microdent-Write-Sandbox/DATA`** only:

- `realpath` contains `Microdent-Write-Sandbox`
- `.microdent-write-sandbox.json` present with disposable marker
- `ALLOW_LEGACY_WRITES=I_UNDERSTAND_THIS_IS_A_DISPOSABLE_COPY` set for bridge only
- Legacy and Legacy-Copy sentinels **0** throughout

---

## 10. Recommended fixes

1. **Mirror `patients` import** — Investigate `PATIENT_IMPORT_TRANSACTION_FAILED` / `INVALID_PATIENT_ID`; blocking clean `overall: success`.
2. **G2 time move** — Re-test with a non-conflicting date/time/room (409 is expected when slot overlaps).
3. **G3 appointment create** — Diagnose `SCHEDULE_CREATE_WRITE_FAILED` (500) on real clinic sandbox SCHEDULE; verify `patId` linkage and ID allocation.
4. **Bridge hot-reload during `legacy:backup`** — Pre-build bridge before operator QA or run backup with bridge stopped to avoid `EADDRINUSE` / empty curl replies.
5. **Test hygiene** — Unset `WRITE_MODE` / `ALLOW_LEGACY_WRITES` before `pnpm test` in CI/docs (H false failure).
6. **Contract drift** — `read-only-flow-smoke` stderr: `/v1/mirror/status` mock missing `sqliteConfigured`, `importedTables`, `latestImportRuns`.
7. **Reference routes** — Doctors/procedures returned count 1 via HTTP despite mirror importing 6/24 rows (verify read path vs mirror).
8. **Doc** — Route inventory vs shipped chart/ledger tabs (informational).

---

## 11. Sign-off table (phases A–H)

| Phase | Gate | Result |
|-------|------|--------|
| **A** Preflight (node, test, build, git hygiene) | Pass |
| **B** Sandbox create + sentinels | Pass |
| **C** Mirror import-safe | **Fail** (patients failed) |
| **D** Automated sandbox validate (dry + real) | Pass |
| **E** Bridge + web local | Pass (UI skipped) |
| **F** HTTP read smoke | Pass* (*PHI scan false positive) |
| **G** Operator sandbox writes (4 workflows) | **Partial** — G1/G4 pass; G2/G3 fail |
| **H** Final test/build/sentinels | **Partial** — build OK; test OK when env clean; mirror re-import fail |

**Overall orchestration:** **FAIL**

---

## Parent handoff

| Field | Value |
|-------|--------|
| **Report path** | `/Users/Tamam/Desktop/Microdent/Microdent-Modern/qa-runs/2026-05-18-e2e-orchestrator.md` |
| **Overall** | **FAIL** |
| **Safe to proceed** | **No** |
| **Blockers** | Mirror patient import failure; appointment time-move conflict (409); appointment create commit failure (500); mirror `overall: failed` |
