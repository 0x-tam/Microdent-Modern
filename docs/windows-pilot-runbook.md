# Windows pilot runbook — release candidate

**Purpose:** End-to-end path for a non-developer operator to install, launch the desktop MVP, prepare the local copy, validate read-only use, and optionally sign off sandbox writes — without reading application source.

**Start here:** [PILOT-START-HERE.md](./PILOT-START-HERE.md) — one-page index, troubleshooting, and validation commands.

**Related:** [phase-6-windows-mvp-operator-guide.md](./phase-6-windows-mvp-operator-guide.md) (detailed Windows steps), [phase-5-operator-qa-runbook.md](./phase-5-operator-qa-runbook.md) (QA tracks), [phase-7-sandbox-pilot-qa-runbook.md](./phase-7-sandbox-pilot-qa-runbook.md) (sandbox sign-off), [phase-4-mirror-import-operator.md](./phase-4-mirror-import-operator.md) (mirror CLI), [out-of-scope-guardrails.md](./out-of-scope-guardrails.md), [apps/desktop/README.md](../apps/desktop/README.md), [scripts/README.md](../scripts/README.md), [windows-pilot-packaging-gap-report.md](./windows-pilot-packaging-gap-report.md), [windows-pilot-pre-installer-checklist.md](./windows-pilot-pre-installer-checklist.md).

---

## Hard rules

| Rule | Requirement |
| --- | --- |
| Never choose live legacy as clinic data folder | Use a disposable copied `DATA` folder only |
| Writes = sandbox only | `C:\Microdent\Write-Sandbox\DATA` + marker file |
| Four write workflows only | Status, time move, create, demographics — no ledger/payments/chart |
| No PHI in logs | Status codes, workflow names, hash prefixes only |
| Copied files are write proof | Local copy is a read snapshot; refresh from Settings when needed |

---

## Path placeholders

| Role | Example |
| --- | --- |
| Clinic data folder | `C:\Microdent\Write-Sandbox\DATA` |
| Local copy | Derived by setup, e.g. `C:\Microdent\Write-Sandbox\mirror\clinic.sqlite` |
| Backups | Derived by setup, e.g. `C:\Microdent\Write-Sandbox\microdent-backups` |
| Desktop config | `%AppData%\Microdent\config.json` |
| Repo | `C:\Microdent\Microdent-Modern` |

Prefer drive letters over UNC. Quote paths with spaces in PowerShell.

---

## 1. Confirm Node runtime

- Preferred: staged package contains `node\RUNTIME-MANIFEST.json` with Node `22.5.0` or newer.
- Fallback: install Node 22.5+ through IT and verify:

```powershell
node -v   # v22.5+ preferred
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
2. Choose the copied/disposable **clinic data folder**.
3. Setup derives local-copy, backup, and log paths; Save stays disabled until required paths validate.
4. Setup prepares the local copy automatically and saves `%AppData%\Microdent\config.json` with `writeMode: "disabled"`.
5. Desktop spawns only the local clinic service on loopback — no FoxPro/EXE/BAT.

If startup fails, read the error dialog (masked paths) and rebuild bridge/web dist.

---

## 4. Local copy refresh

Open app → **Settings → Local copy & import**. Confirm import table rows and `Imported tables` count. If stale or empty, click **Refresh local copy**, then **Refresh status**.

**Important:** Sandbox writes update copied files only. Refresh local copy when search/schedule must match copied files. CLI import docs are support fallback: [phase-4-mirror-import-operator.md](./phase-4-mirror-import-operator.md).

---

## 5. Read-only QA

```powershell
pnpm test
pnpm build:web
```

Use Today, Patients, Schedule, and Profile read tabs. Settings **Pilot readiness** strip should show read-only safe + local-copy status.

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
| Refresh local copy | Settings → Local copy & import → **Refresh local copy** |

---

## 9. Troubleshooting

| Issue | Check |
| --- | --- |
| Clinic service offline in Settings | Desktop config paths; package includes bridge dist; Settings **Restart clinic service** / **Check service port** / **View port cleanup policy** |
| Local copy stale banner | Settings **Refresh local copy**; copied files stay authoritative for writes |
| Write blocked | Sandbox marker, `WRITE_MODE`, `ALLOW_LEGACY_WRITES` ack |
| Unsupported domain | [out-of-scope-guardrails.md](./out-of-scope-guardrails.md) |

---

## 10. Unsupported (pilot RC)

- NSIS installer, code signing, auto-update
- Payments, ledger, chart, medical summary writes
- Pointing clinic data folder at live `Microdent-Legacy`

Packaging gaps: [windows-pilot-packaging-gap-report.md](./windows-pilot-packaging-gap-report.md).
