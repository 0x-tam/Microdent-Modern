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

Use quoted paths when folders contain spaces (for example `C:\Clinic Data\Sandbox\DATA`).

```powershell
$env:DATA_ROOT = "C:\Microdent\Write-Sandbox\DATA"
$env:SQLITE_PATH = "C:\Microdent\mirror\MICRODENT_MIRROR.sqlite"
# Or under AppData:
# $env:SQLITE_PATH = "$env:LOCALAPPDATA\Microdent\mirror\MICRODENT_MIRROR.sqlite"
```

Run the import from the same PowerShell session so the variables stay set.

### macOS / Linux (bash)

```bash
export DATA_ROOT="/path/to/sandbox/DATA"
export SQLITE_PATH="$HOME/Library/Application Support/Microdent/mirror/MICRODENT_MIRROR.sqlite"
```

Replace placeholders with your operator-controlled paths.

### UNC paths (Windows)

Avoid `\\server\share\...` for `DATA_ROOT` and `SQLITE_PATH` unless you have tested that Node and the mirror CLI can read and lock files reliably on that share. Prefer a local drive letter copy (`C:\...`) for imports and bridge runtime. If you must use UNC, quote paths in PowerShell and verify import + bridge health on the same machine.

## Run safe import

From the **Microdent-Modern** repo root:

```bash
pnpm --filter @microdent/sqlite-mirror run import-safe
```

On Windows without bash, use the same command from **cmd** or PowerShell after `pnpm` is on your PATH.

The command prints table counts and status codes on stdout. If a table fails, you will see a **status code** (for example `partial` or `failed`) — not raw row payloads or patient fields.

## After import

1. Start or restart the bridge with the same `DATA_ROOT` and `SQLITE_PATH`.
2. Open the app → **Settings** → **Refresh status**.
3. Confirm `sqliteUsable` and recent `finishedAt` times in the import table.

Imports older than **48 hours** may show a stale warning in the shell; run import again when you need fresher search/schedule data.

## Desktop app

The Electron shell saves `dataRoot`, `sqlitePath`, and optional `backupDir` in operator config and passes them to the bridge. First-run setup collects paths; write mode stays **disabled** until changed manually in config.

Example desktop paths (adjust for your clinic):

- `C:\Microdent\Write-Sandbox\DATA`
- `C:\Microdent\mirror.sqlite`
- `C:\Microdent\backups`

## What not to do

- Do not trigger mirror import from the browser (no HTTP route).
- Do not paste full error logs containing DBF row text into tickets.
- Do not point `DATA_ROOT` at live production legacy trees.
