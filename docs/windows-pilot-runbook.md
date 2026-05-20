# Windows pilot runbook — release candidate

**Purpose:** End-to-end path for a non-developer operator to install, launch the desktop MVP, import mirror data, validate read-only use, and optionally sign off sandbox writes — without reading application source.

**Start here:** [PILOT-START-HERE.md](./PILOT-START-HERE.md) — one-page index, troubleshooting, and validation commands.

**Related:** [phase-6-windows-mvp-operator-guide.md](./phase-6-windows-mvp-operator-guide.md) (detailed Windows steps), [phase-5-operator-qa-runbook.md](./phase-5-operator-qa-runbook.md) (QA tracks), [phase-7-sandbox-pilot-qa-runbook.md](./phase-7-sandbox-pilot-qa-runbook.md) (sandbox sign-off), [phase-4-mirror-import-operator.md](./phase-4-mirror-import-operator.md) (mirror CLI), [out-of-scope-guardrails.md](./out-of-scope-guardrails.md), [apps/desktop/README.md](../apps/desktop/README.md), [scripts/README.md](../scripts/README.md), [windows-pilot-packaging-gap-report.md](./windows-pilot-packaging-gap-report.md), [windows-pilot-pre-installer-checklist.md](./windows-pilot-pre-installer-checklist.md).

---

## Hard rules

| Rule | Requirement |
| --- | --- |
| Never live legacy as `DATA_ROOT` | Use `C:\Microdent\Legacy-Copy\DATA` for mirror import only |
| Writes = sandbox only | `C:\Microdent\Write-Sandbox\DATA` + marker file |
| Four write workflows only | Status, time move, create, demographics — no ledger/payments/chart |
| No PHI in logs | Status codes, workflow names, hash prefixes only |
| DBF is write proof | Mirror SQLite does not auto-refresh on commit |

---

## Path placeholders

| Role | Example |
| --- | --- |
| Write sandbox | `C:\Microdent\Write-Sandbox\DATA` |
| Mirror SQLite | `C:\Microdent\mirror\MICRODENT_MIRROR.sqlite` |
| Backups | `C:\Microdent\Write-Sandbox\backups` |
| Desktop config | `%AppData%\Microdent\config.json` |
| Repo | `C:\Microdent\Microdent-Modern` |

Prefer drive letters over UNC. Quote paths with spaces in PowerShell.

---

## 1. Install Node 22

Download from [nodejs.org](https://nodejs.org/) or use `nvm-windows`. Verify:

```powershell
node -v   # v22.x
```

---

## 2. Clone and build

```powershell
cd C:\Microdent\Microdent-Modern
pnpm install
pnpm --filter @microdent/bridge run build
pnpm build:web
pnpm --filter @microdent/desktop run build
```

Optional desktop release smoke:

```powershell
pnpm --filter @microdent/desktop run release-smoke
```

---

## 3. First launch (desktop)

```powershell
pnpm --filter @microdent/desktop run start
```

1. First-run setup opens if paths are missing.
2. Enter **DATA_ROOT** (sandbox folder), **SQLITE_PATH** (mirror file), optional **BACKUP_DIR**.
3. Setup shows a **what's missing** checklist; Save stays disabled until required paths validate.
4. Config saves to `%AppData%\Microdent\config.json` with `writeMode: "disabled"`.
5. Desktop spawns **only** `node services\bridge\dist\server.js` — no FoxPro/EXE/BAT.

If startup fails, read the error dialog (masked paths) and rebuild bridge/web dist.

---

## 4. Mirror import

Set env in PowerShell, then import (see [phase-4-mirror-import-operator.md](./phase-4-mirror-import-operator.md)):

```powershell
$env:DATA_ROOT = "C:\Microdent\Write-Sandbox\DATA"
$env:SQLITE_PATH = "C:\Microdent\mirror\MICRODENT_MIRROR.sqlite"
pnpm mirror:import-safe
```

Open app → **Settings** → **Refresh status**. Confirm import table rows and `Imported tables` count.

**Important:** Writes update DBF only. Re-run import when search/schedule must match DBF.

---

## 5. Read-only QA

```powershell
pnpm test
pnpm build:web
```

Use Today, Patients, Schedule, and Profile read tabs. Settings **Pilot readiness** strip should show read-only safe + mirror status.

---

## 6. Sandbox write pilot (optional)

1. Set `writeMode` to `dry-run` then `enabled` in config **only** on disposable sandbox.
2. Set `BACKUP_DIR` before commits.
3. Rebuild web with `VITE_SANDBOX_WRITE_PILOT=true` if write panels are hidden.
4. Use Schedule/Patient write pilots — four workflows only.

---

## 7. Sandbox QA sign-off

Git Bash on Windows (or macOS dev machine):

```bash
export DATA_ROOT="C:/Microdent/Write-Sandbox/DATA"
export SQLITE_PATH="C:/Microdent/mirror/MICRODENT_MIRROR.sqlite"
export BACKUP_DIR="C:/Microdent/Write-Sandbox/backups"
pnpm qa:sandbox
```

Expect exit 0 and DBF readback in smoke output. Details: [phase-7-sandbox-pilot-qa-runbook.md](./phase-7-sandbox-pilot-qa-runbook.md).

---

## 8. Restore and reset

| Task | Action |
| --- | --- |
| Restore sandbox DBF | `pnpm legacy:restore` with backup manifest |
| Reset sandbox | Re-create sandbox copy — **never** production legacy |
| Refresh mirror | `pnpm mirror:import-safe` — separate from restore |

---

## 9. Troubleshooting

| Issue | Check |
| --- | --- |
| Bridge offline in Settings | Desktop config paths; bridge dist built; port 17890 free |
| Mirror stale banner | Re-import; DBF still authoritative for writes |
| Write blocked | Sandbox marker, `WRITE_MODE`, `ALLOW_LEGACY_WRITES` ack |
| Unsupported domain | [out-of-scope-guardrails.md](./out-of-scope-guardrails.md) |

---

## 10. Unsupported (pilot RC)

- NSIS installer, code signing, auto-update
- In-app mirror import (CLI only)
- Payments, ledger, chart, medical summary writes
- Pointing `DATA_ROOT` at live `Microdent-Legacy`

Packaging gaps: [windows-pilot-packaging-gap-report.md](./windows-pilot-packaging-gap-report.md).
