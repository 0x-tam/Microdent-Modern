# Mac-first pilot completion — batch report

**Date:** 2026-05-26  
**Workstream:** H (Agent_Coordinator — Wave 3 Mac checkpoint)  
**Plan:** `mac-first_pilot_completion_13e26789`  
**Baseline commit (manifest):** `3f11e670f84b34b44b1f72fb3e6b461a48688466`  
**Branch:** `main`  
**Commit performed:** No (explicit batch instruction)

## Summary

Waves 1–2 completed status-model docs, release hardening (3-tier signoff banner, `pilot:mac-release-status`), Mac QA runbook, operator UX/settings polish, sandbox doc alignment, and installer/guardrail doc updates. Wave 3 Mac checkpoint ran the full mandatory command matrix: all tests and builds passed, pilot staging succeeded, artifact and release/manifest verification passed. Staged tree: 244 files in 25 directories under `dist/pilot-release/MicrodentModern/`. Working tree still carries the **uncommitted Windows field-test pack** from the prior batch **plus** this batch’s Mac-first completion changes (39 paths); manifest hashes remain tied to `3f11e67` until commit and re-stage.

---

## Status tiers (mandatory)

Do **not** conflate Mac READY with clinic go-live.

| Tier | Question | Status |
| --- | --- | --- |
| **1. Mac-side release readiness** | Build, stage, verify, signoff on build machine? | **READY** (mandatory checkpoint green; optional `pnpm pilot:release-signoff` not re-run this batch) |
| **2. Windows-test readiness** | Field pack docs staged and handoff complete for a future Windows run? | **READY** (field docs in staged copy list + tree) |
| **3. Windows execution status** | Real Windows clinic PC field run logged? | **Deferred / Not yet run** |
| **Clinic go-live** | Production clinic sign-off? | **BLOCKED** (until tier 3 **Completed** + go/no-go GO) |

**Reporting rule:** Tier 3 **Deferred / Not yet run** ⇒ clinic go-live remains **BLOCKED** even though tiers 1–2 are **READY**.

`pnpm pilot:mac-release-status` (read-only tier summary): tier 2 **READY**, tier 3 **Deferred / Not yet run**, clinic go-live **BLOCKED**.

---

## Mac checkpoint results

| Step | Command | Result |
| --- | --- | --- |
| Node | `nvm use 22` | OK (v22.22.3) |
| Tests | `pnpm test` | **PASS** — contracts 3; sqlite-mirror 42; bridge 399 (+4 skipped); bridge-client 36; ui 10; app 275; desktop 67 |
| Web build | `pnpm build:web` | **PASS** (Vite production build) |
| Bridge build | `pnpm --filter @microdent/bridge run build` | **PASS** |
| Desktop build | `pnpm --filter @microdent/desktop run build` | **PASS** |
| Stage | `pnpm stage:pilot-release` | **PASS** — 244 files, 25 dirs |
| Artifact tests | `pnpm test:pilot-artifacts` | **PASS** — 13/13 |
| Release verify | `pnpm pilot:verify-release` | **PASS** — layout, supervisor invariants, manifest hashes, sensitive-artifact guards |
| Manifest verify | `pnpm pilot:verify-manifest` | **PASS** — 243 files (app 0.0.1, package `pilot-2026-05-21`, channel `pilot`, commit `3f11e67…`) |
| Tier summary | `pnpm pilot:mac-release-status` | **PASS** — 3-tier banner printed |
| Hygiene | `git status` | **39** modified/untracked paths (see below); nothing staged |

No staging failures; no in-scope fixes required.

**Not run (optional this batch):** `pnpm pilot:release-signoff` — full Mac tier-1 refresh with sandbox; prior signoff still valid at baseline commit per 2026-05-24 clinic pilot batch.

---

## Files changed (Waves 1–2 + carried field pack)

### Modified (26)

| Path | Wave / purpose |
| --- | --- |
| `docs/PILOT-START-HERE.md` | Three-tier pilot readiness status (A) |
| `docs/PILOT-HANDOFF-PACK.md` | Tier definitions + Windows execution deferred (A) |
| `docs/windows-pilot-go-no-go-checklist.md` | Prerequisite = Windows execution completed (A; header in tracked tree) |
| `docs/out-of-scope-guardrails.md` | Guardrails alignment (G) |
| `docs/phase-3-sandbox-qa-runner.md` | Mac QA command clarity (C) |
| `docs/pilot-acceptance-checklist.md` | Pilot doc alignment |
| `docs/pilot-backup-restore-audit.md` | Pilot doc alignment |
| `docs/pilot-issue-template.md` | Issue intake |
| `docs/windows-pilot-*` (data-locations, installer DR, packaging gap, pre-installer, real-machine) | Cross-links + deferred execution framing |
| `scripts/README.md` | Mac QA / pilot command matrix (C) |
| `scripts/pilot-release-artifact-rules.mjs` | Staged layout + field pack completeness (B) |
| `scripts/stage-pilot-release.mjs` | Field pack copy list (B) |
| `scripts/pilot-release-signoff.sh` | 3-tier status banner on signoff (B) |
| `package.json` | `pilot:mac-release-status` script (B) |
| `apps/desktop/src/setup/*` | Setup window UX polish (D) |
| `packages/app/src/settings-*`, `read-only-ui-copy.ts`, write/tests | Settings + operator UX (E) |

### New / untracked (13)

| Path | Wave / purpose |
| --- | --- |
| `docs/FIELD-TEST-START-HERE.md` | Field pack index (prior field pack batch) |
| `docs/mac-pilot-qa-runbook.md` | Mac QA runbook (C) |
| `docs/windows-pilot-field-execution-script.md` | Field execution script |
| `docs/windows-pilot-field-result-form.md` | PHI-safe result form |
| `docs/windows-pilot-troubleshooting-pack.md` | Troubleshooting |
| `docs/windows-pilot-package-verify-on-windows.md` | IT verify on Windows |
| `docs/windows-pilot-permission-and-path-risks.md` | Path/permission risks |
| `docs/windows-pilot-go-no-go-checklist.md` | Go/no-go (if not yet merged into index from modified set) |
| `docs/windows-pilot-release-notes.md` | Release notes |
| `qa-runs/TEMPLATE-batch-report.md` | Mandatory 3-tier template (A) |
| `qa-runs/TEMPLATE-windows-field-run.md` | Field run filing template |
| `qa-runs/2026-05-25-windows-field-test-pack-batch-report.md` | Prior batch report |
| `scripts/pilot-mac-release-status.mjs` | Read-only tier printer (B) |

---

## Windows field execution

| Item | Status |
| --- | --- |
| Real Windows clinic PC run | **Not done** — tier 3 **Deferred / Not yet run** |
| Go/no-go checklist filed | **Not filed** |
| Entry when scheduling test | `docs/FIELD-TEST-START-HERE.md` |

---

## Safe to commit?

**Deferred until user instructs.** Diff is docs, pilot scripts, desktop setup UX, and app settings/copy — checkpoint green; no secrets in reported paths. **This run:** commit **not** created.

**Hygiene note:** Uncommitted field pack from 2026-05-25 remains in the working tree together with Mac-first completion batch edits; recommend one consolidated commit when approved so manifest commit id matches staged content.

---

## Git status hygiene

| Check | Status |
| --- | --- |
| Working tree | 26 modified, 13 untracked (39 total) |
| Staged for commit | **None** |
| `.sqlite` / `DATA/` in diff | Not reported in status output |

---

## Next steps

1. User-approved commit of field pack + Waves 1–2 changes, then re-run stage + manifest verify so package commit metadata matches HEAD.
2. Optional: `pnpm pilot:release-signoff` for refreshed tier-1 proof on current tree.
3. Schedule Windows clinic PC test per field pack; file run under `qa-runs/` and complete go/no-go — only then revisit clinic go-live tier.
