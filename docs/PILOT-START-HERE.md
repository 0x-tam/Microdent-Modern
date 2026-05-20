# Windows clinic pilot — start here

**Purpose:** One-page index for operators and IT. Follow the numbered flow below; use linked runbooks for detail.

**Baseline:** Microdent-Modern `main` @ `1b67d2b` (Windows pilot package batch).

**Tester script:** [pilot-tester-guide.md](./pilot-tester-guide.md) · **IT sign-off:** [pilot-acceptance-checklist.md](./pilot-acceptance-checklist.md) · **Data locations:** [windows-pilot-data-locations.md](./windows-pilot-data-locations.md)

---

## Folder layout (placeholders — use your paths)

| Role | Example (Windows) | Notes |
| --- | --- | --- |
| **DATA_ROOT** | `C:\Microdent\Write-Sandbox\DATA` | Disposable sandbox only — never live legacy |
| **SQLITE_PATH** | `C:\Microdent\mirror\MICRODENT_MIRROR.sqlite` | Mirror for search/schedule |
| **BACKUP_DIR** | `C:\Microdent\Write-Sandbox\backups` | Required before sandbox commits |
| **Desktop config** | `%AppData%\Microdent\config.json` | Run → `%AppData%\Microdent` |
| **Repo** | `C:\Microdent\Microdent-Modern` | Clone + build location |

Quote paths with spaces in PowerShell (e.g. `"C:\Microdent\My Sandbox\DATA"`). Prefer drive letters over UNC shares.

---

## Numbered flow

| Step | Action | Detail doc |
| --- | --- | --- |
| 1 | Install **Node 22** | [windows-pilot-runbook.md §1](./windows-pilot-runbook.md#1-install-node-22) |
| 2 | Clone repo, `pnpm install`, build bridge + web + desktop | [windows-pilot-runbook.md §2](./windows-pilot-runbook.md#2-clone-and-build) |
| 3 | First launch — desktop setup for paths | [windows-pilot-runbook.md §3](./windows-pilot-runbook.md#3-first-launch-desktop) |
| 4 | Mirror import (CLI) | [phase-4-mirror-import-operator.md](./phase-4-mirror-import-operator.md) |
| 5 | Read-only QA — Today, Patients, Schedule, Settings | [phase-5-operator-qa-runbook.md](./phase-5-operator-qa-runbook.md) |
| 6 | Sandbox write pilot (optional) | [windows-pilot-runbook.md §6](./windows-pilot-runbook.md#6-sandbox-write-pilot-optional) |
| 7 | Sandbox QA sign-off | [phase-7-sandbox-pilot-qa-runbook.md](./phase-7-sandbox-pilot-qa-runbook.md) |
| 8 | Restore / reset when needed | [windows-pilot-runbook.md §8](./windows-pilot-runbook.md#8-restore-and-reset) |

Open the app → **Settings** → **Pilot readiness** strip and checklist show what is still missing.

---

## Validation commands

### Quick checkpoint (no sandbox env)

```powershell
pnpm pilot-checkpoint
```

Runs `pnpm test`, `pnpm build:web`, and `pnpm desktop:release-smoke`. Does **not** run sandbox QA (needs disposable paths).

### Full pilot checkpoint (with sandbox env)

```bash
export DATA_ROOT="/path/to/Microdent-Write-Sandbox/DATA"
export SQLITE_PATH="/path/to/MICRODENT_MIRROR_SANDBOX.sqlite"
export BACKUP_DIR="/path/to/Microdent-Write-Sandbox/backups"
pnpm pilot:full-checkpoint
```

Or run the same steps manually:

```bash
pnpm test
pnpm build:web
pnpm qa:sandbox
pnpm --filter @microdent/desktop run test
pnpm --filter @microdent/desktop run release-smoke
```

### Individual checks

| Command | Proves |
| --- | --- |
| `pnpm test` | All workspace regression tests |
| `pnpm build:web` | `apps/web/dist/index.html` for desktop `file://` UI |
| `pnpm desktop:release-smoke` | Desktop dist, bridge dist reference, config defaults |
| `pnpm stage:pilot-release` | Stage `dist/pilot-release/` (dist only, no clinic data) |
| `pnpm pilot:verify-release` | Validate staged layout and guardrails |
| `pnpm qa:sandbox` | Four write workflows + DBF readback (needs env above) |
| `pnpm pilot:full-checkpoint` | Above chain when sandbox env is set |

Script index: [scripts/README.md](../scripts/README.md).

---

## Issue report template (no PHI)

Use when filing pilot feedback:

| Field | What to include |
| --- | --- |
| Build | `main` @ `1b67d2b` (or current commit) |
| Checkpoint | `pilot-checkpoint` / `pilot:full-checkpoint` pass or fail |
| Settings checklist | Which rows are warn (screenshot OK — no patient names) |
| Mirror | Stale / partial / failed / OK from Settings refresh |
| Writes | `operationId` + audit status from feedback lines only |
| Do not attach | DBF files, patient names, full config paths in public tickets |

Full template: [pilot-tester-guide.md](./pilot-tester-guide.md#issue-report-template).

---

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| **Bridge offline** in Settings | Desktop config paths; `services\bridge\dist\server.js` built; port **17890** free |
| **Missing web dist** / blank UI | Run `pnpm build:web` — desktop loads `apps/web/dist/index.html` |
| **Port 17890 in use** | Close other bridge processes; or change `bridgePort` in `%AppData%\Microdent\config.json` |
| **Mirror stale** vs DBF | Re-run `pnpm mirror:import-safe`; DBF is write source of truth — mirror does not auto-refresh on commit |
| **Setup closed** without save | Restart desktop; choose **Re-open setup** if offered |
| **Write blocked** | Sandbox marker, `writeMode`, `ALLOW_LEGACY_WRITES` ack — see phase-7 runbook |
| **Unsupported feature** | [out-of-scope-guardrails.md](./out-of-scope-guardrails.md) |

---

## Not supported (pilot RC)

- NSIS installer, code signing, auto-update — see [windows-pilot-pre-installer-checklist.md](./windows-pilot-pre-installer-checklist.md)
- In-app mirror import (CLI only)
- Payments, ledger, chart, medical summary, or memo writes
- Pointing **DATA_ROOT** at live **Microdent-Legacy**

Full guardrails: [out-of-scope-guardrails.md](./out-of-scope-guardrails.md).

---

## Related docs

| Doc | Use when |
| --- | --- |
| [windows-pilot-runbook.md](./windows-pilot-runbook.md) | Full Windows operator steps |
| [pilot-tester-guide.md](./pilot-tester-guide.md) | Guided day 1–3 test script |
| [pilot-backup-restore-audit.md](./pilot-backup-restore-audit.md) | Backup/restore + UI feedback |
| [phase-6-windows-mvp-operator-guide.md](./phase-6-windows-mvp-operator-guide.md) | Detailed Windows CLI |
| [phase-7-sandbox-pilot-qa-runbook.md](./phase-7-sandbox-pilot-qa-runbook.md) | Sandbox sign-off |
| [windows-pilot-packaging-gap-report.md](./windows-pilot-packaging-gap-report.md) | What installer work remains |
| [windows-pilot-release-layout.md](./windows-pilot-release-layout.md) | Staged pilot package layout |
| [windows-dev-dry-run.md](./windows-dev-dry-run.md) | Dev-machine packaging dry-run |
| [pilot-acceptance-checklist.md](./pilot-acceptance-checklist.md) | IT pass/fail sign-off |
| [apps/desktop/README.md](../apps/desktop/README.md) | Desktop shell and config paths |
