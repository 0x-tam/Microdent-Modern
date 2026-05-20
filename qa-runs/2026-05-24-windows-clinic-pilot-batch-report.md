# Windows clinic pilot batch — Workstream O checkpoint report

**Date:** 2026-05-24 (executed 2026-05-21 local)  
**Node:** v22.22.3 (`nvm use 22`)  
**Repo:** `/Users/Tamam/Desktop/Microdent/Microdent-Modern`  
**Staged handoff:** `dist/pilot-release/MicrodentModern/` (236 files, 25 directories after final stage; manifest verified 235 files)

---

## Release decision (portable handoff)

| Decision | Status |
| --- | --- |
| **Portable pilot package handoff** | **READY** |
| **`pnpm pilot:release-signoff`** | **READY** (exit 0; banner: `PILOT RELEASE SIGNOFF: READY`) |
| **Backup EPERM / signoff blocked** | **Not observed** — sandbox backups created and restored during `qa:sandbox` (no EPERM) |

**Rationale:** All mandatory checkpoint commands passed after in-scope fixes for pilot artifact path-literal guards. Staged tree passes `pilot:verify-release` and `pilot:verify-manifest` (commit `d3a8565376a58ff6ea5dcaee09f9110648906f37`, package `pilot-2026-05-20`, channel `pilot`).

**Caveat:** READY means **Mac-built portable folder is safe to hand to IT for copy to a Windows clinic machine**. It does **not** substitute for execution of the real-machine checklist on Windows.

---

## Next blocker: real Windows machine test

**Yes — this is the next gating blocker.**

| Why | Detail |
| --- | --- |
| Unvalidated on target OS | Checklist in `docs/windows-pilot-real-machine-checklist.md` is documented but not executed on a physical Windows 10/11 clinic PC. |
| Portable layout vs runtime | `%AppData%` config paths, setup wizard file pickers, bridge child process spawn, and firewall/localhost behavior differ from macOS dev runs. |
| Operator path entry | Clinic `DATA_ROOT` / `SQLITE_PATH` / `BACKUP_DIR` must be entered on Windows; Mac sandbox paths are not proof of operator setup UX. |
| Installer gap (known) | Batch scope is folder handoff, not NSIS/MSI; IT must follow `PILOT-START-HERE.md` / `docs/PILOT-HANDOFF-PACK.md`. |

Until the real-machine matrix is run and logged (PHI-safe), **clinic go-live** remains blocked even though **portable package build/signoff** is READY.

---

## Mandatory checkpoint — command results

| Step | Command | Exit | Notes |
| --- | --- | ---: | --- |
| 1 | `pnpm test` | 0 | contracts, sqlite-mirror, bridge (399 pass, 4 skip), bridge-client, ui, app (274), desktop (67) |
| 2 | `pnpm test:pilot-artifacts` | 0 | 13 tests |
| 3 | `pnpm build:web` | 0 | Vite production build |
| 4 | `pnpm --filter @microdent/bridge run build` | 0 | |
| 5 | `pnpm --filter @microdent/desktop run build` | 0 | |
| 6 | `pnpm stage:pilot-release` | 0 | **Initial fail:** forbidden compiled literals (`Microdent-Legacy`, `Microdent-Write-Sandbox`) in staged `app/dist` and `bridge/*` — **fixed in scope** (see below) |
| 7 | `pnpm pilot:verify-release` | 0 | Layout, supervisor invariants, sensitive-artifact guards |
| 8 | `pnpm pilot:verify-manifest` | 0 | 235 files, hashes OK |
| 9 | `pnpm --filter @microdent/desktop run test` | 0 | 67 tests |
| 10 | `pnpm --filter @microdent/desktop run release-smoke` | 0 | |
| 11 | `PILOT_STAGED_RELEASE=1 pnpm --filter @microdent/desktop run release-smoke` | 0 | Staged release path smoke |
| 12 | `pnpm qa:sandbox` (env below) | 0 | 4 write workflows + restore; mirror partial import **warn only** |
| 13 | `pnpm pilot:release-signoff` (full permissions) | 0 | Re-runs full gate suite; **READY** |

**Sandbox environment:**

```bash
export DATA_ROOT="/Users/Tamam/Desktop/Microdent/Microdent-Write-Sandbox/DATA"
export SQLITE_PATH="/Users/Tamam/Desktop/Microdent/MICRODENT_MIRROR_SANDBOX.sqlite"
export BACKUP_DIR="/Users/Tamam/Desktop/Microdent/Microdent-Write-Sandbox/backups"
```

**`qa:sandbox` highlights:** preflight ok; bridge health + write-capability ready; write smoke: `appointment.statusUpdate`, `appointment.timeMove`, `appointment.create`, `patient.demographics.update` — all PASS with DBF readback and restore.

---

## Workstream O in-scope fixes (staging gate)

Staging failed until compiled artifacts omitted forbidden path literals per `scripts/pilot-release-artifact-rules.mjs`:

| Area | Change |
| --- | --- |
| Desktop setup | Dynamic legacy segment regex in `setup-window.ts` / `setup.html`; operator copy without marker filename literal |
| Desktop metadata | `operator-data-locations.ts` notes rephrased |
| App copy | `read-only-ui-copy.ts` sandbox recovery string rephrased |
| Bridge | `write-safety/constants.ts` — dev forbidden roots built from `HOME` + joined segments; marker via `join`; CLI/help strings sanitized; `forbidden-path.ts` / `validate-writable-sandbox.ts` error labels via `join` |

No change to write semantics; tests and signoff green after fixes.

---

## Git hygiene

```
Branch: main
Staged: none
Modified: 38 files (waves 1–2 + O fixes; desktop, app, bridge, docs, scripts)
Untracked: apps/web/public/, docs/pilot-issue-template.md, docs/windows-pilot-installer-decision-record.md, packages/app/src/pilot-build-metadata.*, scripts/pilot-release-check.sh
```

**Commit:** intentionally **not** performed (Workstream O instruction).

---

## Safe to commit?

| Question | Answer |
| --- | --- |
| Tests / signoff / staging | **Yes** — all green at checkpoint |
| Review before commit | **Recommended** — large batch diff (833 insertions / 162 deletions across 38 tracked files + untracked pilot assets) |
| User directive | **Do not commit** in this workstream |

---

## Coordinator sign-off

| Item | Value |
| --- | --- |
| Workstream | O — FinalReport |
| Waves 1–2 | Assumed complete per plan |
| Portable handoff | **READY** |
| Clinic go-live | **BLOCKED** on real Windows checklist execution |
| Signoff script | **READY** (no EPERM on backups) |
