# Windows pilot packaging gap report

**Date:** 2026-05-21 (updated Mac-first batch)  
**Baseline:** Microdent-Modern portable pilot RC  
**Scope:** Honest assessment of what works in the pilot RC vs what remains manual or unimplemented.

---

## Pilot readiness status (three tiers)

| Tier | Question | Current state |
| --- | --- | --- |
| **1. Mac-side release readiness** | Build, stage, verify, sign off on Mac? | **READY** after `pnpm pilot:release-signoff` (or distribution checkpoint when sandbox env set) |
| **2. Windows-test readiness** | Handoff pack complete for a **scheduled** Windows field test? | **READY** — field pack docs in staged `MicrodentModern/`; see [FIELD-TEST-START-HERE.md](./FIELD-TEST-START-HERE.md) |
| **3. Windows execution status** | Real Windows clinic PC run logged? | **Deferred / Not yet run** |

**Clinic go-live:** **BLOCKED** until tier 3 shows a completed PHI-safe field log and [windows-pilot-go-no-go-checklist.md](./windows-pilot-go-no-go-checklist.md) **GO**.

**Installer / NSIS:** **Deferred until after Windows field test** — tier 1–2 green does **not** authorize NSIS or `electron-builder` work. See [windows-pilot-installer-decision-record.md](./windows-pilot-installer-decision-record.md) Mac-first completion checklist.

**Actionable checklist:** [windows-pilot-pre-installer-checklist.md](./windows-pilot-pre-installer-checklist.md) — manual IT steps until installer exists (installer itself is not in scope until tier 3).

**Field test matrix:** [windows-pilot-real-machine-checklist.md](./windows-pilot-real-machine-checklist.md) — each scenario marked **dev dry-run** vs **requires Windows PC** (synthetic paths only).

**Installer decision:** [windows-pilot-installer-decision-record.md](./windows-pilot-installer-decision-record.md) — portable zip for pilot RC; NSIS deferred until after Windows field test (Mac-first checklist M1–M7).

**Issue reporting:** [pilot-issue-template.md](./pilot-issue-template.md) — PHI-safe template with manifest `packageVersion`.

**Related:** [phase-3-desktop-packaging-plan.md](./phase-3-desktop-packaging-plan.md), [windows-pilot-runbook.md](./windows-pilot-runbook.md), [PILOT-START-HERE.md](./PILOT-START-HERE.md), [PILOT-HANDOFF-PACK.md](./PILOT-HANDOFF-PACK.md), [apps/desktop/README.md](../apps/desktop/README.md).

---

## What works now (pilot RC)

| Component | Status | Notes |
| --- | --- | --- |
| Electron desktop shell | **Works** | Spawns Node bridge only; health gate; error dialog |
| First-run setup | **Works** | Path validation, missing-field checklist, `writeMode: disabled` |
| Bridge production mode | **Works** | `node services/bridge/dist/server.js` on loopback |
| Web UI (built dist) | **Works** | `file://` load when `apps/web/dist` present |
| Settings operator dashboard | **Works** | Pilot readiness, danger banners, mirror metadata refresh |
| Mirror import CLI | **Works** | `pnpm mirror:import-safe` / sqlite-mirror `import-safe` |
| Sandbox QA | **Works** | `pnpm qa:sandbox` — 5 sections, DBF readback, 4 workflows |
| Desktop release smoke | **Works** | `pnpm --filter @microdent/desktop run release-smoke` |
| Pilot release staging | **Works** | `pnpm stage:pilot-release` + `pnpm pilot:verify-release` → `dist/pilot-release/` |
| Write safety inventory | **Works** | Four PATCH/POST routes; forbidden body keys tested |

---

## What is manual (operator / IT)

| Item | Current process | Gap |
| --- | --- | --- |
| Node 22 install | Operator or IT installs Node | No bundled runtime in desktop package |
| Repo clone + `pnpm install` | Developer-style setup | No single-click installer |
| Build chain | `bridge` + `build:web` + `desktop` build | Staged tree via `stage:pilot-release` — no signed installer channel yet |
| Env vars for mirror/QA | PowerShell / Git Bash | No wizard for import (by design — security) |
| `writeMode` changes | Edit `%AppData%\Microdent\config.json` | No in-app write-mode toggle (intentional) |
| Sandbox pilot UI | `VITE_SANDBOX_WRITE_PILOT=true` web rebuild | Not default production build |
| `origin` remote / CI | Missing on some clones | Push and Windows CI agent not configured |

---

## Installer / signing / auto-update gaps

**Decision record:** [windows-pilot-installer-decision-record.md](./windows-pilot-installer-decision-record.md) — **recommendation: portable zip now**; NSIS via electron-builder spike **deferred until after Windows field test** (tier 3 complete + Mac-first checklist M1–M7).

From [phase-3-desktop-packaging-plan.md](./phase-3-desktop-packaging-plan.md) — **still planning only**:

| Capability | Status |
| --- | --- |
| NSIS / MSI installer | **Not implemented** — see decision record D1–D4 |
| Code signing (Authenticode) | **Not implemented** |
| Auto-update feed | **Not implemented** |
| Bundled Node 22 for bridge child | **Partial** — release staging validates a pre-downloaded Node 22.5+ runtime and can include `node/`; signed installer-integrated acquisition remains open |
| `%ProgramFiles%` install layout | **Not defined** |
| Uninstall registry entries | **Not implemented** |

---

## Windows test matrix (pilot RC)

Per-scenario **dev dry-run** vs **requires Windows PC** markers: [windows-pilot-real-machine-checklist.md](./windows-pilot-real-machine-checklist.md).

| Scenario | macOS dev | Windows operator | Automated |
| --- | --- | --- | --- |
| `pnpm test` | ✅ Primary | ⚠️ Possible with Node 22 | Yes |
| `pnpm build:web` | ✅ | ✅ | Yes |
| `pnpm qa:sandbox` | ✅ Git Bash | ⚠️ Git Bash or manual §7 phase-6 | Partial |
| Desktop `release-smoke` | ✅ | ✅ | Yes |
| First-run setup UI | ✅ | ✅ Manual QA | Vitest payload tests |
| Mirror import | ✅ | ✅ PowerShell env | CLI tests |
| Four write workflows | ✅ sandbox | ⚠️ Requires sandbox copy | `qa:sandbox` smoke |

---

## Recommended next batch

| Priority | Action | Tier |
| --- | --- | --- |
| **1** | Execute [windows-pilot-field-execution-script.md](./windows-pilot-field-execution-script.md) on a clinic PC; file [TEMPLATE-windows-field-run.md](../qa-runs/TEMPLATE-windows-field-run.md); complete go/no-go | Tier 3 — **blocks clinic go-live** |
| **2** | Mac-first completion checklist M1–M7 in installer decision record | After tier 3 GO |
| **3** | NSIS spike (document-only acceptance criteria — **no** `electron-builder` dep until spike approved) | After M1–M7 |
| **4** | Configure `origin` + Windows CI running `pnpm test`, `build:web`, `qa:sandbox` | Mac / CI |
| **5** | Shared `@microdent/operator-path` for desktop + web path masking | Mac dev |
| **6** | Cross-platform `qa-sandbox-run.mjs` (replace bash-only orchestrator on Windows) | Mac dev |

**Not now:** NSIS installer, Authenticode signing, bundled Node — all deferred until Windows field test completes.

---

## Risk summary

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Operator must run terminals | Medium | Desktop reduces bridge terminal; import/QA still CLI |
| Wrong `DATA_ROOT` | High | Setup validation, sandbox guard, out-of-scope doc |
| Stale mirror after writes | Medium | Settings stale callout; DBF readback in QA |
| No signed installer | Low for pilot | Document unpackaged MVP scope |
| Windows file locking | Medium | Close FoxPro/legacy apps before bridge writes; avoid open DBF in Excel |
| SmartScreen on first launch | Low | Expected for unsigned Electron — IT “More info → Run anyway” |

---

## Windows-specific notes (pilot RC)

| Topic | Guidance |
| --- | --- |
| **SmartScreen** | Unsigned `electron.exe` + `node.exe` may prompt — not a virus signal for unpackaged MVP |
| **File locking** | `SCHEDULE.DBF` / `PATIENT.DBF` must not be open in FoxPro or other tools during writes |
| **Logs** | Desktop config in `%AppData%\Microdent\`; bridge logs in the terminal that launched desktop (PHI-safe status only) |
| **Antivirus** | May scan `node dist/server.js` on first run — allowlist if startup times out |
