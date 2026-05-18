# Mirror import — operator guide

Safe mirror import runs **outside** the web UI. Use the CLI on a machine that can reach your disposable `DATA_ROOT` copy. The app **Settings** screen only refreshes `GET /v1/mirror/status` metadata.

## Prerequisites

- Node 22+
- Built `@microdent/sqlite-mirror` and bridge (`pnpm build` from repo root)
- Absolute paths only — never production `Microdent-Legacy` folders

## Environment

| Variable | Purpose |
| --- | --- |
| `DATA_ROOT` | Folder containing copied DBF `DATA` (sandbox marker required for writes elsewhere) |
| `SQLITE_PATH` | Target SQLite file for the mirror |

### Windows (PowerShell)

```powershell
$env:DATA_ROOT = "C:\Microdent\Sandbox\DATA"
$env:SQLITE_PATH = "$env:LOCALAPPDATA\Microdent\mirror\MICRODENT_MIRROR.sqlite"
```

### macOS / Linux (bash)

```bash
export DATA_ROOT="/path/to/sandbox/DATA"
export SQLITE_PATH="$HOME/Library/Application Support/Microdent/mirror/MICRODENT_MIRROR.sqlite"
```

Replace placeholders with your operator-controlled paths.

## Run safe import

From the **Microdent-Modern** repo root:

```bash
pnpm --filter @microdent/sqlite-mirror run import-safe
```

The command prints table counts and status codes on stdout. If a table fails, you will see a **status code** (for example `partial` or `failed`) — not raw row payloads or patient fields.

## After import

1. Start or restart the bridge with the same `DATA_ROOT` and `SQLITE_PATH`.
2. Open the app → **Settings** → **Refresh status**.
3. Confirm `sqliteUsable` and recent `finishedAt` times in the import table.

Imports older than **48 hours** may show a stale warning in the shell; run import again when you need fresher search/schedule data.

## Desktop app

The Electron shell saves `dataRoot`, `sqlitePath`, and optional `backupDir` in operator config and passes them to the bridge. First-run setup collects paths; write mode stays **disabled** until changed manually in config.

## What not to do

- Do not trigger mirror import from the browser (no HTTP route).
- Do not paste full error logs containing DBF row text into tickets.
- Do not point `DATA_ROOT` at live production legacy trees.
