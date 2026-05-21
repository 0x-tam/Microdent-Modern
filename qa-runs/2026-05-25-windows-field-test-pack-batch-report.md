# Windows field test pack — batch report

**Date:** 2026-05-25  
**Workstream:** O (Mac checkpoint coordinator)  
**Baseline commit (manifest):** `3f11e670f84b34b44b1f72fb3e6b461a48688466`  
**Branch:** `main`  
**Commit performed:** No (per batch instructions)

## Summary

Waves 1–2 delivered the Windows field-execution documentation pack and staging integration. Wave 3 Mac checkpoint completed successfully: full test suite, production builds, pilot staging, artifact tests, and release/manifest verification all passed. The staged package under `dist/pilot-release/MicrodentModern/` includes the new field docs (244 files, 25 directories).

## Status tiers (mandatory)

| Tier | Question | Status |
| --- | --- | --- |
| **1. Mac-side release readiness** | Build, stage, verify on Mac? | **READY** (checkpoint: test, build, stage, verify, manifest) |
| **2. Windows-test readiness** | Field pack in staged tree for scheduled Windows test? | **READY** (field docs listed below) |
| **3. Windows execution status** | Real Windows clinic PC run logged? | **Deferred / Not yet run** |
| **Clinic go-live** | Production clinic sign-off? | **BLOCKED** (until tier 3 complete + go/no-go) |

## Files changed (all waves)

### Modified (7)

| Path | Wave / purpose |
| --- | --- |
| `docs/PILOT-HANDOFF-PACK.md` | Cross-links to field pack entry points |
| `docs/PILOT-START-HERE.md` | Troubleshooting pack pointer |
| `docs/pilot-issue-template.md` | Issue intake (severity, reproduce, safe logs/screenshots) |
| `docs/windows-pilot-data-locations.md` | Permission/path risks link |
| `docs/windows-pilot-real-machine-checklist.md` | Execution script + matrix cross-links |
| `scripts/pilot-release-artifact-rules.mjs` | Required staged layout for new docs |
| `scripts/stage-pilot-release.mjs` | Copy list for field pack docs |

### New (9)

| Path | Wave / purpose |
| --- | --- |
| `docs/FIELD-TEST-START-HERE.md` | Field pack index |
| `docs/windows-pilot-field-execution-script.md` | Linear day-0 execution script (A) |
| `docs/windows-pilot-field-result-form.md` | PHI-safe result capture (B) |
| `docs/windows-pilot-troubleshooting-pack.md` | Windows troubleshooting (C) |
| `docs/windows-pilot-package-verify-on-windows.md` | IT package verify without repo (D) |
| `docs/windows-pilot-permission-and-path-risks.md` | ACL/AV/path risks (F) |
| `docs/windows-pilot-go-no-go-checklist.md` | Go/no-go decision table (G) |
| `docs/windows-pilot-release-notes.md` | Pilot release notes (H) |
| `qa-runs/TEMPLATE-windows-field-run.md` | Completed run filing template (I) |

## Mac checkpoint results

| Step | Command | Result |
| --- | --- | --- |
| Node | `nvm use 22` | OK (v22.22.3) |
| Tests | `pnpm test` | **PASS** — contracts 3; sqlite-mirror 42; bridge 399 (+4 skipped); bridge-client 36; ui 10; app 274; desktop 67 |
| Web build | `pnpm build:web` | **PASS** (Vite production build) |
| Bridge build | `pnpm --filter @microdent/bridge run build` | **PASS** |
| Desktop build | `pnpm --filter @microdent/desktop run build` | **PASS** |
| Stage | `pnpm stage:pilot-release` | **PASS** — 244 files, 25 dirs under `dist/pilot-release/MicrodentModern/` |
| Artifact tests | `pnpm test:pilot-artifacts` | **PASS** — 13/13 |
| Release verify | `pnpm pilot:verify-release` | **PASS** — layout, supervisor invariants, manifest hashes, sensitive-artifact guards |
| Manifest verify | `pnpm pilot:verify-manifest` | **PASS** — 243 files (app 0.0.1, package `pilot-2026-05-21`, channel `pilot`, commit `3f11e67…`) |

No staging failures; no in-scope fixes required.

## Windows-test readiness (tier 2)

**READY** — Mac-side materials are complete and verified in the staged pilot tree, including:

- `docs/windows-pilot-field-execution-script.md`
- `docs/windows-pilot-field-result-form.md`
- `docs/windows-pilot-troubleshooting-pack.md`
- `docs/windows-pilot-package-verify-on-windows.md`
- `docs/windows-pilot-go-no-go-checklist.md`
- `docs/windows-pilot-release-notes.md`
- `docs/FIELD-TEST-START-HERE.md`
- `qa-runs/TEMPLATE-windows-field-run.md` (repo template; staged copy under package `qa-runs/` per layout rules)

**Windows execution (tier 3):** **Deferred / Not yet run** — field pack is ready when IT schedules a test; this batch did not execute on a clinic PC.

## Remaining blocker before clinic go-live

1. **Real Windows field run** — IT/operator must execute the script on a clinic PC, complete `windows-pilot-field-result-form` / `qa-runs/TEMPLATE-windows-field-run.md`, and run go/no-go.
2. **Package delivery** — Zip `dist/pilot-release/MicrodentModern/` (or equivalent IT handoff) to the Windows machine; verify per `windows-pilot-package-verify-on-windows.md` on Windows.
3. **Prior Mac signoff still applies** — Clinic pilot remains blocked on Windows validation until field log and go/no-go are recorded (same class of blocker as 2026-05-24 clinic pilot batch).

No new code or write-domain blockers identified from this checkpoint.

## Safe to commit?

**Yes (recommended when user approves)** — Changes are documentation and pilot staging scripts only; checkpoint green; no secrets or patient data in the diff.

**This run:** commit **not** created (explicit batch instruction).

## Git status hygiene

| Check | Status |
| --- | --- |
| `.sqlite` in working tree / staged | **None** |
| `DATA/` paths in working tree / staged | **None** |
| `dist/` tracked or staged | **No** — `dist/pilot-release` ignored via `.gitignore` |
| Untracked field pack files | 9 new docs/templates (expected) |
| Modified files | 7 (docs + staging scripts) |

**Note:** Repository already tracks `services/bridge/fixtures/sandbox/FAKE_TINY.dbf` (intentional test fixture, pre-existing); not introduced by this batch.

### `git status` at checkpoint end

- **Modified:** 7 files (listed above)  
- **Untracked:** 9 files (listed above)  
- **Untracked report:** `qa-runs/2026-05-25-windows-field-test-pack-batch-report.md` (this file)

## Next steps (operator / IT)

1. Commit doc + staging changes when ready.  
2. Re-stage if needed after commit: `pnpm stage:pilot-release`.  
3. Ship staged `MicrodentModern` folder to Windows.  
4. Follow `docs/FIELD-TEST-START-HERE.md` → execution script → result form → go/no-go.
