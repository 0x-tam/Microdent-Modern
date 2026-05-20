# Windows pilot packaging gap report

**Date:** 2026-05-20  
**Baseline:** Microdent-Modern `main` @ `5221530`  
**Scope:** Honest assessment of what works in the pilot RC vs what remains manual or unimplemented.

**Actionable checklist:** [windows-pilot-pre-installer-checklist.md](./windows-pilot-pre-installer-checklist.md) — installer, signing, shortcuts, `%AppData%`, logs, backups, SmartScreen.

**Related:** [phase-3-desktop-packaging-plan.md](./phase-3-desktop-packaging-plan.md), [windows-pilot-runbook.md](./windows-pilot-runbook.md), [PILOT-START-HERE.md](./PILOT-START-HERE.md), [apps/desktop/README.md](../apps/desktop/README.md).

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
| Write safety inventory | **Works** | Four PATCH/POST routes; forbidden body keys tested |

---

## What is manual (operator / IT)

| Item | Current process | Gap |
| --- | --- | --- |
| Node 22 install | Operator or IT installs Node | No bundled runtime in desktop package |
| Repo clone + `pnpm install` | Developer-style setup | No single-click installer |
| Build chain | `bridge` + `build:web` + `desktop` build | No pre-built release artifact channel |
| Env vars for mirror/QA | PowerShell / Git Bash | No wizard for import (by design — security) |
| `writeMode` changes | Edit `%AppData%\Microdent\config.json` | No in-app write-mode toggle (intentional) |
| Sandbox pilot UI | `VITE_SANDBOX_WRITE_PILOT=true` web rebuild | Not default production build |
| `origin` remote / CI | Missing on some clones | Push and Windows CI agent not configured |

---

## Installer / signing / auto-update gaps

From [phase-3-desktop-packaging-plan.md](./phase-3-desktop-packaging-plan.md) — **still planning only**:

| Capability | Status |
| --- | --- |
| NSIS / MSI installer | **Not implemented** |
| Code signing (Authenticode) | **Not implemented** |
| Auto-update feed | **Not implemented** |
| Bundled Node 22 for bridge child | **Not implemented** — uses system `node.exe` |
| `%ProgramFiles%` install layout | **Not defined** |
| Uninstall registry entries | **Not implemented** |

---

## Windows test matrix (pilot RC)

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

1. Configure `origin` + Windows CI running `pnpm test`, `build:web`, `qa:sandbox`.
2. Electron-builder / NSIS spike (still no new write domains).
3. Shared `@microdent/operator-path` for desktop + web path masking.
4. Cross-platform `qa-sandbox-run.mjs` (replace bash-only orchestrator on Windows).

---

## Risk summary

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Operator must run terminals | Medium | Desktop reduces bridge terminal; import/QA still CLI |
| Wrong `DATA_ROOT` | High | Setup validation, sandbox guard, out-of-scope doc |
| Stale mirror after writes | Medium | Settings stale callout; DBF readback in QA |
| No signed installer | Low for pilot | Document unpackaged MVP scope |
