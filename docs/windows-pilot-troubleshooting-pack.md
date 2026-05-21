# Windows pilot troubleshooting pack

**Purpose:** Operator and IT actions for common Windows field-test failures — one place, no repo checkout required.

**Audience:** Clinic operators, IT, pilot testers on staged `MicrodentModern/` packages.

**Related:** [PILOT-START-HERE.md](./PILOT-START-HERE.md) · [windows-pilot-field-execution-script.md](./windows-pilot-field-execution-script.md) · [windows-pilot-data-locations.md](./windows-pilot-data-locations.md) · [pilot-issue-template.md](./pilot-issue-template.md)

**Safety:** Use synthetic paths in tickets. Do not attach patient names, DBF files, sqlite, or full `config.json` with real clinic paths.

---

## Quick symptom index

| Symptom | Jump to |
| --- | --- |
| App does not open or window stays blank | [§ App does not open / blank UI](#app-does-not-open--blank-ui) |
| Settings shows **Bridge offline** or health timeout | [§ Bridge offline / health timeout](#bridge-offline--health-timeout) |
| Cannot reach localhost / port 17890 | [§ Localhost / port 17890 blocked](#localhost--port-17890-blocked) |
| Windows SmartScreen or antivirus warning | [§ SmartScreen / AV](#smartscreen--antivirus) |
| Permission denied / EPERM on backups | [§ Permission denied / EPERM on backups](#permission-denied--eperm-on-backups) |
| Setup rejects DATA_ROOT | [§ DATA_ROOT invalid / forbidden legacy segment](#data_root-invalid--forbidden-legacy-segment) |
| Mirror import did not succeed | [§ Mirror import failed](#mirror-import-failed) |
| Sandbox write QA failed | [§ Sandbox QA failed](#sandbox-qa-failed) |
| Restore did not recover sandbox | [§ Restore failed](#restore-failed) |
| Need logs without leaking PHI | [§ Safe logs and support hygiene](#safe-logs-and-support-hygiene) |

---

## App does not open / blank UI

**What you see:** Double-click or launch from `app/` does nothing, window flashes and closes, or main area is white/empty after setup.

| Step | Action |
| --- | --- |
| 1 | Confirm **Node.js 22.x** is installed: open PowerShell → `node -v` → expect `v22.x`. Install from [nodejs.org](https://nodejs.org/) if missing. |
| 2 | Launch from the staged **`app/`** folder per `HANDOFF-README.txt` — not from a partial extract. |
| 3 | Check **`web/index.html`** exists under the package root (`MicrodentModern/web/`). Missing web dist → package incomplete; ask IT to re-stage on build machine. |
| 4 | If setup never appeared, delete is **not** required — open `%AppData%\Microdent\config.json` only if IT guides you; otherwise restart and choose **Re-open setup** when offered. |
| 5 | Close other Electron/Node processes that may have left a zombie bridge child. |
| 6 | If UI loads but content is blank, open **Settings → Pilot readiness** — bridge must show connected before pages load data. See [Bridge offline](#bridge-offline--health-timeout). |

**Pass criteria:** Desktop window opens, setup or main shell visible, no immediate crash.

**Still blocked?** Record Windows version, Node version, and whether setup appeared. File issue via [pilot-issue-template.md](./pilot-issue-template.md) — no screenshots with patient lists.

---

## Bridge offline / health timeout

**What you see:** Settings **Pilot readiness** shows bridge offline, disconnected, or health check timeout.

| Step | Action |
| --- | --- |
| 1 | Verify `%AppData%\Microdent\config.json` has absolute paths for `dataRoot`, `sqlitePath`, and valid `bridgePort` (default **17890**). |
| 2 | Confirm **`bridge/server.js`** exists in the staged package (not a dev checkout path). |
| 3 | Ensure **Node 22** is on PATH for the user launching the desktop — bridge spawns `node` as a child process. |
| 4 | Check port **17890** is free — see [Localhost / port 17890 blocked](#localhost--port-17890-blocked). |
| 5 | After changing config, **fully quit and restart** the desktop app (not just refresh the web view). |
| 6 | If `DATA_ROOT` folder is missing or unreadable, bridge may fail startup — confirm sandbox DATA folder exists and is readable. |

**Pass criteria:** Settings shows clinic service **connected**; health refresh succeeds within a few seconds.

**Reference:** [windows-pilot-data-locations.md](./windows-pilot-data-locations.md) · [phase-4-mirror-import-operator.md](./phase-4-mirror-import-operator.md)

---

## Localhost / port 17890 blocked

**What you see:** Bridge never connects; another app uses port 17890; corporate policy blocks loopback; firewall prompt denied.

| Step | Action |
| --- | --- |
| 1 | List listeners: PowerShell → `Get-NetTCPConnection -LocalPort 17890 -ErrorAction SilentlyContinue` — note owning process if present. |
| 2 | Close other Microdent desktop instances or stray `node` processes holding the port. |
| 3 | If port is reserved by another service, edit `%AppData%\Microdent\config.json` → change `"bridgePort"` to an unused port (e.g. `17891`), save, restart desktop. |
| 4 | Allow **Node** and the desktop app through Windows Defender Firewall when prompted (private network only if IT policy allows). |
| 5 | VPN or endpoint security sometimes blocks `127.0.0.1` — ask IT to allow loopback for local bridge. |

**Pass criteria:** Health check to configured port succeeds from the same machine running the desktop.

---

## SmartScreen / antivirus

**What you see:** "Windows protected your PC" (SmartScreen), quarantine of `node.exe` or Electron files, slow launch, file locks during mirror import.

| Step | Action |
| --- | --- |
| 1 | **Expected for pilot RC:** package is **unsigned** — SmartScreen warning is normal until code signing ships ([windows-pilot-pre-installer-checklist.md](./windows-pilot-pre-installer-checklist.md)). |
| 2 | IT may use "More info → Run anyway" for a known internal build — document approval in your ticket system. |
| 3 | Add an AV **exclusion** for the install folder and operator DATA/mirror folders if scans lock SQLite during import (IT policy only). |
| 4 | Do not disable AV globally — scope exclusions to staged install path and sandbox DATA only. |
| 5 | If files were quarantined, restore from IT-approved backup of the staged zip and re-verify package — [windows-pilot-package-verify-on-windows.md](./windows-pilot-package-verify-on-windows.md). |

**Pass criteria:** Desktop launches after IT-approved SmartScreen/AV handling; import and bridge not blocked by real-time scan.

**Reference:** [windows-pilot-permission-and-path-risks.md § SmartScreen and code signing](./windows-pilot-permission-and-path-risks.md#smartscreen-and-code-signing)

---

## Permission denied / EPERM on backups

**What you see:** Sandbox write blocked; backup line shows not created; EPERM or access denied when committing writes.

| Step | Action |
| --- | --- |
| 1 | Confirm **BACKUP_DIR** is set in setup or config **before** enabling sandbox commits. |
| 2 | Choose a folder the signed-in user can **create and write** — e.g. `C:\Users\Public\MicrodentModern\backups` (not inside `Program Files` install tree). |
| 3 | Create the backup folder manually if missing: `New-Item -ItemType Directory -Force -Path "C:\Users\Public\MicrodentModern\backups"` (adjust to your configured path). |
| 4 | Run desktop as **standard user** with write ACL on sandbox DATA and BACKUP_DIR — admin-only folders will fail. |
| 5 | Check AV did not lock the backup directory during write. |
| 6 | UNC/network backup paths may fail with EPERM — prefer local drive letter per [windows-pilot-data-locations.md](./windows-pilot-data-locations.md). |

**Reference:** [windows-pilot-permission-and-path-risks.md § ACLs and backup writability](./windows-pilot-permission-and-path-risks.md#acls-and-folder-writability) |

**Pass criteria:** Write feedback shows backup created; `BACKUP_DIR` writable without elevation.

**Reference:** [pilot-backup-restore-audit.md](./pilot-backup-restore-audit.md)

---

## DATA_ROOT invalid / forbidden legacy segment

**What you see:** Setup will not save; error mentions forbidden path, legacy segment, relative path, or path inside install folder.

| Step | Action |
| --- | --- |
| 1 | Use **absolute** paths only — `C:\ClinicData\Microdent-Write-Sandbox\DATA`, not relative or drive-less paths. |
| 2 | **Never** point DATA_ROOT at live **Microdent-Legacy** or production legacy trees — use disposable Write-Sandbox copy only. |
| 3 | Path must **not** contain forbidden segments: `Microdent-Legacy`, `Microdent-Legacy-Copy`, `Write-Sandbox` repo folders used as live targets, or paths **inside** the install folder. |
| 4 | Quote paths with spaces in PowerShell: `"C:\ClinicData\My Sandbox\DATA"`. |
| 5 | For sandbox **writes**, DATA_ROOT must include sandbox marker (`.microdent-write-sandbox.json`) — create via IT-approved sandbox copy workflow, not production DATA. |
| 6 | Keep mirror and backups **outside** install folder — see layer rules in [windows-pilot-data-locations.md](./windows-pilot-data-locations.md). |

**Pass criteria:** Setup saves; Settings checklist shows DATA_ROOT valid; no forbidden-path error on restart.

---

## Mirror import failed

**What you see:** CLI exit code non-zero; Settings mirror table shows **Failed** or **Partial**; stale banner; search/schedule empty.

Report **category only** in tickets — do not paste raw CLI rows with patient data.

| Category | Meaning | Operator actions |
| --- | --- | --- |
| **Failed** | Table import did not complete (missing DBF, unreadable file, transaction error). | Confirm DBF exists under DATA_ROOT; disk readable; paths absolute. Re-run safe import from repo or staged pointer — [phase-4-mirror-import-operator.md](./phase-4-mirror-import-operator.md). Refresh Settings → **Refresh status**. |
| **Partial** | Rows imported but some skipped/quarantined (`errors` &gt; 0). | Refresh DATA copy; re-run full safe import. Partial is **warn-only** for sandbox write proof but search may omit rows. |
| **Stale** | Last import older than 48 hours. | Re-run import when fresher search/schedule needed — not always a hard failure. |
| **Path / env** | Wrong DATA_ROOT or SQLITE_PATH in import session. | Set env vars in **same** PowerShell session as import; match desktop config paths. |
| **Network / AV** | UNC path or locked SQLite. | Copy to local drive; retry import; see AV section above. |

**Pass criteria:** CLI `overall: success` or acceptable `partial`; Settings shows `sqliteUsable` and recent `finishedAt` for core tables.

**Note:** In-app mirror import is **unsupported** — CLI only ([out-of-scope-guardrails.md](./out-of-scope-guardrails.md)).

---

## Sandbox QA failed

**What you see:** Write blocked; dry-run only; readback failed; `pnpm qa:sandbox` or manual write workflows do not pass.

| Step | Action |
| --- | --- |
| 1 | Confirm **disposable Write-Sandbox** DATA with marker — not Legacy-Copy as write target. |
| 2 | Check `writeMode` in config — must be enabled for commits (IT approval only). |
| 3 | Verify `ALLOW_LEGACY_WRITES` acknowledgment env var per phase-7 runbook when enabling writes. |
| 4 | **BACKUP_DIR** must be set and writable before commits — see [Permission denied](#permission-denied--eperm-on-backups). |
| 5 | Mirror stale/partial warnings do **not** alone fail write proof — DBF readback is authoritative. |
| 6 | If readback fails, confirm bridge uses same DATA_ROOT as UI and no EPERM on DBF files. |
| 7 | Unsupported workflows (payments, ledger, chart, memo) are **expected blocked** — not defects. |

**Pass criteria:** Four allowed workflows commit on sandbox; feedback shows operation id and backup line; restore hint present where applicable.

**Reference:** [phase-7-sandbox-pilot-qa-runbook.md](./phase-7-sandbox-pilot-qa-runbook.md) · [out-of-scope-guardrails.md](./out-of-scope-guardrails.md)

---

## Restore failed

**What you see:** Restore CLI errors; sandbox DATA not returned to pre-write state; backup verify lists missing backup.

| Step | Action |
| --- | --- |
| 1 | Note **operation id** from write feedback before restore — required for support. |
| 2 | Run backup verify — confirm backup id exists (basename/table names only in output). |
| 3 | Restore targets **Write-Sandbox DATA only** — never production legacy. Command: `pnpm --filter @microdent/bridge run legacy-restore` (from dev checkout) or IT-provided equivalent. |
| 4 | Ensure no other process (desktop, bridge, AV) locks DBF files during restore. |
| 5 | After restore, **re-run mirror import** if search/schedule must match DBF again. |
| 6 | If backup was never created (missing BACKUP_DIR at commit time), restore cannot roll back that write — rebuild sandbox from IT copy. |

**Pass criteria:** Sandbox DATA returns to pre-commit state; subsequent read-only QA passes; mirror re-import optional per test plan.

**Reference:** [pilot-backup-restore-audit.md](./pilot-backup-restore-audit.md)

---

## Safe logs and support hygiene

### Where to look (Windows)

| Location | Safe to open locally | Attach to public tickets? |
| --- | --- | --- |
| `%AppData%\Microdent\config.json` | Yes (IT only) | **No** — contains real clinic paths |
| `%AppData%\Microdent\logs\` (if created) | Yes | **No** unless redacted — may contain paths |
| Bridge child stdout | Terminal that launched desktop | **No** — redact first |
| Settings → Pilot build card | Shows `packageVersion`, `gitCommit` subset | **Yes** — copy version fields only |
| `RELEASE-MANIFEST.json` at package root | Yes | **Yes** — `packageVersion`, `releaseChannel` only |

Open config folder: **Win+R** → `%AppData%\Microdent`

### What never to attach

- DBF, sqlite, or backup archives
- Full `config.json` with patient-adjacent paths in public channels
- Screenshots showing patient names, phones, or schedule rows
- Raw mirror import table output with row-level errors

### Safe issue filing

Use [pilot-issue-template.md](./pilot-issue-template.md):

- **Package version** from manifest or Settings build card
- **Symptom category** from this pack (not raw error dumps)
- **Severity** and exact screen (crop patient lists)
- **Expected vs actual** in plain language

Log redaction policy: [phase-8-log-redaction-review.md](./phase-8-log-redaction-review.md)

---

## Escalation checklist

Before escalating to engineering:

- [ ] Node 22 on PATH
- [ ] Package verified per [windows-pilot-package-verify-on-windows.md](./windows-pilot-package-verify-on-windows.md)
- [ ] Config paths absolute and outside install folder
- [ ] Mirror import run at least once after setup
- [ ] Symptom mapped to section in this pack
- [ ] Issue template filled — no PHI

---

## Related docs

| Doc | Use when |
| --- | --- |
| [windows-pilot-package-verify-on-windows.md](./windows-pilot-package-verify-on-windows.md) | IT pre-flight before operators start |
| [windows-pilot-field-execution-script.md](./windows-pilot-field-execution-script.md) | Linear field test steps |
| [windows-pilot-field-result-form.md](./windows-pilot-field-result-form.md) | Recording pass/fail after test |
| [windows-pilot-permission-and-path-risks.md](./windows-pilot-permission-and-path-risks.md) | ACL, UNC, drive letters |
| [PILOT-HANDOFF-PACK.md](./PILOT-HANDOFF-PACK.md) | Full staged-package journey |
