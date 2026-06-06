# Windows pilot — pre-installer checklist

**Purpose:** Actionable IT/operator checklist derived from the packaging gap report. Use before investing in NSIS/signing work.

**Baseline:** Microdent-Modern `main` @ `678585f`.

**Related:** [windows-pilot-packaging-gap-report.md](./windows-pilot-packaging-gap-report.md), [PILOT-START-HERE.md](./PILOT-START-HERE.md), [phase-3-desktop-packaging-plan.md](./phase-3-desktop-packaging-plan.md).

**Status key:** **Done now** · **Manual** · **Blocked** · **Owner**

---

## Runtime and build (pilot RC)

| Item | Status | Owner | Notes |
| --- | --- | --- | --- |
| Node 22 on operator machine | **Manual** | IT / operator | No bundled runtime in desktop package |
| `pnpm install` + build chain | **Manual** | Developer / IT | bridge + `build:web` + desktop build |
| Electron desktop shell | **Done now** | — | Spawns Node bridge only |
| First-run path setup | **Done now** | — | `%AppData%\Microdent\config.json` |
| Web UI via `file://` dist | **Done now** | — | Requires `pnpm build:web` |
| Bridge loopback `127.0.0.1:17890` | **Done now** | — | No LAN exposure by default |
| Release smoke + pilot checkpoint | **Done now** | — | `pnpm desktop:release-smoke`, `pnpm pilot-checkpoint` |

---

## Installer and distribution

| Item | Status | Owner | Notes |
| --- | --- | --- | --- |
| NSIS / MSI installer | **Blocked** | Dev | Not implemented — unpackaged MVP |
| `%ProgramFiles%` install layout | **Blocked** | Dev | Not defined |
| Desktop shortcut / Start Menu | **Manual** | IT | Pin `pnpm … run start` or future installer |
| Uninstall registry entries | **Blocked** | Dev | Not implemented |
| Pre-built release artifact channel | **Blocked** | Dev | Operator clones repo today |
| `origin` remote + Windows CI | **Blocked** | Dev | Configure git remote + CI agent |

---

## Signing and trust

| Item | Status | Owner | Notes |
| --- | --- | --- | --- |
| Authenticode code signing | **Blocked** | Dev / IT | Required for SmartScreen confidence |
| SmartScreen / first-run warnings | **Manual** | IT | Expected for unsigned Electron + Node; use “Run anyway” after verifying publisher path |
| Windows DBF file locking | **Manual** | Operator | Close legacy FoxPro and file handles before sandbox commits |
| Antivirus exclusions (if needed) | **Manual** | IT | Local `node.exe` + Electron; no FoxPro |

---

## Config, logs, and data paths

| Item | Status | Owner | Notes |
| --- | --- | --- | --- |
| `%AppData%\Microdent\config.json` | **Done now** | Operator | Paths + `writeMode: disabled` default |
| `%AppData%` backup of operator config | **Manual** | IT | Before pilot upgrades |
| Bridge / desktop console logs | **Manual** | Operator | `%AppData%\Microdent\` config; launch terminal shows PHI-safe bridge status |
| **BACKUP_DIR** for sandbox commits | **Manual** | Operator | Set in setup or bridge env |
| Disposable **DATA_ROOT** only | **Done now** | — | Guardrails + validation |

---

## Auto-update and maintenance

| Item | Status | Owner | Notes |
| --- | --- | --- | --- |
| Auto-update feed | **Blocked** | Dev | Not implemented |
| Bundled Node 22 for bridge child | **Partial** | Dev | Validate pre-downloaded runtime with `pnpm pilot:node-runtime-check`; staging includes `node/` when `MICRODENT_NODE_RUNTIME_DIR` is set |
| Cross-platform `qa:sandbox` orchestrator | **Blocked** | Dev | Git Bash on Windows or manual §7 |

---

## Pre-go-live sign-off (operator — Windows clinic PC)

**Not clinic go-live:** This checklist prepares a **Windows clinic PC** for pilot day. Mac build-machine signoff alone does **not** mean clinic go-live ready — tier 3 (Windows field execution) must be logged before go/no-go.

Before clinic pilot day on **Windows**:

- [ ] `pnpm pilot-checkpoint` passes on the target machine (or `pnpm pilot:full-checkpoint` with sandbox env)
- [ ] First-run setup saves sandbox paths; **Settings → Pilot readiness** checklist green where expected
- [ ] Mirror import completed; Settings mirror table shows import runs
- [ ] Read-only smoke: Today, Patients, Schedule load from copied data
- [ ] (Optional) `pnpm qa:sandbox` exit 0 with DBF readback
- [ ] Operator read [out-of-scope-guardrails.md](./out-of-scope-guardrails.md)

---

## Recommended next batch

1. **Windows field test first** — execute field script on clinic PC; file PHI-safe log; complete go/no-go (tier 3). **Clinic go-live blocked** until done.
2. Mac-first completion checklist M1–M7 per [windows-pilot-installer-decision-record.md](./windows-pilot-installer-decision-record.md) — then NSIS spike (no new write domains).
3. Optional bundled Node 22 for bridge supervisor.
