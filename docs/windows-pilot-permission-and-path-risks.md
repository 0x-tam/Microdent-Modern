# Windows pilot permission and path risks

**Purpose:** Windows-specific file, path, and permission risks for IT and field testers — before and during the pilot.

**Audience:** IT handing off staged `MicrodentModern/`, operators running the field script, support triaging EPERM / path / SmartScreen issues.

**Related:** [windows-pilot-data-locations.md](./windows-pilot-data-locations.md) · [windows-pilot-troubleshooting-pack.md](./windows-pilot-troubleshooting-pack.md) · [windows-pilot-field-execution-script.md](./windows-pilot-field-execution-script.md) · [pilot-issue-template.md](./pilot-issue-template.md)

**Safety:** Use sandbox paths only in examples. Never point DATA_ROOT at live Microdent-Legacy.

---

## Quick risk index

| Risk | Symptom | Jump to |
| --- | --- | --- |
| Wrong drive or path class | Setup rejects path; bridge cannot read DATA | [§ Drive letters and local paths](#drive-letters-and-local-paths) |
| Spaces in path | CLI or import fails; quoted path needed | [§ Paths with spaces](#paths-with-spaces) |
| UNC / network share | Slow mirror, SQLite locks, flaky health | [§ UNC network paths](#unc-network-paths) |
| Antivirus file locks | Import or restore hangs; EPERM mid-write | [§ Antivirus and file locks](#antivirus-and-file-locks) |
| ACL / folder permissions | EPERM on backup or DATA_ROOT | [§ ACLs and folder writability](#acls-and-folder-writability) |
| SmartScreen / unsigned app | Extra warning on first launch | [§ SmartScreen and code signing](#smartscreen-and-code-signing) |
| Admin vs standard user | Writes fail for one profile only | [§ Admin vs standard user](#admin-vs-standard-user) |
| `%AppData%` config | Config missing or wrong user context | [§ AppData config location](#appdata-config-location) |
| Backup folder not writable | Sandbox commit blocked | [§ Backup folder writability](#backup-folder-writability) |
| SQLite on network drive | Corruption risk, import timeouts | [§ SQLite on network drives](#sqlite-on-network-drives) |

---

## Drive letters and local paths

| Rule | Detail |
| --- | --- |
| **Prefer local fixed drives** | `C:\` or `D:\` on the clinic PC — not removable USB unless IT standardizes it |
| **Absolute paths only** | Setup and `config.json` require full paths — no relative `.\DATA` |
| **Layer separation** | Install (`C:\Microdent\MicrodentModern\`), config (`%AppData%`), clinic data (`C:\ClinicData\…`) must stay in **different** folders |
| **Do not use `%TEMP%` alone** | Extract package to a stable folder; temp-only extract can confuse AV and path persistence |

**Example (sandbox):**

```text
Install:     C:\Microdent\MicrodentModern\
DATA_ROOT:   C:\ClinicData\Microdent\DATA
SQLITE_PATH: C:\Users\Public\MicrodentModern\mirror\clinic.sqlite
BACKUP_DIR:  C:\Users\Public\MicrodentModern\backups
```

If IT remaps drive letters (e.g. `D:` → `E:` after imaging), update `%AppData%\Microdent\config.json` and restart the desktop.

---

## Paths with spaces

Windows allows spaces in folder names. The app accepts them when paths are **absolute** and quoted in shells.

| Context | Guidance |
| --- | --- |
| **Setup UI** | Type or browse to the folder — spaces are OK |
| **PowerShell / CMD** | Quote paths: `"C:\ClinicData\My Sandbox\DATA"` |
| **Mirror import CLI** | Same quoting rules — see [phase-4-mirror-import-operator.md](./phase-4-mirror-import-operator.md) |
| **Tickets** | Describe as “spaced sandbox DATA_ROOT” — do not paste full production UNC with spaces |

Spaced paths are a common pilot test class ([windows-pilot-real-machine-checklist.md](./windows-pilot-real-machine-checklist.md)); verify mirror import and backup on the same path class you use in production-like sandboxes.

---

## UNC network paths

Setup may accept `\\fileserver\share\…` with an **inline warning**. Valid clinic layouts sometimes use shares; the pilot still prefers local disks when IT allows.

| Risk | Why it matters |
| --- | --- |
| **Latency** | Mirror import and bridge health can time out on slow shares |
| **File locking** | SMB brief locks during DBF read/write or SQLite open |
| **Offline share** | Bridge or import fails if VPN drops or share is unavailable |
| **Antivirus on server** | Server-side scan can delay large sqlite copies |

**Operator guidance:**

- Prefer `C:\…` or `D:\…` for **SQLITE_PATH** and **DATA_ROOT** during field test when possible.
- If UNC is required, document share latency and mirror status in the [field result form](./windows-pilot-field-result-form.md) — category only in public tickets (“UNC DATA_ROOT”).
- Do not attach share names or credentials in issue reports — [pilot-issue-template.md](./pilot-issue-template.md).

More layout context: [windows-pilot-data-locations.md § UNC network paths](./windows-pilot-data-locations.md#unc-network-paths).

---

## Antivirus and file locks

Endpoint protection can hold handles on `.dbf`, `.sqlite`, or fresh backup folders during import, commit, or restore.

| Mitigation | Owner |
| --- | --- |
| Exclude sandbox **DATA_ROOT**, **BACKUP_DIR**, and mirror folder from real-time scan **during pilot window** (if policy allows) | IT |
| Pause heavy scan during mirror import and restore | Operator + IT |
| Close extra apps that open sandbox DBF (legacy tools, sync clients) | Operator |
| Retry after 30s if EPERM is intermittent | Operator |

Symptoms map to [windows-pilot-troubleshooting-pack.md § Permission denied / EPERM on backups](./windows-pilot-troubleshooting-pack.md#permission-denied--eperm-on-backups) and [§ Restore failed](./windows-pilot-troubleshooting-pack.md#restore-failed).

---

## ACLs and folder writability

The desktop user needs **read** access to install and bridge JS, **read/write** on sandbox DATA_ROOT and BACKUP_DIR, and **read/write** on the folder containing SQLITE_PATH (create file if missing).

| Folder | Typical ACL need |
| --- | --- |
| `C:\Microdent\MicrodentModern\` | Read + execute for standard user |
| `%AppData%\Microdent\` | Read/write for launching user |
| Sandbox DATA_ROOT | Modify (create/change/delete DBF) |
| BACKUP_DIR | Modify (create backup subfolders) |
| Mirror directory | Modify (create/replace `clinic.sqlite`) |

**IT checks (PowerShell, sandbox paths only):**

```powershell
# Replace with your sandbox paths
Test-Path "C:\ClinicData\Microdent\DATA"
New-Item -ItemType File -Path "C:\Users\Public\MicrodentModern\backups\_writetest.tmp" -Force
Remove-Item "C:\Users\Public\MicrodentModern\backups\_writetest.tmp"
```

If `New-Item` fails with **Access denied**, fix ACLs or choose a folder the operator owns before running the field script.

---

## SmartScreen and code signing

Pilot packages are **unsigned Electron** builds unless IT adds their own signing. Windows SmartScreen may show “Windows protected your PC” or an unknown publisher warning.

| Step | Action |
| --- | --- |
| 1 | IT documents expected SmartScreen flow for clinic staff |
| 2 | Operator uses **More info → Run anyway** only on IT-approved extract path |
| 3 | Do not disable SmartScreen globally — use org-approved exception process |
| 4 | File **Minor** or **Question** severity if UX is confusing but app runs |

Reference: [windows-pilot-pre-installer-checklist.md](./windows-pilot-pre-installer-checklist.md) · troubleshooting [§ SmartScreen / AV](./windows-pilot-troubleshooting-pack.md#smartscreen--antivirus).

---

## Admin vs standard user

| Profile | Expected |
| --- | --- |
| **Standard user (preferred)** | Daily operator launch, setup save, sandbox writes, backups |
| **Administrator** | Not required for normal pilot — avoid “Run as administrator” unless IT policy mandates it for `%AppData%` or install location |
| **Roaming profile** | `%AppData%\Microdent\config.json` follows user — confirm same user runs setup and daily launch |

**Risk:** Running as admin while DATA_ROOT is on a standard-user-only folder (or vice versa) causes EPERM or split config. Use one Windows profile for the whole field script.

---

## AppData config location

Desktop stores pointers in **`%AppData%\Microdent\config.json`** (per-user, not in the install tree).

| Topic | Detail |
| --- | --- |
| **Open folder** | Win+R → `%AppData%\Microdent` |
| **First-run** | Created when setup saves — missing file means setup not completed |
| **Multi-user PC** | Each Windows user has separate config — do not assume another user’s paths |
| **Tickets** | Never attach full config publicly — note path **class** only ([pilot-issue-template.md](./pilot-issue-template.md)) |

Logs convention (optional, not auto-created): `%AppData%\Microdent\logs\` — see [windows-pilot-data-locations.md § Layer 2](./windows-pilot-data-locations.md#layer-2--appdatamicrodent).

---

## Backup folder writability

`BACKUP_DIR` must exist and be writable **before** sandbox commits. The app blocks commits when backup path is missing or read-only.

| Check | Pass criteria |
| --- | --- |
| Folder created ahead of setup | IT or operator creates empty folder outside install |
| Write test | Operator or IT can create/delete a small file in folder |
| Not inside install tree | Backups under `C:\Microdent\MicrodentModern\` are **wrong layer** |
| EPERM during commit | See troubleshooting pack — AV, ACL, or wrong user |

Execution script: configure BACKUP_DIR in setup before optional sandbox write steps ([windows-pilot-field-execution-script.md](./windows-pilot-field-execution-script.md)).

---

## SQLite on network drives

**Strong warning:** placing **SQLITE_PATH** on a UNC share or mapped network drive increases corruption risk and import failures. SQLite expects stable local filesystem semantics.

| Recommendation | Detail |
| --- | --- |
| **Best** | Local disk for mirror file — e.g. `C:\Users\Public\MicrodentModern\mirror\clinic.sqlite` |
| **Acceptable with caution** | Fast LAN share with IT exclusion and stable VPN — expect warn-only pilot feedback |
| **Avoid** | SQLite on high-latency WAN, read-only shares, or sync folders (OneDrive/Dropbox) |

DBF (DATA_ROOT) on UNC is sometimes required by clinic policy; still prefer local mirror when possible. Document mirror **status category** (stale / partial / failed / OK) in field results — not raw SQL errors.

---

## Pre-field checklist (IT)

- [ ] Install extract path is stable local drive — not temp-only
- [ ] Sandbox DATA_ROOT, BACKUP_DIR, mirror folder ACLs verified for operator account
- [ ] SmartScreen / AV exception process documented
- [ ] Operator runs as same standard user for setup + field script
- [ ] UNC and spaced-path classes tested if production-like sandbox uses them
- [ ] SQLite mirror on local disk unless IT accepts network-drive risk

---

## Related docs

| Doc | Use when |
| --- | --- |
| [windows-pilot-data-locations.md](./windows-pilot-data-locations.md) | Three-layer path model |
| [windows-pilot-troubleshooting-pack.md](./windows-pilot-troubleshooting-pack.md) | EPERM, SmartScreen, DATA_ROOT rejected |
| [windows-pilot-field-execution-script.md](./windows-pilot-field-execution-script.md) | Setup and sandbox write order |
| [pilot-issue-template.md](./pilot-issue-template.md) | Filing defects with path class only |
| [windows-pilot-pre-installer-checklist.md](./windows-pilot-pre-installer-checklist.md) | Signing and IT pre-flight |
| [phase-4-mirror-import-operator.md](./phase-4-mirror-import-operator.md) | Mirror import with quoted paths |
