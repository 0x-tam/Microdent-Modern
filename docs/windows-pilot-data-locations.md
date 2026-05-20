# Windows pilot data locations

**Purpose:** Where install files, config, clinic DATA, mirror, backups, and logs live on a Windows pilot machine.

**Baseline:** Microdent-Modern `main` @ `1b67d2b`

---

## Three layers (do not mix)

| Layer | Typical location | Contains |
| --- | --- | --- |
| **App install / staged package** | `C:\Microdent\MicrodentModern\` or extracted `dist/pilot-release` | Electron shell, bridge JS, web dist — **no clinic DBF or sqlite** |
| **Desktop config** | `%AppData%\Microdent\config.json` | Operator paths: `dataRoot`, `sqlitePath`, `backupDir`, `writeMode`, `bridgePort` |
| **Clinic data (operator)** | Paths **you** choose in setup | Sandbox DATA_ROOT, mirror file, backup folder |

Open config folder: Win+R → `%AppData%\Microdent`

---

## Operator paths (from setup)

| Setting | Role | Windows example (sandbox) |
| --- | --- | --- |
| **DATA_ROOT** | Disposable Write-Sandbox DBF tree | `C:\ClinicData\Microdent\DATA` |
| **SQLITE_PATH** | Mirror for search/schedule | `C:\Users\Public\MicrodentModern\mirror\clinic.sqlite` |
| **BACKUP_DIR** | Required before sandbox commits | `C:\Users\Public\MicrodentModern\backups` |

**Never** point DATA_ROOT at live `Microdent-Legacy`. **Never** put mirror or backups inside the app install folder.

---

## Logs

| What | Where today |
| --- | --- |
| Desktop config | `%AppData%\Microdent\config.json` |
| Bridge stdout/stderr | Console where desktop was launched (no PHI in scripted logs) |
| Optional operator `logs/` | Create outside install — not shipped in pilot package |

Future installer may define `%AppData%\Microdent\logs\` — pilot RC documents operator-created folders only.

---

## Permissions and antivirus

- Run desktop and bridge with write access to **sandbox DATA_ROOT** and **BACKUP_DIR** only.
- Exclude heavy scanning on mirror SQLite during import if IT policy allows (file locking).
- **SmartScreen** may warn on unsigned Electron — expected until code signing (see pre-installer checklist).

---

## macOS / Linux (developers only)

| OS | Config dir |
| --- | --- |
| macOS | `~/Library/Application Support/Microdent/config.json` |
| Linux | `~/.config/microdent/config.json` |

Dev sandbox paths (e.g. `/Users/.../Microdent-Write-Sandbox/DATA`) are **not** Windows pilot examples.

---

## Related

- [PILOT-START-HERE.md](./PILOT-START-HERE.md)
- [windows-pilot-release-layout.md](./windows-pilot-release-layout.md)
- [pilot-acceptance-checklist.md](./pilot-acceptance-checklist.md)
- [apps/desktop/README.md](../apps/desktop/README.md)
