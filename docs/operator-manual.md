# Microdent Modern operator manual

**Purpose:** Day-to-day guide for pilot operators using the staged Windows `MicrodentModern/` package.

**Audience:** Clinic operators, IT, and support staff.

**Related:** [PILOT-START-HERE.md](./PILOT-START-HERE.md), [PILOT-HANDOFF-PACK.md](./PILOT-HANDOFF-PACK.md), [data-privacy-review.md](./data-privacy-review.md), [windows-pilot-troubleshooting-pack.md](./windows-pilot-troubleshooting-pack.md)

---

## Current pilot status

Microdent Modern is a **portable Windows pilot package**. It is not a signed installer, not an auto-updating production product, and not cleared for clinic go-live until package verification evidence is filed, real Windows field evidence references that package proof through `packageVerification.evidencePath`, and the run is signed off.

| Area | Current operator expectation |
| --- | --- |
| Install | IT extracts the staged `MicrodentModern/` folder |
| First run | Desktop setup chooses copied clinic files and prepares the fast local copy |
| Daily use | Today, Patients, Schedule, and Settings |
| Writes | Disabled by default; sandbox write pilot only when IT approves a disposable copy |
| Support | Export PHI-safe logs from Settings when requested |
| Privacy | Do not include patient data in support tickets |

---

## First-run setup

1. Open the staged `MicrodentModern/` package from the location chosen by IT.
2. Launch the desktop app from the package instructions.
3. When setup opens, choose the **copied clinic data folder**.
4. Confirm the derived **local copy** and **backup** locations are outside the install folder.
5. Save setup and let the app prepare the local copy.
6. Open **Settings** and confirm the clinic service and local copy status.

Use only a copied clinic folder. Never choose the live legacy production folder for pilot writes.

---

## Today

Use **Today** to review the daily clinic flow from the fast local copy.

| Task | Operator action |
| --- | --- |
| Review the day | Open **Today** and scan appointment status |
| Check readiness | Use the readiness strip for clinic service and local copy state |
| Recover from stale data | Open **Settings** and select **Refresh local copy** |
| Report a problem | Include the screen name and support log export; do not include patient names |

Today is read-oriented in this pilot. If copied clinic files changed outside Microdent Modern, refresh the local copy before relying on search or schedule readback.

---

## Patients

Use **Patients** to search and open patient records with privacy-shaped views.

| Task | Operator action |
| --- | --- |
| Search | Enter a chart number or name fragment |
| Open a profile | Select the matching row |
| Review safe sections | Use the visible tabs for read-only clinical context |
| Avoid free text | Do not copy patient notes, phone numbers, or record text into support tickets |

The app intentionally hides or summarizes high-risk free-text fields where the pilot contract requires it.

---

## Schedule

Use **Schedule** to review appointments by date or week.

| Task | Operator action |
| --- | --- |
| Move through dates | Use the date navigation controls |
| Confirm read-only mode | Watch for read-only or sandbox pilot banners |
| After sandbox writes | Refresh local copy if schedule/search must reflect copied files |
| Report schedule issues | Include date, screen, and operation id when shown; no patient identifiers |

Schedule reads come from the local copy when available. Copied clinic files remain the source of truth.

---

## Settings

Use **Settings** as the operator control center.

| Setting area | Use |
| --- | --- |
| Pilot readiness | Check clinic service, local copy, sandbox, and packaging status |
| Clinic service | Restart service, check service port, and view safe port policy |
| Local copy & import | Refresh status or run **Refresh local copy** |
| Support logs | Preview and export sanitized support logs |
| Diagnostics | Review support-safe runtime and crash metadata |
| Setup | Reopen setup when clinic paths need correction |

Settings is the preferred path. CLI commands are support fallback only.

---

## Local-copy refresh

The local copy makes search and schedule fast. It is a snapshot derived from copied clinic files.

| When | Action |
| --- | --- |
| First run | Setup prepares the local copy automatically |
| Settings says stale, empty, partial, or failed | Select **Refresh local copy** |
| Copied clinic files changed outside the app | Select **Refresh local copy** |
| Sandbox write just completed | Refresh before relying on search or schedule readback |
| Refresh fails repeatedly | Export support logs and ask IT to verify copied files are present and readable |

Do not move the local-copy SQLite file into the install folder.

---

## Support logs

Use **Settings → Support logs** when support asks for diagnostics.

| Safe to include | Do not include |
| --- | --- |
| Support log export from Settings | DBF files |
| Operation id shown by write feedback | SQLite local-copy file |
| Readiness status | Patient names, phones, notes, or screenshots with patient context |
| Build/package version | Full local paths in public tickets |

Support tickets must stay PHI-safe. Describe symptoms by screen and status, not by patient details.

---

## Safe port policy

Microdent Modern uses a local clinic service port, normally `17890`.

| Scenario | Operator action |
| --- | --- |
| Service is offline | Use **Restart clinic service** |
| Port looks busy | Use **Check service port** |
| Another process owns the port | Ask IT; Microdent Modern must not close unknown processes |
| App runs on a backup port | Continue if Settings shows connected |

Port cleanup is intentionally conservative. IT owns external process cleanup.

---

## Read-only mode

Read-only mode is the default and safest operating state.

| In read-only mode | Not allowed |
| --- | --- |
| Today review | Production writes |
| Patient search and safe profile views | Payments, ledger, chart, medical summary, or memo writes |
| Schedule review | Editing live legacy data |
| Settings diagnostics | Turning on write mode without sandbox approval |

If a write control appears, stop and confirm that the sandbox pilot is intentionally enabled.

---

## Sandbox editing

Sandbox editing is optional and only for a disposable copied data folder.

| Requirement | Expected state |
| --- | --- |
| Copied data | Disposable Write-Sandbox only |
| Backup folder | Configured before first commit |
| Write mode | Explicitly enabled by IT/operator |
| Scope | Supported pilot workflows only |
| Evidence | Capture operation id and safe audit status |
| Recovery | Use backup/restore guide on sandbox data only |

Never enable sandbox editing against live Microdent-Legacy data.

---

## Troubleshooting

| Symptom | First action |
| --- | --- |
| Clinic service offline | Settings → **Restart clinic service** |
| Local copy unavailable | Settings → **Refresh local copy** |
| Copied clinic folder invalid | Reopen setup and choose a valid copied folder |
| Backup folder missing | Reopen setup or ask IT to create a writable backup folder |
| Writes blocked | Confirm sandbox marker, write mode, backup folder, and operator approval |
| Support log export failed | Ask IT to check `%AppData%\Microdent\` permissions |
| Port conflict | Settings → **Check service port**; ask IT before stopping external processes |
| Permission or antivirus lock | Ask IT to review folder ACLs and endpoint exclusions |
| SmartScreen warning | Expected while code signing is deferred |

Full troubleshooting: [windows-pilot-troubleshooting-pack.md](./windows-pilot-troubleshooting-pack.md).

---

## PHI-safe support rule

Do not include PHI in support tickets, issue comments, screenshots, chat, email, or copied logs. That includes patient names, phone numbers, addresses, notes, appointment comments, DBF files, SQLite files, and screenshots where patient information is visible.

When in doubt, export support logs from Settings and use [pilot-issue-template.md](./pilot-issue-template.md).
