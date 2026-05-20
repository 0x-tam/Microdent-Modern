# Windows MVP batch report — A–K (2026-05-20)

**Repo:** `/Users/Tamam/Desktop/Microdent/Microdent-Modern`  
**Baseline:** clean `main` at `0c42fd8` (audit-first gap-fill)  
**Branch:** `main` (uncommitted working tree)  
**Coordinator checkpoint:** 2026-05-20 (Wave 2/3 + coordinator re-run)  
**Commit policy:** Do not commit unless explicitly instructed.

## Wave summary

| Wave | Status | Outcome |
| --- | --- | --- |
| Wave 1 (A/C/D/I/J/K) | **Done (prior)** | Desktop startup dialog + required paths; sandbox section banners + mirror advisory; route inventory test; out-of-scope doc; AppShell safe health log |
| Wave 2 (B/E/F) | **Verified** | B gap-fill in tree (next-step resolver, danger banners, masked paths); E/F audit-only — write UX already on main |
| Wave 3 (G/H) | **Gap-fill + audit** | G: forbidden-token on PatientSearchBar; global `IS_REACT_ACT_ENVIRONMENT` in `vitest.setup.ts` (0 act warnings); H audit-only |
| Coordinator | **PASS** | `pnpm test`, `pnpm build:web`, `pnpm qa:sandbox` green on Node 22 |

## Workstreams vs `main` (`0c42fd8`)

| WS | Verdict | Changes |
| --- | --- | --- |
| **A** DesktopStartup | **Gap-fill (prior)** | `startup-validation`, `main.ts` dialog, setup/README/tests |
| **B** OperatorSettings | **Gap-fill** | `settings-operator-next-step.ts` + tests; `SettingsPanel.tsx` per-card next steps; `resolveBackupNotConfiguredBanner` + `resolveSettingsDangerBanners`; `settings-panel.test.tsx`, `shell-status-banners.test.ts`; `app-shell.css` |
| **C** SandboxQA | **Gap-fill (prior)** | `qa-sandbox-run.sh`, `qa-sandbox-write-smoke.sh` section banners; mirror advisory |
| **D** MirrorBackend | **Already on main** | No backend change this batch |
| **E** AppointmentUX | **Audit-only** | Sandbox pilot banners, dry-run → confirm → commit, safe summaries, schedule refresh — verified in `SchedulePanel` + `Appointment*Write*` |
| **F** PatientDemoUX | **Audit-only** | Allowlist fields, sandbox warning, dry-run/confirm, profile refresh — verified in `PatientDemographicsWritePanel` |
| **G** PrivacyStability | **Gap-fill** | `patient-search-bar.test.tsx` `assertNoForbiddenDomTokens`; `vitest.setup.ts` React act environment (eliminates stderr act warnings) |
| **H** ClinicPolish | **Audit-only** | Read-only polish on main (`today-dashboard`, `PatientSearchBar`, profile read tabs, schedule read-only) |
| **I** DocsPilot | **Gap-fill (prior)** | `docs/phase-6-windows-mvp-operator-guide.md` |
| **J** LogRedaction | **Gap-fill (prior)** | `AppShell.tsx` safe health logging |
| **K** ScopeGuardrails | **Gap-fill (prior)** | `docs/out-of-scope-guardrails.md`; `write-route-inventory.test.ts` |

## Mandatory checkpoint (2026-05-20)

| Step | Result | Notes |
| --- | --- | --- |
| `nvm use 22` | **PASS** | v22.22.3 |
| `pnpm test` | **PASS** | contracts 3; sqlite-mirror 42; bridge **308** (+4 skipped); bridge-client 36; ui 10; app **266**; desktop **31** |
| `pnpm build:web` | **PASS** | Vite production build OK |
| `pnpm qa:sandbox` | **PASS** | 5 sections; 4 workflows; **DBF readback** `source=dbf`; mirror advisory WARN (partial imports) — non-blocking |
| `git status` | **DIRTY** | Focused diff (~20 paths); nothing staged |

### Sandbox excerpt

```
[qa-write-smoke] readback workflow=appointment.statusUpdate source=dbf appointment_id=100 status=2
[qa-write-smoke] === qa-sandbox-write-smoke complete (4 workflows) ===
========== qa:sandbox complete ==========
```

## Changed files (working tree)

**Modified:**  
`apps/desktop/README.md`, `apps/desktop/src/{bridge-supervisor,main,startup-validation}.*`, `apps/desktop/src/setup/setup.html`  
`docs/phase-3-write-safe-qa-checklist.md`, `docs/phase-6-windows-mvp-operator-guide.md`  
`packages/app/src/{AppShell,SettingsPanel,app-shell.css,patient-search-bar.test,read-only-ui-copy,settings-panel.test,shell-status-banners}.*`, `packages/app/vitest.setup.ts`  
`qa-runs/2026-05-19-windows-mvp-batch-report.md`  
`scripts/qa-sandbox-run.sh`, `scripts/qa-sandbox-write-smoke.sh`

**Untracked:**  
`docs/out-of-scope-guardrails.md`  
`packages/app/src/settings-operator-next-step.{ts,test.ts}`  
`services/bridge/src/write-safety/write-route-inventory.test.ts`

**Not tracked (correct):** sandbox DATA, `.sqlite`, Legacy trees, `packages/app/dist/`, `node_modules/`

## Safe to commit?

**Yes** — single focused batch. Suggested message:

```
feat(clinic-mvp): desktop startup, settings next steps, QA sections, privacy

Gap-fill: require desktop paths + operator error dialog, Settings per-card next steps
and danger banners, sandbox QA sectioning with mirror advisory, route inventory test,
out-of-scope doc, patient search forbidden-token coverage, vitest act environment.
```

## Risks / follow-ups

| Risk | Mitigation |
| --- | --- |
| Desktop requires paths before bridge start | Setup flow unchanged |
| Settings next-step copy | Masked paths only; forbidden-token tests on Settings/shell |
| Mirror advisory WARN in QA | Warn-only; DBF is write proof |
| `origin` remote missing | Push/CI blocked (pre-existing) |
| Per-file `IS_REACT_ACT_ENVIRONMENT` duplicates | Optional cleanup; global setup now covers jsdom tests |

## Blockers

None for local sign-off. Push blocked only by missing `origin` (unchanged).
