# Phase 7 — Sandbox pilot QA runbook

**Purpose:** Repeatable sign-off for the Windows pilot release candidate: disposable sandbox, mirror import, read-only regression, four write workflows with DBF readback, backup/restore, and reset/re-import — without PHI in logs.

**Related:** [phase-5-operator-qa-runbook.md](./phase-5-operator-qa-runbook.md), [phase-6-windows-mvp-operator-guide.md](./phase-6-windows-mvp-operator-guide.md), [windows-pilot-runbook.md](./windows-pilot-runbook.md), [out-of-scope-guardrails.md](./out-of-scope-guardrails.md), [scripts/README.md](../scripts/README.md).

---

## Prerequisites

| Requirement | Notes |
| --- | --- |
| Node 22 | `nvm use 22` or Windows installer |
| Microdent-Modern clone | Never modify `Microdent-Legacy` |
| Git Bash (macOS/Linux) or Git Bash on Windows | For `pnpm qa:sandbox` |
| Disposable paths | `Microdent-Write-Sandbox` only for commits |

---

## Environment (example — use your operator paths)

```bash
export DATA_ROOT="/path/to/Microdent-Write-Sandbox/DATA"
export SQLITE_PATH="/path/to/MICRODENT_MIRROR_SANDBOX.sqlite"
export BACKUP_DIR="/path/to/Microdent-Write-Sandbox/backups"
```

Windows PowerShell equivalents are in [phase-6-windows-mvp-operator-guide.md](./phase-6-windows-mvp-operator-guide.md).

---

## Ordered steps

| # | Step | Command / action | Pass signal |
| --- | --- | --- | --- |
| 1 | Create write sandbox | `pnpm legacy:create-sandbox` (or bridge CLI) | `.microdent-write-sandbox.json` under `DATA_ROOT` |
| 2 | Mirror import | `pnpm mirror:import-safe` with `DATA_ROOT` + `SQLITE_PATH` | CLI `overall: success` or `partial`; Settings mirror metadata |
| 3 | Read-only smoke | `pnpm test` + `pnpm build:web` | All workspaces green |
| 3b | Quick handoff gate (no sandbox) | `pnpm pilot-checkpoint` | test + web build + desktop release-smoke |
| 4 | Sandbox QA | `pnpm qa:sandbox` | Exit 0; sections 1/5–5/5; **DBF readback** `source=dbf` |
| 5 | Optional restore spot-check | `pnpm legacy:restore` with test backup | Restores sandbox copy only |
| 6 | Reset sandbox (when needed) | Re-create sandbox or restore; **separate** from mirror re-import | Fresh marker; no production legacy |
| 7 | Re-import mirror (when needed) | `pnpm mirror:import-safe` again | SQLite reflects last import; DBF still write source of truth |

Print-only checklist (no execution): `bash scripts/qa-sandbox-pilot-checklist.sh`

---

## What `pnpm qa:sandbox` proves

1. **Preflight** — sandbox marker, path guardrails
2. **Bridge build and start** — `node services/bridge/dist/server.js` only
3. **Health + write-capability** — `writableSandbox` + `enabled`
4. **Mirror advisory (warn only)** — stale/partial imports do **not** fail write proof
5. **Write smoke** — four workflows with **DBF readback** (not mirror row queries)

Mirror SQLite is a **snapshot**. Commits update DBF only until you re-run import.

---

## Four allowed write workflows

1. `appointment.statusUpdate`
2. `appointment.timeMove`
3. `appointment.create`
4. `patient.demographics.update`

No payments, ledger, chart, medical summary, or memo fields — see [out-of-scope-guardrails.md](./out-of-scope-guardrails.md).

---

## Troubleshooting

| Symptom | Likely cause | Action |
| --- | --- | --- |
| Preflight fails on marker | Wrong `DATA_ROOT` | Point at `Microdent-Write-Sandbox/DATA` |
| Write-capability not ready | `WRITE_MODE` or sandbox guard | Check env; see phase-3 write-mode doc |
| Mirror WARN in section 4 | Stale or partial import | Re-run import; DBF readback still authoritative |
| Smoke fails readback | Bridge not writing DBF | Check `DATA_ROOT`, `ALLOW_LEGACY_WRITES` ack |

---

## Sign-off checklist

- [ ] `pnpm qa:sandbox` exit 0 on Node 22
- [ ] Section banners 1/5–5/5 visible
- [ ] Four workflows logged with `source=dbf`
- [ ] No PHI in terminal output
- [ ] `git status` clean of sandbox DATA, `.sqlite`, Legacy trees
