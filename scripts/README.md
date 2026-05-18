# Scripts index

Shell helpers for local development and sandbox operations. Full Windows vs macOS classification: [docs/phase-3-windows-readiness-audit.md](../docs/phase-3-windows-readiness-audit.md).

## macOS dev-only (`lsof`)

| Script | `pnpm` |
| --- | --- |
| `dev-common.sh` | *(shared)* |
| `dev-ports.sh` | `dev:ports` |
| `dev-kill-ports.sh` | `dev:kill-ports` |
| `dev-bridge.sh` | `dev:bridge` |
| `dev-web.sh` | `dev:web` |

## Bash wrappers → cross-platform Node underneath

| Script | `pnpm` | Underlying |
| --- | --- | --- |
| `mirror-import-safe.sh` | `mirror:import-safe` | `@microdent/sqlite-mirror` `import-safe` |
| `legacy-backup.sh` | `legacy:backup` | `@microdent/bridge` `legacy-backup` |
| `legacy-create-sandbox.sh` | `legacy:create-sandbox` | `@microdent/bridge` `legacy-create-sandbox` |
| `legacy-restore.sh` | `legacy:restore` | `@microdent/bridge` `legacy-restore` |
| `legacy-backup-verify.sh` | `legacy:backup-verify` | `@microdent/bridge` `legacy-backup-verify` |

On **Windows**, prefer the underlying `pnpm --filter …` commands with `cmd`/`PowerShell` env vars.

### Windows quick-reference (`pnpm --filter`)

Set absolute paths in PowerShell before each command (placeholders below — use your operator paths).

| Task | Root `pnpm` (bash) | Windows-native command |
| --- | --- | --- |
| Mirror import (safe tables) | `pnpm mirror:import-safe` | `pnpm --filter @microdent/sqlite-mirror run import-safe` |
| Legacy backup | `pnpm legacy:backup` | `pnpm --filter @microdent/bridge run legacy-backup` |
| Create write sandbox | `pnpm legacy:create-sandbox` | `pnpm --filter @microdent/bridge run legacy-create-sandbox` |
| Restore from backup | `pnpm legacy:restore` | `pnpm --filter @microdent/bridge run legacy-restore` |
| Verify backup manifest | `pnpm legacy:backup-verify` | `pnpm --filter @microdent/bridge run legacy-backup-verify` |
| Production bridge | *(no root script)* | `pnpm --filter @microdent/bridge run build` then `node services\bridge\dist\server.js` |

**Example env (PowerShell):**

```powershell
$env:DATA_ROOT = "C:\Microdent\Legacy-Copy\DATA"
$env:SQLITE_PATH = "C:\Microdent\mirror\MICRODENT_MIRROR.sqlite"
$env:BACKUP_DIR = "C:\Microdent\Write-Sandbox\backups"
pnpm --filter @microdent/sqlite-mirror run import-safe
```

Operator flow: [docs/phase-4-windows-operator-quickstart.md](../docs/phase-4-windows-operator-quickstart.md).

## macOS-oriented QA (bash)

| Script | Notes |
| --- | --- |
| `qa-sandbox-write-smoke.sh` | PHI-safe write smoke; needs `curl`, `jq`, `sqlite3` |
| `qa-sandbox-run.sh` | `pnpm qa:sandbox` — full orchestrator (implemented); bridge + legacy CLIs use **compiled `node dist/`**, not tsx (avoids IPC `EPERM` in restricted sandboxes); use manual steps on Windows until Node port exists |
