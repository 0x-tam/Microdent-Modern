# Windows Pilot RC batch report — A–I (2026-05-20)

**Repo:** `/Users/Tamam/Desktop/Microdent/Microdent-Modern`  
**Baseline:** clean `main` at `5c88cbd` (audit-first gap-fill)  
**Branch:** `main` (uncommitted working tree)  
**Coordinator checkpoint:** 2026-05-20  
**Commit policy:** Do not commit unless explicitly instructed.

---

## Wave summary

| Wave | Status | Outcome |
| --- | --- | --- |
| Wave 1 (A/B, E, G/I, H) | **Done** | Desktop release-smoke + setup checklist; phase-7 QA runbook; pilot docs + gap report; route inventory DELETE/PUT guard |
| Wave 2 (C, D, F) | **Done** | Settings pilot readiness strip; mirror CLI copy; clinic read UX audit-only |
| Coordinator | **PASS** | `pnpm test`, `pnpm build:web`, `pnpm qa:sandbox`, `pnpm desktop:release-smoke` |

---

## Workstreams

| WS | Verdict | Changes |
| --- | --- | --- |
| **A/B** DesktopRC | **Gap-fill** | `release-smoke` script + root alias; setup missing-field checklist; README; bridge-supervisor audit unchanged (already Node-only, `WRITE_MODE` default disabled) |
| **C** SettingsRC | **Gap-fill** | `resolvePilotReadinessSummary`; Settings readiness strip; desktop-setup next step; `import.meta.env.DEV` path hints; CSS |
| **D** MirrorPilotFlow | **Gap-fill** | Mirror CLI command copy in Settings; phase-4 pilot section; mirror-status backend audit-only (already safe) |
| **E** SandboxPilotQA | **Gap-fill** | `docs/phase-7-sandbox-pilot-qa-runbook.md`; `scripts/qa-sandbox-pilot-checklist.sh`; `scripts/README.md` sync |
| **F** ClinicWorkflowPolish | **Audit-only** | Today/Patients/Schedule/Profile read copy already on main via `read-only-ui-copy.ts`; write panels unchanged |
| **G/I** PilotDocsAndGap | **Gap-fill** | `docs/windows-pilot-runbook.md`; `docs/windows-pilot-packaging-gap-report.md`; cross-links phase-5/6/4 |
| **H** SafetyGuardrails | **Gap-fill** | `write-route-inventory.test.ts` no DELETE/PUT; `out-of-scope-guardrails.md` pilot RC checklist; forbidden tokens on Settings (existing + new snapshots) |

---

## Mandatory checkpoint

| Step | Result | Notes |
| --- | --- | --- |
| `nvm use 22` | **PASS** | v22.22.3 |
| `pnpm test` | **PASS** | contracts 3; sqlite-mirror 42; bridge 308 (+4 skipped); bridge-client 36; ui 10; app **269**; desktop 31 |
| `pnpm build:web` | **PASS** | Vite production build OK |
| `pnpm qa:sandbox` | **PASS** | 5 sections; 4 workflows; DBF readback `source=dbf`; mirror partial WARN (non-blocking) |
| `pnpm desktop:release-smoke` | **PASS** | build + vitest + dist/config/supervisor checks |
| `git status` | **DIRTY** | 17 modified, 5 untracked; no Legacy/sandbox DATA/sqlite tracked |

### Sandbox excerpt

```
[qa-write-smoke] readback workflow=appointment.statusUpdate source=dbf appointment_id=100 status=2
[qa-write-smoke] === qa-sandbox-write-smoke complete (4 workflows) ===
========== qa:sandbox complete ==========
```

---

## Changed files

**Modified:**  
`apps/desktop/{README.md,package.json,src/setup/setup.html}`  
`docs/{out-of-scope-guardrails.md,phase-4-mirror-import-operator.md,phase-6-windows-mvp-operator-guide.md}`  
`package.json`  
`packages/app/src/{SettingsPanel.tsx,app-shell.css,read-only-ui-copy.ts,settings-operator-next-step.ts,settings-operator-next-step.test.ts,settings-panel.test.tsx,settings-status.ts,settings-status.test.ts}`  
`scripts/README.md`  
`services/bridge/src/write-safety/write-route-inventory.test.ts`

**Untracked:**  
`apps/desktop/scripts/release-smoke.mjs`  
`docs/{phase-7-sandbox-pilot-qa-runbook.md,windows-pilot-runbook.md,windows-pilot-packaging-gap-report.md}`  
`scripts/qa-sandbox-pilot-checklist.sh`

**Not tracked (correct):** sandbox DATA, `.sqlite`, Legacy trees, `dist/`, `node_modules/`

---

## Safe to commit?

**Yes** — focused pilot RC batch. Suggested message:

```
feat(pilot-rc): desktop release smoke, settings readiness, pilot docs

Gap-fill: desktop release-smoke + setup checklist, Settings pilot readiness
strip and mirror CLI hints, phase-7 sandbox QA runbook, windows pilot runbook
and packaging gap report, route inventory DELETE/PUT guard, out-of-scope RC checklist.
```

---

## Risks / follow-ups

| Risk | Mitigation |
| --- | --- |
| Unpackaged desktop (Node + build manual) | Documented in packaging gap report |
| Mirror partial WARN in QA | Warn-only; DBF is write proof |
| `pnpm qa:sandbox` needs Git Bash on Windows | phase-6 §7 + phase-7 runbook |
| `origin` remote missing | Push/CI blocked (pre-existing) |
| Pilot write UI requires `VITE_SANDBOX_WRITE_PILOT=true` | Documented in runbooks |

---

## Blockers

None for local pilot RC sign-off. Push blocked only by missing `origin` (unchanged).
