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
| **Next phase** | **NSIS via electron-builder spike** | Document script paths, signing cert, and `%AppData%` vs install dir in a short spike **before** adding `electron-builder` to `package.json` |
| **Later** | **MSI** only if clinic IT requires GPO/SCCM | Higher cost; portable + NSIS may suffice for single-workstation pilots |
| **Explicitly out of this batch** | New installer packages, Authenticode cert purchase, auto-update feed | See [out-of-scope-guardrails.md](./out-of-scope-guardrails.md) |

---

## Decision log

| ID | Decision | Date |
| --- | --- | --- |
| D1 | Ship pilot as portable `MicrodentModern/` only | 2026-05-21 |
| D2 | Require Node 22 on PATH until bundled runtime decision | 2026-05-21 |
| D3 | Defer NSIS until real-Windows checklist executed | 2026-05-21 |
| D4 | No `electron-builder` / NSIS / MSI dependency in clinic pilot batch | 2026-05-21 |

---

## Next steps (after portable field sign-off)

1. Execute [windows-pilot-real-machine-checklist.md](./windows-pilot-real-machine-checklist.md) on a Windows 10/11 clinic machine; file log via [pilot-issue-template.md](./pilot-issue-template.md).
2. Spike NSIS layout: install dir, shortcuts, uninstall, **no** DATA_ROOT in package.
3. Plan Authenticode signing for Electron + `node.exe` (if bundled).
4. Evaluate bundled Node 22 vs system Node (see [windows-pilot-packaging-gap-report.md](./windows-pilot-packaging-gap-report.md)).

---

## Related docs

| Doc | Use when |
| --- | --- |
| [PILOT-HANDOFF-PACK.md](./PILOT-HANDOFF-PACK.md) | Operator unzip and launch |
| [windows-pilot-packaging-gap-report.md](./windows-pilot-packaging-gap-report.md) | Gap list and risk summary |
| [windows-pilot-pre-installer-checklist.md](./windows-pilot-pre-installer-checklist.md) | IT manual steps until installer exists |
