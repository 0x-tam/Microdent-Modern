# Windows clinic pilot handoff batch report — A–I (2026-05-20)

**Repo:** `/Users/Tamam/Desktop/Microdent/Microdent-Modern`  
**Baseline:** clean `main` at `5221530` (audit-first gap-fill)  
**Branch:** `main` (uncommitted working tree)  
**Coordinator checkpoint:** 2026-05-20  
**Commit policy:** Do not commit unless explicitly instructed.

---

## Wave summary

| Wave | Status | Outcome |
| --- | --- | --- |
| Wave 1 (A, D, E, F, H) | **Done** | Start-here doc; release-smoke web/bridge dist; pilot-checkpoint; pre-installer checklist; guardrails sign-off; path/config tests |
| Wave 2 (B, C, G) | **Done** | Desktop startup error mapping; setup field hints; Settings checklist + backup/QA chips; read-only UI copy polish |
| Wave I (Coordinator) | **PASS** | Full mandatory checkpoint green |

---

## Workstreams

| WS | Verdict | Changes |
| --- | --- | --- |
| **A** PilotHandoffGuide | **Gap-fill** | `docs/PILOT-START-HERE.md` (folder table, numbered flow, troubleshooting, validation commands); links from `README.md`, `windows-pilot-runbook.md` |
| **B** DesktopFirstRun | **Gap-fill** | `setup.html` inline field help + live missing checklist; `startup-failure.ts` operator error mapping; `main.ts` uses mapped messages; tests |
| **C** SettingsReadiness | **Gap-fill** | Backup + QA hint chips in `resolvePilotReadinessSummary`; structured **Pilot checklist** card in Settings; CSS; tests + forbidden tokens unchanged |
| **D** QAReleaseSmoke | **Gap-fill** | `release-smoke.mjs` checks `apps/web/dist/index.html` + `services/bridge/dist/server.js`; root `pilot-checkpoint` script; `scripts/README.md` + phase-7 sync |
| **E** PackagingChecklist | **Gap-fill** | `docs/windows-pilot-pre-installer-checklist.md`; gap report baseline `5221530` + checklist link |
| **F** SafetyAudit | **Gap-fill** | Route inventory audit unchanged (4 PATCH/POST, no DELETE/PUT); `out-of-scope-guardrails.md` operator + dev handoff sign-off tables |
| **G** PilotUIPolish | **Gap-fill** | Today/Patients/Schedule offline + empty copy via `read-only-ui-copy.ts`; write panels audit-only |
| **H** WindowsPathTests | **Gap-fill** | Spaces, UNC, backup-with-spaces, Windows drive-letter shape in `path-validation.test.ts`; AppData-style paths in `config.test.ts`; setup spaces test |
| **I** FinalReport | **Done** | This file |

---

## Mandatory checkpoint

| Step | Result | Notes |
| --- | --- | --- |
| `nvm use 22` | **PASS** | v22.22.3 |
| `pnpm test` | **PASS** | contracts 3; sqlite-mirror 42; bridge 308 (+4 skipped); bridge-client 36; ui 10; app **272**; desktop **43** |
| `pnpm build:web` | **PASS** | Vite production build OK |
| `pnpm qa:sandbox` | **PASS** | 5 sections; 4 workflows; DBF readback `source=dbf`; mirror partial/failed WARN (non-blocking) |
| `pnpm --filter @microdent/desktop run test` | **PASS** | 43 tests |
| `pnpm --filter @microdent/desktop run release-smoke` | **PASS** | desktop + web dist + bridge dist + config/supervisor |
| `git status` | **DIRTY** | 19 modified, 4 untracked; no Legacy/sandbox DATA/sqlite tracked |

### Sandbox env

```bash
export DATA_ROOT="/Users/Tamam/Desktop/Microdent/Microdent-Write-Sandbox/DATA"
export SQLITE_PATH="/Users/Tamam/Desktop/Microdent/MICRODENT_MIRROR_SANDBOX.sqlite"
export BACKUP_DIR="/Users/Tamam/Desktop/Microdent/Microdent-Write-Sandbox/backups"
```

### Sandbox excerpt

```
[qa-write-smoke] readback workflow=appointment.statusUpdate source=dbf appointment_id=100 status=2
[qa-write-smoke] === qa-sandbox-write-smoke complete (4 workflows) ===
========== qa:sandbox complete ==========
[release-smoke] desktop dist, web dist, bridge dist, config defaults, and supervisor entrypoint OK
```

---

## Changed files

**Modified (19):**

- `README.md`
- `apps/desktop/scripts/release-smoke.mjs`
- `apps/desktop/src/{config.test.ts,main.ts,path-validation.test.ts,setup/setup-window.test.ts,setup/setup.html}`
- `docs/{out-of-scope-guardrails.md,phase-7-sandbox-pilot-qa-runbook.md,windows-pilot-packaging-gap-report.md,windows-pilot-runbook.md}`
- `package.json`
- `packages/app/src/{SettingsPanel.tsx,app-shell.css,read-only-ui-copy.ts,settings-panel.test.tsx,settings-status.test.ts,settings-status.ts}`
- `scripts/README.md`

**Untracked (4):**

- `apps/desktop/src/{startup-failure.ts,startup-failure.test.ts}`
- `docs/{PILOT-START-HERE.md,windows-pilot-pre-installer-checklist.md}`

**Not tracked (correct):** sandbox DATA, `.sqlite`, Legacy trees, `dist/`, `node_modules/`

---

## Safe to commit?

**Yes** — focused handoff gap-fill; no new write domains; forbidden-token tests pass; route inventory green.

Suggested message:

```
feat(pilot): handoff start-here, settings checklist, release-smoke dist checks

Consolidate operator entry doc, pilot-checkpoint script, Settings readiness
checklist, desktop startup error mapping, and pre-installer checklist for
Windows clinic pilot handoff.
```

---

## Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| `release-smoke` now requires pre-built web + bridge dist | Low | Documented in PILOT-START-HERE; `pilot-checkpoint` runs `build:web` first |
| `pnpm qa:sandbox` still bash-oriented on Windows | Medium | phase-6 manual §7; pre-installer checklist marks **Blocked** for cross-platform orchestrator |
| Mirror partial/failed imports in sandbox | Low | WARN only in qa:sandbox §4; DBF readback still authoritative |
| No git `origin` / Windows CI | Medium | Out of scope this batch; next batch item |

---

## Blockers

None for pilot handoff documentation and checkpoint. Installer/signing/auto-update remain **Blocked** by design (documented in pre-installer checklist).

---

## Recommended next batch

1. Configure `origin` + Windows CI running `pnpm pilot-checkpoint` and sandbox QA.
2. Electron-builder / NSIS spike (no new write domains).
3. Cross-platform `qa-sandbox-run.mjs` for Windows without Git Bash.
