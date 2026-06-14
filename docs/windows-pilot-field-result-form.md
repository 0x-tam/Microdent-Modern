# Windows pilot — field result form (no PHI)

**Purpose:** Capture pass/fail for a real Windows field run. This is **not** a defect report — use [pilot-issue-template.md](./pilot-issue-template.md) for individual issues.

**How:** Fill during or after [windows-pilot-field-execution-script.md](./windows-pilot-field-execution-script.md). File a copy under `qa-runs/` from [TEMPLATE-windows-field-run.md](../qa-runs/TEMPLATE-windows-field-run.md), confirm package verification evidence from [TEMPLATE-windows-package-verify-evidence.json](../qa-runs/TEMPLATE-windows-package-verify-evidence.json), then create the machine-readable field JSON from [TEMPLATE-windows-field-evidence.json](../qa-runs/TEMPLATE-windows-field-evidence.json).

**Examples:** Fictional machine ids and sandbox paths only. **Do not** paste patient names, chart numbers, phones, DBF contents, or full `config.json`.

> **Windows operator return:** If you used `DOUBLE-CLICK-WINDOWS-TEST.cmd`, send back only `MicrodentModern-safe-results.zip`. Engineering/IT converts that safe bundle into repo `qa-runs` evidence. If the zip was not created, send only `WINDOWS-SMOKE-REPORT.txt` and the three generated `.json` files from the same folder. Do not send DBF, SQLite, config, logs, screenshots, or the copied DATA folder.

---

## Run metadata

| Field | Record here (synthetic OK) |
| --- | --- |
| **Date** | e.g. `2026-05-21` |
| **Tester name / role** | e.g. `Alex Chen — pilot operator` |
| **Machine label** | e.g. `CLINIC-PC-01` |
| **Windows version** | e.g. `Windows 11 23H2` (Settings → System → About) |
| **Machine type** | e.g. `Desktop — standard clinic PC` / `Laptop — roaming` |
| **Operator profile** | e.g. `CONTOSO\pilot.operator` (no patient context) |
| **Node on PATH** | `node -v` → e.g. `v22.11.0` |
| **Package extract path** | e.g. `C:\Microdent\MicrodentModern\` |
| **Package verification evidence** | e.g. `qa-runs/YYYY-MM-DD-windows-package-verify-evidence-CLINIC-PC-01.json` |

---

## Build identity (from manifest or Settings)

Copy from `C:\Microdent\MicrodentModern\RELEASE-MANIFEST.json` or **Settings → Pilot build** card.

| Field | Value |
| --- | --- |
| **packageVersion** | e.g. `pilot-2026-05-20` |
| **appVersion** | e.g. `0.1.0-pilot` |
| **gitCommit** | e.g. `d3a8565` (short hash OK) |
| **releaseChannel** | e.g. `pilot` |
| **unsupportedFeatures reviewed** | ☐ Yes — no in-app promises for listed items |

---

## Sandbox path declaration (required)

Confirm **disposable** sandbox only — not live legacy.

| Path | Synthetic example | Verified outside install folder? |
| --- | --- | --- |
| **DATA_ROOT** | `C:\ClinicData\PilotSandbox\DATA` | ☐ |
| **SQLITE_PATH** | `C:\Users\Public\MicrodentModern\mirror\clinic.sqlite` | ☐ |
| **BACKUP_DIR** | `C:\Users\Public\MicrodentModern\backups` | ☐ |
| **Config location** | `%AppData%\Microdent\config.json` | ☐ |

| Class tested | ☐ Local drive ☐ Spaced path ☐ UNC (warn-only) |
| --- | --- |

---

## Per-step results (matches execution script)

Mark **Pass**, **Fail**, or **N/A**. Link checklist row when Fail.

| Script step | Title | Pass | Fail | N/A | Checklist row | Notes (no PHI) |
| --- | --- | --- | --- | --- | --- | --- |
| EXEC-01 | Receive handoff zip | ☐ | ☐ | ☐ | 1.2 | |
| EXEC-02 | Extract to `C:\Microdent\MicrodentModern\` | ☐ | ☐ | ☐ | 1.2, 10.1 | |
| EXEC-03 | Read PILOT-START-HERE + handoff pack | ☐ | ☐ | ☐ | — | |
| EXEC-04 | Record build identity | ☐ | ☐ | ☐ | 1.2 | |
| EXEC-05 | Node 22 on PATH | ☐ | ☐ | ☐ | 1.3 | |
| EXEC-06 | Launch desktop | ☐ | ☐ | ☐ | 1.4 | |
| EXEC-07 | SmartScreen / AV | ☐ | ☐ | ☐ | 1.5, 1.6 | |
| EXEC-08 | First-run setup (sandbox paths) | ☐ | ☐ | ☐ | 2.2–2.5, 3.1–3.3 | |
| EXEC-09 | Bridge online in Settings | ☐ | ☐ | ☐ | 4.2 | |
| EXEC-10 | CLI mirror import | ☐ | ☐ | ☐ | 5.2–5.4 | |
| EXEC-11 | Read-only QA | ☐ | ☐ | ☐ | 6.2–6.5 | |
| EXEC-12 | Sandbox write QA (optional) | ☐ | ☐ | ☐ | 7.2–7.5 | |
| EXEC-13 | Backup verify + restore | ☐ | ☐ | ☐ | 8.2–8.3 | |
| EXEC-14 | Restart app / bridge | ☐ | ☐ | ☐ | 4.4, 4.5 | |
| EXEC-15 | Cold reboot (optional) | ☐ | ☐ | ☐ | 9.1–9.2 | |
| EXEC-16 | Results filed | ☐ | ☐ | ☐ | — | |

---

## Section summary (checklist matrix rollup)

Optional rollup for sponsors — maps to [windows-pilot-real-machine-checklist.md](./windows-pilot-real-machine-checklist.md) sections.

| Section | Requires Windows PC | Pass | Fail | N/A | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 Launch | 5 rows | ☐ | ☐ | ☐ | |
| 2 Paths / UNC | 6 rows | ☐ | ☐ | ☐ | |
| 3 Permissions | 5 rows | ☐ | ☐ | ☐ | |
| 4 Bridge | 5 rows | ☐ | ☐ | ☐ | |
| 5 Mirror | 3 rows | ☐ | ☐ | ☐ | |
| 6 Read-only | 4 rows | ☐ | ☐ | ☐ | |
| 7 Sandbox | 4 rows | ☐ | ☐ | ☐ | |
| 8 Backup / restore | 3 rows | ☐ | ☐ | ☐ | |
| 9 Reboot | 4 rows | ☐ | ☐ | ☐ | |
| 10 Locations | 4 rows | ☐ | ☐ | ☐ | |

---

## Issues found (summary only — no PHI)

| # | Script step | Severity | One-line symptom | Issue ticket id |
| --- | --- | --- | --- | --- |
| 1 | e.g. EXEC-09 | Major | Bridge offline after 90s | PILOT-2026-001 |
| 2 | | | | |

Full detail: copy [pilot-issue-template.md](./pilot-issue-template.md) per issue. Link troubleshooting: [windows-pilot-troubleshooting-pack.md](./windows-pilot-troubleshooting-pack.md).

---

## Screenshot policy

| Allowed | Not allowed |
| --- | --- |
| Settings Pilot build card (crop) | Patient list rows with names |
| Bridge status / write mode indicators | Schedule with identifiable patients |
| SmartScreen prompt (no clinic data behind) | Full-screen Today with real charts |
| Error dialog **without** patient context | Profile tabs showing demographics |

**Rule:** Crop to the smallest UI region that proves the symptom. Blur or omit if unsure.

---

## Log and diagnostic redaction policy

| Safe to note in this form | Do not attach to shared tickets |
| --- | --- |
| `packageVersion`, `node -v`, fictional `CLINIC-PC-01` | Full `%AppData%\Microdent\config.json` |
| Checklist row id (e.g. `4.2`) | DBF or sqlite files |
| `operationId` from write feedback (sandbox) | Bridge stdout with `PAT_NAME` or paths to legacy |
| Import outcome category: `success` / `partial` / `failed` | Raw mirror CLI tables with row payloads |

**Log locations (reference only):** `%AppData%\Microdent\` — see [PILOT-START-HERE.md](./PILOT-START-HERE.md). Export logs only through IT redaction workflow.

---

## Pilot decision (operator + IT)

| Question | Answer |
| --- | --- |
| All **required** EXEC steps pass? | ☐ Yes ☐ No |
| PHI observed in UI/logs/screenshots? | ☐ No ☐ Yes — stop and escalate |
| Unsupported writes attempted on live legacy? | ☐ No ☐ Yes — **NO-GO** |
| Ready for limited sandbox pilot continuation? | ☐ GO ☐ NO-GO ☐ Read-only only |

**Sponsor sign-off:** _________________________ Date: __________

Formal go/no-go table (when available): [windows-pilot-go-no-go-checklist.md](./windows-pilot-go-no-go-checklist.md).

---

## Filing instructions

1. Save completed form as `qa-runs/YYYY-MM-DD-windows-field-log-<MACHINE>.md` (fictional machine id).
2. Start from [TEMPLATE-windows-field-run.md](../qa-runs/TEMPLATE-windows-field-run.md).
3. Create `qa-runs/YYYY-MM-DD-windows-package-verify-evidence-<MACHINE>.json` from [TEMPLATE-windows-package-verify-evidence.json](../qa-runs/TEMPLATE-windows-package-verify-evidence.json) if IT has not already filed it.
4. Validate package verification evidence with `pnpm pilot:package-verify-evidence -- qa-runs/YYYY-MM-DD-windows-package-verify-evidence-<MACHINE>.json`.
5. Create `qa-runs/YYYY-MM-DD-windows-field-evidence-<MACHINE>.json` from [TEMPLATE-windows-field-evidence.json](../qa-runs/TEMPLATE-windows-field-evidence.json), with `packageVerification.evidencePath` pointing to the validated package evidence file and `packageVerification.verifiedBeforeFieldRun` set to `true`.
6. Create `qa-runs/YYYY-MM-DD-evidence-attachment-manifest-<MACHINE>.json` from [TEMPLATE-evidence-attachment-manifest.json](../qa-runs/TEMPLATE-evidence-attachment-manifest.json) after redacting and hashing screenshots/signoff outputs.
7. Validate the manifest with `pnpm pilot:attachment-manifest -- qa-runs/YYYY-MM-DD-evidence-attachment-manifest-<MACHINE>.json`.
8. Validate field evidence with `pnpm pilot:field-evidence -- qa-runs/YYYY-MM-DD-windows-field-evidence-<MACHINE>.json`.
9. Keep **one** PHI-safe statement at top: *No real patient data in this file.*

---

## Related docs

| Doc | Role |
| --- | --- |
| [windows-pilot-field-execution-script.md](./windows-pilot-field-execution-script.md) | Linear steps |
| [windows-pilot-real-machine-checklist.md](./windows-pilot-real-machine-checklist.md) | Full matrix |
| [evidence-attachment-manifest.md](./evidence-attachment-manifest.md) | Redacted attachment metadata and hash manifest |
| [pilot-issue-template.md](./pilot-issue-template.md) | Defect intake |
| [PILOT-HANDOFF-PACK.md](./PILOT-HANDOFF-PACK.md) | Handoff index |
