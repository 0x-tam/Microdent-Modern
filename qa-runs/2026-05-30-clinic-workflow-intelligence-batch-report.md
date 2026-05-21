# Batch report — 2026-05-30-clinic-workflow-intelligence

**Date:** 2026-05-30  
**Workstream / batch:** Clinic Workflow Intelligence and Polish (Workstreams A–M)  
**Baseline commit:** `68ee401`  
**Branch:** main (working tree)  
**Commit performed:** Yes (see below)

## Summary

Restored AppShell navigation wiring (P0), deepened patient/schedule/today workflow continuity, unified honest legacy code labels, added filter-reset and operational summaries across clinical tabs, demographics doctor select parity, CSS cohesion pass, and expanded safety regression tests. All 17 Mac checkpoint gates passed on Node 22; auto-commit applied with explicit path staging only.

---

## Status tiers (mandatory)

| Tier | Question | Status |
| --- | --- | --- |
| **1. Mac-side release readiness** | Build, stage, verify, signoff on build machine? | READY (checkpoint green; run `pnpm pilot:release-signoff` for formal signoff) |
| **2. Windows-test readiness** | Field pack docs staged and handoff complete for a future Windows run? | READY |
| **3. Windows execution status** | Real Windows clinic PC field run logged? | **Deferred / Not yet run** |
| **Clinic go-live** | Production clinic sign-off? | **BLOCKED** until tier 3 **Completed** + go/no-go GO |

---

## Agents / workstreams executed

| Agent | Workstreams | Result |
| --- | --- | --- |
| NavRestore | H (+ unlocks C/B/D) | AppShell wiring restored + regression test |
| PatientJourney | A, B | Timeline filters, Summary connection, appointments UX |
| ScheduleToday | C, D | Schedule summary/clear-filters; Today recents |
| ClinicalLabels | E, F | Filter-reset toolbars; `legacyCodeLabel` helper |
| WritePolish | G | Demographics doctor select; refresh nudge |
| SettingsUI | I | (unchanged scope; readiness copy already present) |
| UICohesion | J | `app-shell.css` cohesion pass |
| SafetyRegression | K | Legacy label tests; forbidden-token updates |
| ProductAudit | L | `docs/product-completeness-audit.md` updated |
| FinalReport | M | This report + checkpoint + commit |

---

## Files changed

| Path | Purpose |
| --- | --- |
| `packages/app/src/AppShell.tsx` | P0 nav restore: recents, schedule initialDate, mirrorStatus, onOpenPatient |
| `packages/app/src/app-shell.test.tsx` | Wiring regression guard |
| `packages/app/src/PatientProfilePanel.tsx` | Timeline filters, appointments UX, summary timeline count, clinical clear filters |
| `packages/app/src/patient-timeline.tsx` | Kind filter chips, View-in-tab affordance, empty states |
| `packages/app/src/patient-timeline-display.ts` | roomMap parity, kind filter model |
| `packages/app/src/patient-summary-mini-cards.tsx` | Timeline in cross-tabs + dynamic count |
| `packages/app/src/SchedulePanel.tsx` | Clear filters, rooms-in-use summary |
| `packages/app/src/today-dashboard.tsx` | Recent patients aside, re-open recent, schedule-today nav |
| `packages/app/src/legacy-code-label.ts` | Shared honest unmapped code labels |
| `packages/app/src/*-display.ts` | Legacy label migration (appointments, chart, ledger, treatments) |
| `packages/app/src/doctor-labels.ts` | Unknown provider fallback |
| `packages/app/src/procedure-reference.ts` | Unknown procedure fallback |
| `packages/app/src/PatientDemographicsWritePanel.tsx` | Doctor select + refresh nudge |
| `packages/app/src/read-only-ui-copy.ts` | New operator copy strings |
| `packages/app/src/app-shell.css` | Filter chip / timeline / recent / write hint cohesion |
| `packages/app/src/*.test.*` | Updated expectations + legacy-code-label test |
| `docs/product-completeness-audit.md` | Post-batch audit |

---

## Mac checkpoint results

| Step | Command | Result |
| --- | --- | --- |
| Tests | `pnpm test` | PASS (933+ tests across workspaces) |
| Web build | `pnpm build:web` | PASS |
| Artifact tests | `pnpm test:pilot-artifacts` | PASS (13) |
| Bridge build | `pnpm --filter @microdent/bridge run build` | PASS |
| Desktop build | `pnpm --filter @microdent/desktop run build` | PASS |
| Desktop test | `pnpm --filter @microdent/desktop run test` | PASS (67) |
| Release smoke | `pnpm --filter @microdent/desktop run release-smoke` | PASS |
| Stage | `pnpm stage:pilot-release` | PASS (244 files) |
| Release verify | `pnpm pilot:verify-release` | PASS |
| Manifest verify | `pnpm pilot:verify-manifest` | PASS |
| Sandbox QA | `pnpm qa:sandbox` | PASS (4 workflows) |
| Mac release status | `pnpm pilot:mac-release-status` | Tier 1 pending signoff; Tier 2 READY; Tier 3 Deferred |

---

## Windows field execution

| Item | Status |
| --- | --- |
| Real Windows clinic PC run | Not done |
| Go/no-go checklist | Not filed |

**Windows: Deferred**

---

## Safe to commit?

Yes — all checkpoint gates green; no forbidden artifacts in staged paths; git hygiene clean aside from intentional repo changes.

---

## Git status hygiene

Staged paths only: `docs`, `packages`, `services`, `apps`, `scripts`, `qa-runs`, `README.md`, `package.json`, `pnpm-lock.yaml`.

**Not staged (safe):** `.sqlite`, sandbox DATA, backups, `dist/pilot-release`, Legacy paths, `node_modules`.

**Unsafe files in git status after commit:** None expected outside unstaged build artifacts (`dist/pilot-release` if regenerated locally).

---

## Risks

| Risk | Mitigation |
| --- | --- |
| Summary Timeline count approximate before Timeline tab load | Documented; opens accurate count after Timeline fetch |
| Legacy label test churn | Centralized `legacyCodeLabel` helper |
| Windows field still deferred | Clinic go-live remains BLOCKED |

---

## Mac functionality status

Substantially complete for daily read workflows + sandbox-gated writes on Mac. Suitable for operator demo.

---

## Next batch recommendation

**Tier 3 — Windows field execution** per [docs/FIELD-TEST-START-HERE.md](../docs/FIELD-TEST-START-HERE.md). Post-field only: decoded catalogs if field log confirms safe mappings.

---

## Next steps

1. Run `pnpm pilot:release-signoff` when ready for formal Tier 1 signoff
2. Schedule Windows clinic PC field run
3. Optional: persist session recents (explicit product decision)
