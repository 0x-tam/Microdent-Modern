# Local copy refresh — operator guide

Normal pilot operators refresh the fast local copy from **Settings → Local copy & import → Refresh local copy**. The desktop app runs the import against the configured copied clinic data folder, keeps the previous local copy if core readiness fails, and shows support-safe status only.

The CLI import remains a **support fallback** for unusual troubleshooting or development machines. Operators should not need shell commands for the normal one-click setup/import path.

## DBF vs SQLite (source of truth)

| Layer | Role |
| --- | --- |
| **Copied clinic files** | Source of truth for sandbox **writes** and clinic-service readback proof |
| **Fast local copy** | Read snapshot for search, schedule, and audit metadata in the UI |

After sandbox commits, search/schedule can stay on the old local copy until you refresh it. Settings shows freshness and failed/partial/incomplete status. Automatic post-write refresh policy is still open.

Cross-links: [phase-3-sandbox-qa-runner.md](./phase-3-sandbox-qa-runner.md) (DBF readback proof), [pilot-backup-restore-audit.md](./pilot-backup-restore-audit.md) (restore then re-import).

## Normal desktop refresh

1. Open **Settings → Local copy & import**.
2. Click **Refresh local copy**.
3. Wait for progress to finish.
4. Confirm imported table count, recent finish times, and no failed/partial/incomplete callout.
5. If the issue repeats, use **Export support log** and **View diagnostics summary**; do not paste patient data or raw DBF rows into tickets.

## Support fallback prerequisites

- Node 22+
- Built `@microdent/sqlite-mirror` and clinic service (`pnpm build` from repo root)
- Absolute paths only — never production legacy folders

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

cd C:\path\to\Microdent-Modern
pnpm --filter @microdent/sqlite-mirror run import-safe
```

Run the import from the same PowerShell session so the variables stay set. After import, restart the bridge in a session that sets the **same** `DATA_ROOT` and `SQLITE_PATH`.

### macOS / Linux (bash)

```bash
export DATA_ROOT="/path/to/sandbox/DATA"
export SQLITE_PATH="$HOME/Library/Application Support/Microdent/mirror/MICRODENT_MIRROR.sqlite"
pnpm --filter @microdent/sqlite-mirror run import-safe
```

Replace placeholders with your operator-controlled paths.

### UNC paths (Windows)

Avoid `\\server\share\...` for `DATA_ROOT` and `SQLITE_PATH` unless you have tested that Node and the mirror CLI can read and lock files reliably on that share. Prefer a local drive letter copy (`C:\...`) for imports and bridge runtime. If you must use UNC, quote paths in PowerShell and verify import + bridge health on the same machine.

## Run safe import from CLI fallback

From the **Microdent-Modern** repo root:

```bash
pnpm --filter @microdent/sqlite-mirror run import-safe
```

On Windows without bash, use the same command from **cmd** or PowerShell after `pnpm` is on your PATH.

### CLI output and exit codes

Stdout prints **counts and status only** in a small table (`table`, `status`, `rows`, `errors`) plus an `overall` line. No patient names, phones, clinical text, paths, or row payloads.

| `overall` | Exit code | Meaning |
| --- | --- | --- |
| `success` | `0` | Every table imported without quarantined rows |
| `partial` | `1` | At least one table imported with skipped/quarantined rows (`errors` &gt; 0) |
| `failed` | `1` | At least one table did not finish (missing DBF, open failure, transaction abort) |

Example (abbreviated):

```text
migrations: applied=7 skipped=0
table              status    rows   errors
-----------------  --------  -----  ------
doctors            success       12        0
patients           partial    15200       14
overall: partial
```

## Partial vs failed — operator actions

| Outcome | What it means | What to do |
| --- | --- | --- |
| **Partial** | Rows were written, but some source rows were skipped (invalid keys, quarantined fields). `errorCount` &gt; 0 for that table. | Fix or refresh the **DATA copy** (do not edit production legacy). Re-run safe import. In Settings → **Refresh status**, confirm the table shows **Partial** with updated `finishedAt`. Search/schedule may omit skipped patients or appointments until fixed. |
| **Failed** | The table import did not complete (missing `PATIENT.DBF`, unreadable file, SQLite transaction error). | Confirm the DBF exists under `DATA_ROOT`, disk is readable, and paths are absolute. Re-run safe import. Settings should list **Failed** for that table after refresh. |
| **Stale** (app banner) | Last successful import metadata is older than 48 hours. | Re-run safe import when you need fresher search/schedule data — not necessarily an import error. |

Optional DBF files (`SCHEDULE.DBF`, `MEDICAL.DBF`, `OPERTBL.DBF`) that are **missing** record **failed** for that table with a not-found error; other tables can still succeed. Treat missing schedule/treatments as expected only if your copy truly has no those files.

## Re-import after patients / appointments FK fix

If **patients** was imported while **appointments** already referenced patient ids (or you refreshed `PATIENT.DBF` after a partial patients run), re-run the **full** safe import — do not delete the SQLite file unless you intend a cold rebuild:

```powershell
# Same session as above
pnpm --filter @microdent/sqlite-mirror run import-safe
```

Import order is fixed: doctors → procedures → schedule_rooms → **patients** → appointments → medical_summary → treatments. Re-importing patients updates mirror rows while preserving appointment foreign keys when ids still match. After exit code `0` or `partial`, restart the bridge and use Settings → **Refresh status** to confirm `latestImportRuns` for `patients` and `appointments`.

## Writes and mirror freshness

Sandbox **commits update DBF files** under `DATA_ROOT` only. They **do not** re-run mirror import or update SQLite domain tables automatically.

| Operator question | Answer |
| --- | --- |
| Did my sandbox write land? | Check DBF (or bridge write response + restore smoke). Settings mirror timestamps will **not** move on commit alone. |
| Why is search/schedule stale after writes? | Mirror reflects last **import-safe** run, not live DBF. Re-run import when you need SQLite-backed search to match DBF. |
| What is source of truth? | **DBF** for writes and `pnpm qa:sandbox` readback; **mirror** for read-only search/schedule until re-imported. |

## After import or desktop refresh

1. Open the app → **Settings** → **Refresh status** if the table did not update automatically.
2. Confirm imported table count and recent `finishedAt` times in the import table.
3. If CLI fallback was used, restart the clinic service with the same copied clinic folder and local-copy path.

Imports older than **48 hours** may show a stale warning in the shell; run import again when you need fresher search/schedule data.

## Desktop app

The Electron shell saves `dataRoot`, `sqlitePath`, and optional `backupDir` in operator config and passes them to the bridge. First-run setup collects paths; write mode stays **disabled** until changed manually in config.

Example desktop paths (adjust for your clinic):

- `C:\Microdent\Write-Sandbox\DATA`
- `C:\Microdent\mirror.sqlite`
- `C:\Microdent\backups`

## What not to do

- Do not trigger import from the browser (no HTTP route).
- Do not paste full error logs containing DBF row text into tickets.
- Do not point the clinic data folder at live production legacy trees.

---

## Windows pilot RC (Settings + CLI fallback)

For the release candidate pilot, operators use the desktop **Refresh local copy** button. CLI import is kept as a support fallback.

| Operator need | Where |
| --- | --- |
| Normal refresh | Settings → Local copy & import → **Refresh local copy** |
| CLI fallback | Support-only: `pnpm mirror:import-safe` after setting `DATA_ROOT` / `SQLITE_PATH` |
| Refresh metadata | Settings → **Refresh status** (`GET /v1/mirror/status`) |
| Copied files vs local copy | Settings **Pilot readiness** + stale/failed/partial/incomplete callouts; [windows-pilot-runbook.md](./windows-pilot-runbook.md) |
| Sandbox sign-off | [phase-7-sandbox-pilot-qa-runbook.md](./phase-7-sandbox-pilot-qa-runbook.md) |

Re-import after sandbox writes is a **separate step** from restore/reset — see phase-7 runbook.
