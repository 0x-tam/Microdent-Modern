# Windows Pilot RC batch report — A–L (2026-05-20)

**Repo:** `/Users/Tamam/Desktop/Microdent/Microdent-Modern`  
**Baseline:** clean `main` at `678585f` (audit-first gap-fill)  
**Branch:** `main` (uncommitted working tree)  
**Coordinator checkpoint:** 2026-05-20  
**Commit policy:** Do not commit unless explicitly instructed.

---

## Wave summary

| Wave | Status | Outcome |
| --- | --- | --- |
| Wave 1 (A, E, F, J, K, L) | **Done** | Desktop re-open setup + release-smoke invariant; pilot QA script; backup/restore doc; handoff pack; guardrails log sweep; packaging RC docs |
| Wave 2 (B+C, D) | **Done** | Settings checklist +8 rows; setup.html alignment; mirror copy verified |
| Wave 3 (G+H, I) | **Done** | Write UX copy polish; read-only clinic copy polish |
| Coordinator | **PASS** | Full mandatory checkpoint green |

---

## Workstreams

| WS | Verdict | Changes |
| --- | --- | --- |
| **A** DesktopRCFlow | **Gap-fill** | `main.ts` re-open setup dialog on path failures; `startup-failure.ts` helper; `release-smoke.mjs` requires `startup-failure.js` dist; README pilot launcher table |
| **B+C** SetupAndReadiness | **Gap-fill** | `setup.html` sandbox terminology; setup save → Settings checklist hint; checklist +2 rows (DATA_ROOT safe, mirror import); CSS hierarchy; tests |
| **D** MirrorWorkflow | **Audit-only** | `mirror-status.ts` already safe; phase-4 pilot RC section present; Settings mirror strings consumed |
| **E** PilotQA | **Gap-fill** | `scripts/pilot-full-checkpoint.sh` + `pnpm pilot:full-checkpoint`; qa script read-only pointers; phase-7 + PILOT-START-HERE sync |
| **F** BackupRestoreConfidence | **Gap-fill** | Write panels already use `write-operation-feedback.ts` (audit-only); new `docs/pilot-backup-restore-audit.md` |
| **G+H** WritePilotUX | **Gap-fill** | Sandbox banner + demographics hint copy; forbidden-token-safe wording |
| **I** ClinicPolish | **Gap-fill** | Today/Patients/Schedule/Profile lede copy via `read-only-ui-copy.ts` |
| **J** HandoffPack | **Gap-fill** | PILOT-START-HERE @ `678585f`; issue template; `docs/pilot-tester-guide.md`; scripts/README |
| **K** Guardrails | **Audit-only** | Route inventory unchanged (green); forbidden-token tests extended via checklist; log sweep note in out-of-scope doc |
| **L** PackagingRC | **Gap-fill** | Packaging gap + pre-installer checklist @ `678585f`; SmartScreen / file locking / `%AppData%` logs |

---

## Mandatory checkpoint

| Step | Result | Notes |
| --- | --- | --- |
| `nvm use 22` | **PASS** | v22.22.3 |
| `pnpm test` | **PASS** | contracts 3; sqlite-mirror 42; bridge 308 (+4 skipped); bridge-client 36; ui 10; app **272**; desktop **44** |
| `pnpm build:web` | **PASS** | Vite production build OK |
| `pnpm qa:sandbox` | **PASS** | 5 sections; 4 workflows; DBF readback `source=dbf`; mirror partial WARN (non-blocking) |
| `pnpm --filter @microdent/desktop run test` | **PASS** | 44 tests |
| `pnpm --filter @microdent/desktop run release-smoke` | **PASS** | dist + web + bridge + supervisor invariants |
| `git status` | **DIRTY** | 24 modified, 3 untracked; no Legacy/sandbox DATA/sqlite tracked |

### Sandbox excerpt

```
[qa-write-smoke] readback workflow=appointment.statusUpdate source=dbf appointment_id=100 status=2
[qa-write-smoke] === qa-sandbox-write-smoke complete (4 workflows) ===
========== qa:sandbox complete ==========
[qa-sandbox-run] WARN: mirror has partial/failed table imports — DBF remains source of truth for writes
```

---

## Changed files

**Modified (24):**  
`apps/desktop/{README.md,scripts/release-smoke.mjs,src/{main.ts,startup-failure.ts,startup-failure.test.ts,setup/setup.html,setup/setup-window.ts}}`  
`docs/{PILOT-START-HERE.md,out-of-scope-guardrails.md,phase-7-sandbox-pilot-qa-runbook.md,windows-pilot-packaging-gap-report.md,windows-pilot-pre-installer-checklist.md}`  
`package.json`  
`packages/app/src/{PatientDemographicsWritePanel.tsx,app-shell.css,appointment-status-write.test.tsx,read-only-ui-copy.ts,settings-operator-next-step.ts,settings-panel.test.tsx,settings-status.ts,settings-status.test.ts}`  
`scripts/{README.md,qa-sandbox-run.sh,qa-sandbox-write-smoke.sh}`

**Untracked (3):**  
`docs/pilot-backup-restore-audit.md`  
`docs/pilot-tester-guide.md`  
`scripts/pilot-full-checkpoint.sh`

**Not tracked (correct):** sandbox DATA, `.sqlite`, Legacy trees, `dist/`, `node_modules/`

---

## Safe to commit?

**Yes** — focused pilot RC batch A–L gap-fill on `678585f`. Suggested message:

```
feat(pilot-rc): batch A-L gap-fill for Windows clinic RC

Add pilot full checkpoint script, desktop re-open setup recovery,
Settings checklist rows for forbidden DATA_ROOT and mirror import,
handoff docs and backup/restore audit, packaging RC notes, and
read-only/write UX copy polish without new write domains.
```

---

## Risks / follow-ups

| Risk | Mitigation |
| --- | --- |
| Unpackaged desktop (Node + build manual) | Documented in packaging gap report |
| Mirror partial WARN in QA | Warn-only; DBF is write proof |
| `pnpm qa:sandbox` needs Git Bash on Windows | phase-6 §7 + phase-7 runbook |
| SmartScreen / unsigned Electron | Documented in pre-installer checklist |
| Windows DBF file locking | Operator closes legacy handles before writes |
| Pilot write UI requires `VITE_SANDBOX_WRITE_PILOT=true` | Documented in runbooks |
| Forbidden-token tests reject substring `before`/`after` | Write copy avoids those tokens in banners |

---

## Blockers

None for local pilot RC sign-off.
