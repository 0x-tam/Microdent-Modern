# Scripts index

Shell helpers for local development and sandbox operations.

**Windows clinic pilot (start here):** [docs/PILOT-START-HERE.md](../docs/PILOT-START-HERE.md). **Windows MVP detail:** [docs/phase-6-windows-mvp-operator-guide.md](../docs/phase-6-windows-mvp-operator-guide.md). **Pilot RC:** [docs/windows-pilot-runbook.md](../docs/windows-pilot-runbook.md). **Sandbox pilot QA:** [docs/phase-7-sandbox-pilot-qa-runbook.md](../docs/phase-7-sandbox-pilot-qa-runbook.md). **Operator QA index:** [docs/phase-5-operator-qa-runbook.md](../docs/phase-5-operator-qa-runbook.md). **Script classification (full table):** [docs/phase-3-windows-readiness-audit.md](../docs/phase-3-windows-readiness-audit.md).

## Hard rules

| Rule | Requirement |
| --- | --- |
| Never live legacy as `DATA_ROOT` | Not `C:\Microdent\Microdent-Legacy` — use **`C:\Microdent\Legacy-Copy\DATA`** for read-only mirror import |
| Writes sandbox-only | `C:\Microdent\Write-Sandbox\DATA` + `.microdent-write-sandbox.json` |
| No new write domains | Four sandbox workflows; no payments, memos, or ledger writes in MVP |
| Sandbox QA CLIs | `node dist/cli/*.js` — smoke does **not** call `pnpm legacy:*` mid-run |

---

## macOS dev-only (`lsof`)

| Script | `pnpm` | Classification |
| --- | --- | --- |
| `dev-common.sh` | *(shared)* | macOS dev infrastructure |
| `dev-ports.sh` | `dev:ports` | macOS dev-only |
| `dev-kill-ports.sh` | `dev:kill-ports` | macOS dev-only |
| `dev-bridge.sh` | `dev:bridge` | macOS dev-only wrapper → bridge `dev` (tsx) |
| `dev-web.sh` | `dev:web` | macOS dev-only wrapper → Vite |

On **Windows**, use Task Manager / `netstat` for ports; run `pnpm --filter @microdent/bridge dev` or built `node dist/server.js` directly.

---

## Bash wrappers → cross-platform Node underneath

| Script | `pnpm` | Underlying | Classification |
| --- | --- | --- | --- |
| `mirror-import-safe.sh` | `mirror:import-safe` | `@microdent/sqlite-mirror` `import-safe` | Bash wrapper → cross-platform Node |
| `legacy-backup.sh` | `legacy:backup` | `@microdent/bridge` `legacy-backup` → `node dist/cli/legacy-backup.js` | Bash wrapper → cross-platform Node |
| `legacy-create-sandbox.sh` | `legacy:create-sandbox` | `@microdent/bridge` `legacy-create-sandbox` | Bash wrapper → cross-platform Node |
| `legacy-restore.sh` | `legacy:restore` | `@microdent/bridge` `legacy-restore` → `node dist/cli/legacy-restore.js` | Bash wrapper → cross-platform Node |
| `legacy-backup-verify.sh` | `legacy:backup-verify` | `@microdent/bridge` `legacy-backup-verify` | Bash wrapper → cross-platform Node |

On **Windows**, prefer underlying `pnpm --filter …` commands with PowerShell env vars (see below).

### Windows quick-reference (`pnpm --filter`)

Set absolute paths in PowerShell before each command (placeholders — use your operator paths).

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

Operator flow: [docs/phase-6-windows-mvp-operator-guide.md](../docs/phase-6-windows-mvp-operator-guide.md).

---

## Sandbox QA (bash)

| Script | `pnpm` | Classification | Notes |
| --- | --- | --- | --- |
| `qa-sandbox-run.sh` | `qa:sandbox` | macOS-oriented bash (implemented) | Builds bridge; starts `node services/bridge/dist/server.js`; runs smoke |
| `qa-sandbox-write-smoke.sh` | *(orchestrator / manual)* | macOS-oriented bash | Four workflows; backup/restore = **direct** `(cd services/bridge && node dist/cli/legacy-backup.js)` — **not** `pnpm legacy:backup` mid-smoke |
| `qa-sandbox-pilot-checklist.sh` | *(print-only)* | Cross-platform bash | Ordered pilot steps — no execution; see [phase-7-sandbox-pilot-qa-runbook.md](../docs/phase-7-sandbox-pilot-qa-runbook.md) |

**Pass criteria and env:** [docs/phase-5-operator-qa-runbook.md](../docs/phase-5-operator-qa-runbook.md) §3. Orchestrator detail: [docs/phase-3-sandbox-qa-runner.md](../docs/phase-3-sandbox-qa-runner.md). Pilot sign-off: [docs/phase-7-sandbox-pilot-qa-runbook.md](../docs/phase-7-sandbox-pilot-qa-runbook.md). Windows without bash: [docs/phase-6-windows-mvp-operator-guide.md](../docs/phase-6-windows-mvp-operator-guide.md) §7.

---

## Root `package.json` command classification

| Command | Entry | Classification | Windows production notes |
| --- | --- | --- | --- |
| `pnpm test` | workspaces test chain | Cross-platform Node | Read-only regression |
| `pnpm build:web` | `@microdent/web` build | Cross-platform Node | Desktop `file://` UI |
| `pnpm preview:web` | Vite dev | Cross-platform Node | Optional pilot env in `.env.local` |
| `pnpm dev:ports` | `scripts/dev-ports.sh` | macOS dev-only | `netstat` on Windows |
| `pnpm dev:kill-ports` | `scripts/dev-kill-ports.sh` | macOS dev-only | Task Manager on Windows |
| `pnpm dev:bridge` | `scripts/dev-bridge.sh` | macOS dev-only wrapper | `pnpm --filter @microdent/bridge dev` or `node dist/server.js` |
| `pnpm dev:web` | `scripts/dev-web.sh` | macOS dev-only wrapper | `pnpm --filter @microdent/web dev` |
| `pnpm mirror:import-safe` | `scripts/mirror-import-safe.sh` | Bash wrapper → Node | `pnpm --filter @microdent/sqlite-mirror run import-safe` |
| `pnpm legacy:backup` | `scripts/legacy-backup.sh` | Bash wrapper → Node | `pnpm --filter @microdent/bridge run legacy-backup` |
| `pnpm legacy:create-sandbox` | `scripts/legacy-create-sandbox.sh` | Bash wrapper → Node | `pnpm --filter @microdent/bridge run legacy-create-sandbox` |
| `pnpm legacy:restore` | `scripts/legacy-restore.sh` | Bash wrapper → Node | `pnpm --filter @microdent/bridge run legacy-restore` |
| `pnpm legacy:backup-verify` | `scripts/legacy-backup-verify.sh` | Bash wrapper → Node | `pnpm --filter @microdent/bridge run legacy-backup-verify` |
| `pnpm sandbox:validate` | Vitest band | Cross-platform Node | Fast sandbox rules |
| `pnpm sandbox:validate:real` | Vitest + env | Cross-platform Node | Optional real-path band |
| `pnpm qa:sandbox` | `scripts/qa-sandbox-run.sh` | macOS-oriented bash | Git Bash on Windows or manual §7 in phase-6 guide |
| `pnpm desktop:release-smoke` | `@microdent/desktop` `release-smoke` | Cross-platform Node | Build + vitest + desktop/web/bridge dist checks |
| `pnpm pilot-checkpoint` | test + `build:web` + `desktop:release-smoke` | Cross-platform Node | Quick handoff gate — **does not** run `qa:sandbox` |
| `pnpm pilot:full-checkpoint` | `scripts/pilot-full-checkpoint.sh` | Cross-platform bash | Full RC gate when `DATA_ROOT` + `SQLITE_PATH` set; skips `qa:sandbox` otherwise |
| `pnpm stage:pilot-release` | `scripts/stage-pilot-release.mjs` | Cross-platform Node | Stage `dist/pilot-release/` from dist artifacts only |
| `pnpm pilot:verify-release` | `scripts/verify-pilot-release.mjs` | Cross-platform Node | Validate staged layout + sensitive-file guards |
| `bash scripts/dev-windows-dry-run.sh` | *(manual)* | Cross-platform bash | Desktop test + release-smoke + stage + verify; optional `qa:sandbox` if env set |
| `bash scripts/qa-sandbox-write-smoke.sh` | smoke only | macOS-oriented bash | Bridge must already be up |
| `pnpm --filter @microdent/desktop run start` | Electron | Cross-platform Node | `%AppData%\Microdent\config.json` |
| `node services/bridge/dist/server.js` | production bridge | Windows production-ready | Set env in PowerShell first |

### Deferred / needs replacement

| Item | Classification | Notes |
| --- | --- | --- |
| `scripts/qa-sandbox-run.mjs` | Needs replacement | Planned cross-platform orchestrator for Windows |
| `pnpm dev:ports` / `dev:kill-ports` | Needs replacement (Windows dev ergonomics) | Optional; not required for production |
| NSIS / signed installer | Out of scope | Unpackaged desktop MVP |
