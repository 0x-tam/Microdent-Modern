# Windows pilot — installer decision record

**Date:** 2026-05-21  
**Status:** Decision for pilot handoff — **no installer dependency added in this batch**

**Baseline:** Microdent-Modern Windows clinic pilot batch (portable `MicrodentModern/` zip)

**Related:** [windows-pilot-packaging-gap-report.md](./windows-pilot-packaging-gap-report.md), [phase-3-desktop-packaging-plan.md](./phase-3-desktop-packaging-plan.md), [windows-pilot-pre-installer-checklist.md](./windows-pilot-pre-installer-checklist.md)

---

## Context

The pilot RC ships as a **verified portable tree** (`pnpm stage:pilot-release` → `dist/pilot-release/MicrodentModern/`). Operators unzip to a local drive, install **Node 22** separately, and launch from `app/`. Clinic data (`DATA_ROOT`, mirror SQLite, backups) stays **outside** the install folder per [windows-pilot-data-locations.md](./windows-pilot-data-locations.md).

This record compares installer options for the **next** packaging phase after portable field validation.

---

## Options compared

| Criterion | Portable zip (current) | NSIS (custom) | MSI (WiX) | electron-builder |
| --- | --- | --- | --- | --- |
| **What ships today** | **Yes** — staged tree + manifest | No | No | No (Electron shell exists; no builder pipeline) |
| **IT deployment** | Manual extract + shortcut | Familiar `.exe` setup | GPO / SCCM friendly | NSIS/MSI via builder |
| **Install location** | IT chooses (e.g. `C:\Microdent\`) | `%ProgramFiles%` or per-user | `%ProgramFiles%` standard | Same as NSIS target |
| **Config / clinic data** | `%AppData%\Microdent\` + external paths | Same — installer must not bundle PHI | Same | Same |
| **Bundled Node 22** | **No** — system `node.exe` | Can bundle sidecar | Can bundle sidecar | Can bundle in `extraResources` |
| **Code signing** | N/A (unsigned folder) | Authenticode on `.exe` | Authenticode on MSI | Signs app + optional uninstaller |
| **SmartScreen** | “Unrecognized app” on first run | Better with signing; still may prompt once | Best IT narrative with signed MSI | Same as NSIS if signed |
| **Auto-update** | None — IT redeploys zip | Custom feed or manual | MSI patch / GPO | Built-in (Squirrel/custom) — **out of pilot scope** |
| **Uninstall** | Delete folder | NSIS uninstaller | Add/Remove Programs | Builder uninstall entry |
| **Complexity / deps** | Lowest — manifest + verify only | Medium — script + signing cert | High — WiX, upgrades, ICE | Medium-high — ties to Electron versions |
| **Pilot fit** | **Best now** — proves runtime on real PCs | **Next phase** after field matrix | Defer until IT demands MSI | Use when consolidating Electron + NSIS |

---

## `%AppData%` vs Program Files

| Layer | Recommended home | Rationale |
| --- | --- | --- |
| **Application binaries** | `C:\Microdent\MicrodentModern\` (pilot) or `%ProgramFiles%\Microdent\` (future installer) | IT-controlled, versioned folder; upgrades replace binaries only |
| **Operator config** | `%AppData%\Microdent\config.json` | Per-user paths, `writeMode`, port — already implemented |
| **Logs (optional)** | `%AppData%\Microdent\logs\` | No clinic DBF; avoids writing under Program Files |
| **DATA_ROOT / mirror / backups** | **Outside** install — e.g. `C:\ClinicData\...`, `C:\Users\Public\MicrodentModern\` | Survives reinstall; never in staged zip |

An installer must **not** copy sandbox DATA, sqlite, or backups into Program Files.

---

## electron-builder note

The repo already uses **Electron** for `@microdent/desktop` with a **portable** handoff layout (`app/`, `bridge/`, `web/`). **electron-builder** is the natural bundler when we add an installer, because it can:

- Package the existing Electron main + `file://` web dist
- Run **NSIS** or MSI targets on Windows
- Attach **extraResources** for bridge dist and (optionally) portable Node

**Not chosen for pilot RC** because it adds dependency, signing, and update-policy work before [windows-pilot-real-machine-checklist.md](./windows-pilot-real-machine-checklist.md) rows are executed on a clinic PC.

---

## Recommendation

| Phase | Choice | Justification |
| --- | --- | --- |
| **Now (pilot handoff)** | **Portable zip** | Staging + `RELEASE-MANIFEST.json` + `pilot:verify-release` already give IT tamper checks; no new deps; field test blocker is Windows PC execution, not installer UX |
| **After Windows field test (tier 3 GO)** | **NSIS via electron-builder spike** | Mac-first checklist M1–M7 green; document script paths, signing cert, and `%AppData%` vs install dir **before** adding `electron-builder` to `package.json` |
| **Later** | **MSI** only if clinic IT requires GPO/SCCM | Higher cost; portable + NSIS may suffice for single-workstation pilots |
| **Explicitly out of this batch** | New installer packages, Authenticode cert purchase, auto-update feed | See [out-of-scope-guardrails.md](./out-of-scope-guardrails.md) |

**Installer timing:** NSIS / electron-builder spike is **deferred until after** a completed Windows field test (tier 3). Mac-side portable signoff (tier 1) and field-pack readiness (tier 2) do **not** authorize installer work. **Clinic go-live remains BLOCKED** until tier 3 shows a PHI-safe field log + go/no-go GO.

---

## Mac-first completion checklist (before NSIS spike)

Complete **all** rows on the Mac build machine before adding `electron-builder`, NSIS scripts, or Authenticode dependencies. This checklist is **planning only** — no installer deps in the Mac-first batch.

| # | Gate | Pass |
| --- | --- | --- |
| M1 | **Tier 1 — Mac release readiness:** `pnpm pilot:release-signoff` prints **`PILOT RELEASE SIGNOFF: READY`** (sandbox QA green on disposable env) | ☐ |
| M2 | **Tier 2 — Windows-test readiness:** field pack docs present in staged `MicrodentModern/docs/` (`FIELD-TEST-START-HERE.md`, execution script, result form, go/no-go, verify-on-Windows) | ☐ |
| M3 | Field pack **committed** to git (not only local uncommitted docs) | ☐ |
| M4 | **Tier 3 — Windows execution:** one real clinic PC run logged — PHI-safe `qa-runs/` field log from [TEMPLATE-windows-field-run.md](../qa-runs/TEMPLATE-windows-field-run.md) | ☐ |
| M5 | [windows-pilot-go-no-go-checklist.md](./windows-pilot-go-no-go-checklist.md) completed with **GO** (or documented NO-GO with remediation plan) | ☐ |
| M6 | [windows-pilot-real-machine-checklist.md](./windows-pilot-real-machine-checklist.md) — all **Requires Windows PC** rows executed on clinic hardware | ☐ |
| M7 | No open **Fail** rows on field result form for launch, mirror, read-only QA | ☐ |

**Do not start NSIS spike** until M1–M7 pass. Until M4–M7 complete, tier 3 stays **Deferred / Not yet run** and clinic go-live stays **BLOCKED**.

**Related:** [PILOT-START-HERE.md](./PILOT-START-HERE.md) (three-tier status), [out-of-scope-guardrails.md](./out-of-scope-guardrails.md) (Mac-first sign-off rows).

---

## NSIS spike acceptance criteria (document only)

When M1–M7 above are green, a **spike** (not production installer) must prove the following before `electron-builder` lands in `package.json`:

| # | Criterion | Spike proves |
| --- | --- | --- |
| N1 | **Install dir vs config** | Binaries under `%ProgramFiles%\Microdent\` (or IT-chosen root); `%AppData%\Microdent\config.json` unchanged; **no** clinic DBF/sqlite/backups in install tree |
| N2 | **Shortcuts** | Start menu + optional desktop shortcut launch Electron main; bridge still spawned as Node child |
| N3 | **Uninstall** | NSIS uninstaller removes install dir only — leaves `%AppData%`, `DATA_ROOT`, mirror, backups |
| N4 | **Bundled Node decision** | Document sidecar `node.exe` vs system PATH — match [windows-pilot-packaging-gap-report.md](./windows-pilot-packaging-gap-report.md) gap list |
| N5 | **Signing plan** | Authenticode cert scope documented (Electron exe, optional bundled Node, NSIS setup exe) — purchase/out-of-band |
| N6 | **SmartScreen narrative** | IT one-pager: signed vs unsigned first-run behavior |
| N7 | **No auto-update** | Explicitly out of pilot — manual IT redeploy |
| N8 | **Staged layout parity** | Spike output passes same forbidden-artifact rules as portable tree (`pnpm test:pilot-artifacts` patterns) |

Spike output is **not** clinic handoff until it passes verify-release + manifest gates on a Windows build agent.

---

## Decision log

| ID | Decision | Date |
| --- | --- | --- |
| D1 | Ship pilot as portable `MicrodentModern/` only | 2026-05-21 |
| D2 | Require Node 22 on PATH until bundled runtime decision | 2026-05-21 |
| D3 | Defer NSIS until real-Windows checklist executed | 2026-05-21 |
| D4 | No `electron-builder` / NSIS / MSI dependency in clinic pilot batch | 2026-05-21 |

---

## Next steps (ordered)

| Phase | Action | Blocked until |
| --- | --- | --- |
| **Now (Mac-first)** | Portable zip handoff; Mac signoff + staged field pack | — |
| **Windows field test** | Execute [windows-pilot-field-execution-script.md](./windows-pilot-field-execution-script.md) on clinic PC; file [TEMPLATE-windows-field-run.md](../qa-runs/TEMPLATE-windows-field-run.md); complete go/no-go | Tier 3 **Deferred** until logged |
| **After tier 3 GO** | Mac-first completion checklist M1–M7 green | Windows field log + go/no-go |
| **NSIS spike** | Document-only acceptance criteria above; no new deps until spike plan approved | M1–M7 + N1–N8 |
| **Later** | Authenticode signing, bundled Node decision, MSI only if IT requires GPO | Post-spike |

---

## Related docs

| Doc | Use when |
| --- | --- |
| [PILOT-HANDOFF-PACK.md](./PILOT-HANDOFF-PACK.md) | Operator unzip and launch |
| [windows-pilot-packaging-gap-report.md](./windows-pilot-packaging-gap-report.md) | Gap list and risk summary |
| [windows-pilot-pre-installer-checklist.md](./windows-pilot-pre-installer-checklist.md) | IT manual steps until installer exists |
