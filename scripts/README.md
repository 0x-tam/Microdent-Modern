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

## macOS-oriented QA (bash)

| Script | Notes |
| --- | --- |
| `qa-sandbox-write-smoke.sh` | PHI-safe write smoke; needs `curl`, `jq`, `sqlite3` |
| `qa-sandbox-run.sh` | *(when present)* Full orchestrator — use manual steps on Windows until Node port exists |
