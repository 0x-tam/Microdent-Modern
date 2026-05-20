# Windows pilot data locations

**Purpose:** Where install files, desktop config, clinic DATA, mirror, backups, logs, and QA artifacts live on a Windows pilot machine — and what must **never** share a folder.

**Baseline:** Microdent-Modern `main` @ `1b67d2b`

**Index:** [PILOT-START-HERE.md](./PILOT-START-HERE.md) · [apps/desktop/README.md](../apps/desktop/README.md) · first-run [setup.html](../apps/desktop/src/setup/setup.html)

---

## Three layers (do not mix)

| Layer | Typical location | Created by | Contains |
| --- | --- | --- | --- |
| **1 — App install / staged package** | `C:\Microdent\MicrodentModern\` or extracted `dist/pilot-release/` | IT | Electron shell, bridge JS, web dist, config **templates** — **no clinic DBF, sqlite, backups, or logs** |
| **2 — Desktop config (`%AppData%`)** | `%AppData%\Microdent\config.json` | Desktop on first save | Path **pointers** only: `dataRoot`, `sqlitePath`, `backupDir`, `writeMode`, `bridgePort` |
| **3 — Clinic data (operator)** | Paths **you** choose in setup | Operator | Sandbox DATA_ROOT, mirror file, backup folder |

Open the config folder: **Win+R** → `%AppData%\Microdent`

```text
C:\Microdent\MicrodentModern\     ← Layer 1: read-only install (IT)
%AppData%\Microdent\              ← Layer 2: config.json (+ optional logs/)
C:\ClinicData\…                   ← Layer 3: DATA_ROOT, mirror, backups (operator)
```

---

## Layer 1 — Install folder

| Rule | Detail |
| --- | --- |
| **What ships** | `app/`, `bridge/`, `web/`, `config-templates/`, `docs/`, placeholder notes for `logs/`, `mirror/`, `backups/` |
| **What never ships** | Real `.dbf`, `.sqlite`, `.env`, `.log`, live Legacy trees, operator backups |
| **Who writes here** | IT at extract/copy time only — app does not write clinic data into install |
| **Upgrade / replace** | Safe to replace the install folder when config and clinic paths live elsewhere |

Staged layout: [windows-pilot-release-layout.md](./windows-pilot-release-layout.md). Verify before handoff: `pnpm pilot:verify-release`.

---

## Layer 2 — `%AppData%\Microdent\`

| Item | Path | Notes |
| --- | --- | --- |
| **Config file** | `%AppData%\Microdent\config.json` | Written by first-run setup; reopen via desktop **Re-open setup** |
| **Logs (convention)** | `%AppData%\Microdent\logs\` | **Documented** for pilot RC — desktop does **not** auto-create this folder today |
| **Bridge console** | Terminal that launched desktop | stdout/stderr only; no PHI in scripted logs |

Config stores **absolute paths** to Layer 3 folders. It does not embed clinic file contents.

Example (synthetic placeholders):

```json
{
  "version": 1,
  "bridgePort": 17890,
  "writeMode": "disabled",
  "dataRoot": "C:\\ClinicData\\Microdent\\DATA",
  "sqlitePath": "C:\\Users\\Public\\MicrodentModern\\mirror\\clinic.sqlite",
  "backupDir": "C:\\Users\\Public\\MicrodentModern\\backups"
}
```

Platform mapping (desktop shell):

| OS | Config directory |
| --- | --- |
| **Windows** | `%AppData%\Microdent\` |
| **macOS** (dev) | `~/Library/Application Support/Microdent/` |
| **Linux** (dev) | `~/.config/microdent/` |

---

## Layer 3 — Operator clinic paths (setup)

Set in the desktop **setup** window or edit `config.json` directly. All three must be **absolute** paths.

| Setting | Role | Windows example (sandbox) |
| --- | --- | --- |
| **DATA_ROOT** | Disposable Write-Sandbox DBF tree | `C:\ClinicData\Microdent\DATA` |
| **SQLITE_PATH** | Mirror for search/schedule | `C:\Users\Public\MicrodentModern\mirror\clinic.sqlite` |
| **BACKUP_DIR** | Required before sandbox commits | `C:\Users\Public\MicrodentModern\backups` |

### Hard rules

- **Never** point DATA_ROOT at live **Microdent-Legacy**.
- **Never** put mirror, backups, or DATA_ROOT **inside the app install folder** (Layer 1).
- Prefer **local drive letters** over UNC shares for SQLite and DBF ([UNC caveats](#unc-network-paths) below).
- Quote paths with spaces in PowerShell/CMD (e.g. `"C:\ClinicData\My Sandbox\DATA"`).

After save: run **mirror import** (CLI), then open **Settings → Pilot checklist**. See [phase-4-mirror-import-operator.md](./phase-4-mirror-import-operator.md).

---

## Mirror and backups (outside install)

| Artifact | Default in install? | Where to put it |
| --- | --- | --- |
| Mirror SQLite (`SQLITE_PATH`) | **No** | Operator-chosen folder, e.g. `C:\Users\Public\MicrodentModern\mirror\` |
| Sandbox backups (`BACKUP_DIR`) | **No** | Separate folder, e.g. `C:\Users\Public\MicrodentModern\backups\` |
| Staged `mirror/` / `backups/` placeholders | README only | Documented in package — **empty** at handoff |

**DBF (DATA_ROOT) is the write source of truth.** SQLite is a snapshot; refresh mirror after sandbox writes for readback. Details: [phase-4-mirror-import-operator.md](./phase-4-mirror-import-operator.md).

Restore workflow: [pilot-backup-restore-audit.md](./pilot-backup-restore-audit.md).

---

## Logs

| What | Where today | Pilot RC guidance |
| --- | --- | --- |
| Desktop config | `%AppData%\Microdent\config.json` | Always here after first save |
| Bridge stdout/stderr | Console where desktop was launched | Capture manually if IT requires archives |
| Operator log folder | **Not auto-created** | Create `%AppData%\Microdent\logs\` or another folder **outside install** if you need file logs |
| Staged `logs/` in package | Placeholder only | Empty at handoff — see `PLACEHOLDERS.md` in staged tree |

Future installer may standardize on `%AppData%\Microdent\logs\`. Until then, treat log paths as **operator-created**, not bundled.

Logging safety: [phase-8-log-redaction-review.md](./phase-8-log-redaction-review.md).

---

## QA reports and pilot feedback

| Audience | Location | Use |
| --- | --- | --- |
| **Developers / CI** | Repo `qa-runs/` | Checkpoint logs, batch reports, field-test notes — **dev-only**, not shipped |
| **Operators / IT** | Support ticket or internal tracker | Use [PILOT-START-HERE.md § Issue report template](./PILOT-START-HERE.md#issue-report-template-no-phi) |

**Do not** copy `qa-runs/` to clinic machines or attach DBF/sqlite/config with real paths to public tickets.

Operator validation commands (no sandbox env): `pnpm pilot-checkpoint`. Full gate: [PILOT-START-HERE.md § Validation commands](./PILOT-START-HERE.md#validation-commands).

---

## UNC network paths

Setup accepts `\\server\share\…` with an inline warning. Network shares can be slow, lock SQLite during import, or fail antivirus scans.

- **Warn only** — valid clinic setups may use UNC; prefer local drive letters when IT allows.
- Document share latency in pilot feedback if mirror import or bridge health is flaky.

---

## Permissions and antivirus

- Run desktop and bridge with write access to **sandbox DATA_ROOT** and **BACKUP_DIR** only.
- Exclude heavy scanning on mirror SQLite during import if IT policy allows (file locking).
- **SmartScreen** may warn on unsigned Electron — expected until code signing ([windows-pilot-pre-installer-checklist.md](./windows-pilot-pre-installer-checklist.md)).

---

## macOS / Linux (developers only)

| OS | Config dir |
| --- | --- |
| macOS | `~/Library/Application Support/Microdent/config.json` |
| Linux | `~/.config/microdent/config.json` |

Dev sandbox paths (e.g. `/Users/…/Microdent-Write-Sandbox/DATA`) are **not** Windows pilot examples.

---

## Quick checklist (IT handoff)

- [ ] Install/staged tree verified — `pnpm pilot:verify-release` (no clinic data in package)
- [ ] `%AppData%\Microdent\config.json` exists after first-run setup
- [ ] DATA_ROOT, SQLITE_PATH, BACKUP_DIR are **outside** install folder
- [ ] Mirror import completed — Settings shows mirror status
- [ ] No `qa-runs/` or repo clone required on clinic desktop for daily use

Acceptance flows: [pilot-acceptance-checklist.md](./pilot-acceptance-checklist.md).

---

## Related

| Doc | Use when |
| --- | --- |
| [PILOT-START-HERE.md](./PILOT-START-HERE.md) | One-page operator index |
| [apps/desktop/README.md](../apps/desktop/README.md) | Desktop shell, config, release-smoke |
| [windows-pilot-release-layout.md](./windows-pilot-release-layout.md) | Staged package layout |
| [pilot-acceptance-checklist.md](./pilot-acceptance-checklist.md) | IT sign-off |
| [phase-4-mirror-import-operator.md](./phase-4-mirror-import-operator.md) | Mirror import CLI |
| [pilot-backup-restore-audit.md](./pilot-backup-restore-audit.md) | Backup/restore after writes |

Canonical location categories (tests/docs): `apps/desktop/src/operator-data-locations.ts`.
