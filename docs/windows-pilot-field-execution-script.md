# Windows pilot — field execution script

**Purpose:** Linear **day-0** steps for a clinic Windows tester. Follow top to bottom; use the checklist matrix only when you need row-level detail.

**Companion docs:**

| Doc | Role |
| --- | --- |
| [windows-pilot-real-machine-checklist.md](./windows-pilot-real-machine-checklist.md) | **Matrix** — every check with dev vs Windows markers |
| [windows-pilot-field-result-form.md](./windows-pilot-field-result-form.md) | **Results** — PHI-safe pass/fail capture after the run |
| [windows-pilot-troubleshooting-pack.md](./windows-pilot-troubleshooting-pack.md) | **Failures** — operator actions per symptom (when staged) |
| [PILOT-HANDOFF-PACK.md](./PILOT-HANDOFF-PACK.md) | Staged-package journey index |

**Examples:** Synthetic paths and machine names only (`CLINIC-PC-01`, `C:\ClinicData\PilotSandbox\DATA`). **Never** point `DATA_ROOT` at live **Microdent-Legacy**. Sandbox DATA must be disposable.

**Fail handling:** If a step fails, stop that branch, note the script step ID, then open [PILOT-START-HERE.md § Troubleshooting](./PILOT-START-HERE.md#troubleshooting) or [windows-pilot-troubleshooting-pack.md](./windows-pilot-troubleshooting-pack.md) before retrying.

---

## Before day 0 (IT)

| Item | Owner |
| --- | --- |
| Build machine ran `pnpm pilot:verify-release` before zip | IT / release |
| Zip contains `HANDOFF-README.txt`, `RELEASE-MANIFEST.json`, no clinic DBF/sqlite | IT |
| Tester has [windows-pilot-field-result-form.md](./windows-pilot-field-result-form.md) open (copy or print) | Operator |

---

## Day 0 — numbered execution flow

### EXEC-01 — Receive handoff zip

| | |
| --- | --- |
| **Action** | IT delivers `MicrodentModern.zip` (or folder copy). Record filename and handoff date. |
| **Pass criteria** | Zip opens; root contains `PILOT-START-HERE.md`, `RELEASE-MANIFEST.json`, `HANDOFF-README.txt`. |
| **Checklist** | [1.2](windows-pilot-real-machine-checklist.md#1--package-delivery-and-launch) (extract prep) |
| **Fail →** | Missing root files → IT re-runs build stage; see troubleshooting **blank UI / bad package**. |

---

### EXEC-02 — Extract to local fixed drive

| | |
| --- | --- |
| **Action** | Extract entire tree to `C:\Microdent\MicrodentModern\` (create folder if needed). **Do not** use `%TEMP%` or Downloads as the only long-term location. |
| **Pass criteria** | `C:\Microdent\MicrodentModern\PILOT-START-HERE.md` exists; `app\` and `docs\` present. |
| **Checklist** | [1.2](windows-pilot-real-machine-checklist.md#1--package-delivery-and-launch), [10.1](windows-pilot-real-machine-checklist.md#10--logs-config-and-backups-locations) |
| **Fail →** | Path too long / permission denied → [windows-pilot-data-locations.md](./windows-pilot-data-locations.md); troubleshooting **permission denied**. |

---

### EXEC-03 — Read package index

| | |
| --- | --- |
| **Action** | Open `C:\Microdent\MicrodentModern\PILOT-START-HERE.md`, then `docs\PILOT-HANDOFF-PACK.md`. |
| **Pass criteria** | Operator understands: portable folder (no installer), CLI mirror import, sandbox-only writes. |
| **Checklist** | Handoff journey (not a numbered row) |
| **Fail →** | Scope confusion → [PILOT-HANDOFF-PACK.md § What this package is / is not](./PILOT-HANDOFF-PACK.md#what-this-package-is--is-not). |

---

### EXEC-04 — Record build identity (PHI-safe)

| | |
| --- | --- |
| **Action** | Open `RELEASE-MANIFEST.json` at package root. Copy `packageVersion`, `appVersion`, `gitCommit`, `releaseChannel` into the result form. Optionally confirm **Settings → Pilot build** card matches. |
| **Pass criteria** | All four fields recorded on result form; `unsupportedFeatures` reviewed. |
| **Checklist** | [1.2](windows-pilot-real-machine-checklist.md#1--package-delivery-and-launch) (manifest) |
| **Fail →** | Missing manifest → IT must not start field test; rebuild on build machine. |

**Synthetic example:**

```json
"packageVersion": "pilot-2026-05-20",
"appVersion": "0.1.0-pilot",
"gitCommit": "d3a8565",
"releaseChannel": "pilot"
```

---

### EXEC-05 — Confirm Node 22 on PATH

| | |
| --- | --- |
| **Action** | PowerShell: `node -v` → expect `v22.x`. |
| **Pass criteria** | Node 22 prints without “not recognized”. |
| **Checklist** | [1.3](windows-pilot-real-machine-checklist.md#1--package-delivery-and-launch) |
| **Fail →** | Install Node 22 LTS; restart PowerShell; troubleshooting **bridge offline**. |

---

### EXEC-06 — Launch desktop

| | |
| --- | --- |
| **Action** | From `C:\Microdent\MicrodentModern\app\`, start desktop per `HANDOFF-README.txt` (Electron + system Node). |
| **Pass criteria** | Window opens; **Today** or setup screen visible — not a blank white panel. |
| **Checklist** | [1.4](windows-pilot-real-machine-checklist.md#1--package-delivery-and-launch) |
| **Fail →** | Blank UI → troubleshooting **app does not open / blank UI**. |

---

### EXEC-07 — SmartScreen and antivirus (first launch)

| | |
| --- | --- |
| **Action** | If SmartScreen blocks unsigned app: **More info → Run anyway** (IT documents). If bridge times out &gt; 60s, allowlist `node.exe` and app folder. |
| **Pass criteria** | App runs after IT-approved bypass; no perpetual block. |
| **Checklist** | [1.5](windows-pilot-real-machine-checklist.md#1--package-delivery-and-launch), [1.6](windows-pilot-real-machine-checklist.md#1--package-delivery-and-launch) |
| **Fail →** | Troubleshooting **SmartScreen / AV**. |

---

### EXEC-08 — First-run setup (sandbox paths only)

| | |
| --- | --- |
| **Action** | Complete setup with **disposable** paths only (examples below). Config saves to `%AppData%\Microdent\config.json`. |
| **Pass criteria** | Setup completes; Win+R → `%AppData%\Microdent` shows `config.json`; paths are absolute and **outside** install folder. |
| **Checklist** | [2.2](windows-pilot-real-machine-checklist.md#2--paths-drives-and-unc)–[2.5](windows-pilot-real-machine-checklist.md#2--paths-drives-and-unc), [3.1](windows-pilot-real-machine-checklist.md#3--permissions-and-profiles)–[3.3](windows-pilot-real-machine-checklist.md#3--permissions-and-profiles) |

| Setting | Synthetic example |
| --- | --- |
| **DATA_ROOT** | `C:\ClinicData\PilotSandbox\DATA` |
| **SQLITE_PATH** | `C:\Users\Public\MicrodentModern\mirror\clinic.sqlite` |
| **BACKUP_DIR** | `C:\Users\Public\MicrodentModern\backups` |

**Fail →** Invalid path / legacy segment → troubleshooting **DATA_ROOT invalid**; [windows-pilot-data-locations.md](./windows-pilot-data-locations.md). Path/ACL prep: [windows-pilot-permission-and-path-risks.md](./windows-pilot-permission-and-path-risks.md).

Optional stretch: spaced path `C:\Clinic Data\Pilot Sandbox\DATA` — checklist [2.3](windows-pilot-real-machine-checklist.md#2--paths-drives-and-unc).

---

### EXEC-09 — Bridge online in Settings

| | |
| --- | --- |
| **Action** | Open **Settings → Pilot readiness**. Confirm bridge connected on loopback. |
| **Pass criteria** | Readiness shows bridge online within ~2 minutes of launch. |
| **Checklist** | [4.2](windows-pilot-real-machine-checklist.md#4--bridge-lifecycle-and-networking) |
| **Fail →** | Troubleshooting **bridge offline**, **localhost / port 17890 blocked**. |

---

### EXEC-10 — CLI mirror import (PowerShell)

| | |
| --- | --- |
| **Action** | In PowerShell (same session), set env vars and run safe import per [phase-4-mirror-import-operator.md](./phase-4-mirror-import-operator.md). Staged package: see `scripts\mirror-import-pointer.txt` for repo vs CLI notes. |

```powershell
$env:DATA_ROOT = "C:\ClinicData\PilotSandbox\DATA"
$env:SQLITE_PATH = "C:\Users\Public\MicrodentModern\mirror\clinic.sqlite"
cd C:\Microdent\Microdent-Modern   # dev checkout with pnpm — or IT-provided CLI path
pnpm --filter @microdent/sqlite-mirror run import-safe
```

| | |
| --- | --- |
| **Pass criteria** | CLI `overall: success` or `partial` (partial = IT aware); Settings mirror table not “never imported” after **Refresh status**. |
| **Checklist** | [5.2](windows-pilot-real-machine-checklist.md#5--mirror-import)–[5.4](windows-pilot-real-machine-checklist.md#5--mirror-import) |
| **Fail →** | Troubleshooting **mirror import failed** (category only — do not paste raw CLI errors in public tickets). |

---

### EXEC-11 — Read-only QA (Settings + navigation)

| | |
| --- | --- |
| **Action** | Confirm `writeMode` disabled in Settings. Navigate **Today**, **Patients**, **Schedule**, **Profile** lede. Confirm unsupported routes show guardrail copy. |
| **Pass criteria** | All four areas load; no console errors; write panels hidden; guardrails visible on out-of-scope actions. |
| **Checklist** | [6.2](windows-pilot-real-machine-checklist.md#6--read-only-qa)–[6.5](windows-pilot-real-machine-checklist.md#6--read-only-qa) |
| **Fail →** | [phase-5-operator-qa-runbook.md](./phase-5-operator-qa-runbook.md); troubleshooting **blank UI**. |

Runbook: [phase-5-operator-qa-runbook.md](./phase-5-operator-qa-runbook.md).

---

### EXEC-12 — Optional: sandbox write QA (IT-approved only)

| | |
| --- | --- |
| **Action** | **Only** on disposable Write-Sandbox with IT present. Follow [phase-7-sandbox-pilot-qa-runbook.md](./phase-7-sandbox-pilot-qa-runbook.md): enable write mode, run **four** workflows (status, time move, create, demographics). Close FoxPro/Excel handles on sandbox DBF first. |
| **Pass criteria** | Each workflow shows `operationId` in feedback; `BACKUP_DIR` has artifacts before destructive steps; no patient names in feedback lines. |
| **Checklist** | [7.2](windows-pilot-real-machine-checklist.md#7--sandbox-write-qa)–[7.5](windows-pilot-real-machine-checklist.md#7--sandbox-write-qa) |
| **Fail →** | Troubleshooting **sandbox QA failed**; [out-of-scope-guardrails.md](./out-of-scope-guardrails.md). |

**Skip** this step if clinic pilot is read-only only — mark **N/A** on result form.

---

### EXEC-13 — Backup verify and restore (sandbox only)

| | |
| --- | --- |
| **Action** | After sandbox writes (or if testing restore path alone): verify backup CLI, restore sandbox DATA, re-run read-only smoke. Re-import mirror if search/schedule must match DBF. |
| **Pass criteria** | Restore returns sandbox to known state; read-only navigation still passes. |
| **Checklist** | [8.2](windows-pilot-real-machine-checklist.md#8--backup-restore-and-audit)–[8.3](windows-pilot-real-machine-checklist.md#8--backup-restore-and-audit) |
| **Fail →** | Troubleshooting **restore failed**, **permission denied / EPERM on backups**; [pilot-backup-restore-audit.md](./pilot-backup-restore-audit.md). |

---

### EXEC-14 — Restart app (bridge lifecycle)

| | |
| --- | --- |
| **Action** | Quit desktop completely; relaunch from `app\`. Optionally end stray `node.exe` in Task Manager once, then relaunch. |
| **Pass criteria** | Bridge online again; config paths unchanged in `%AppData%\Microdent\config.json`. |
| **Checklist** | [4.4](windows-pilot-real-machine-checklist.md#4--bridge-lifecycle-and-networking), [4.5](windows-pilot-real-machine-checklist.md#4--bridge-lifecycle-and-networking) |
| **Fail →** | Troubleshooting **bridge offline**. |

---

### EXEC-15 — Optional: cold reboot

| | |
| --- | --- |
| **Action** | Reboot `CLINIC-PC-01` (fictional). Launch app; confirm config paths survived. |
| **Pass criteria** | Desktop + bridge + UI within 2 minutes; `DATA_ROOT` still `C:\ClinicData\PilotSandbox\DATA` in config. |
| **Checklist** | [9.1](windows-pilot-real-machine-checklist.md#9--reboot-and-longevity)–[9.2](windows-pilot-real-machine-checklist.md#9--reboot-and-longevity) |
| **Fail →** | Roaming profile / path drift → checklist [3.5](windows-pilot-real-machine-checklist.md#3--permissions-and-profiles), [9.2](windows-pilot-real-machine-checklist.md#9--reboot-and-longevity). |

---

### EXEC-16 — Record results (required)

| | |
| --- | --- |
| **Action** | Fill [windows-pilot-field-result-form.md](./windows-pilot-field-result-form.md). Copy completed run to `qa-runs/` using [TEMPLATE-windows-field-run.md](../qa-runs/TEMPLATE-windows-field-run.md). |
| **Pass criteria** | Every EXEC step has Pass / Fail / N/A; build ids recorded; **no PHI** in attachment. |
| **Checklist** | [Field execution log](windows-pilot-real-machine-checklist.md#field-execution-log-synthetic-template) (superseded by result form for new runs) |
| **Defects** | [pilot-issue-template.md](./pilot-issue-template.md) per failure |

---

## Quick reference — script step ↔ checklist section

| Script | Topic | Checklist section |
| --- | --- | --- |
| EXEC-01–07 | Package / launch | §1 |
| EXEC-08 | Paths / setup | §2, §3 |
| EXEC-09 | Bridge | §4 |
| EXEC-10 | Mirror | §5 |
| EXEC-11 | Read-only | §6 |
| EXEC-12 | Sandbox writes | §7 |
| EXEC-13 | Restore | §8 |
| EXEC-14–15 | Longevity | §4, §9 |
| EXEC-16 | Logging | §10 + result form |

---

## Related docs

| Doc | Use when |
| --- | --- |
| [windows-pilot-real-machine-checklist.md](./windows-pilot-real-machine-checklist.md) | Full matrix; dev dry-run vs Windows PC |
| [windows-pilot-field-result-form.md](./windows-pilot-field-result-form.md) | PHI-safe results |
| [windows-pilot-permission-and-path-risks.md](./windows-pilot-permission-and-path-risks.md) | Path/ACL risks before setup |
| [PILOT-HANDOFF-PACK.md](./PILOT-HANDOFF-PACK.md) | IT handoff index |
| [PILOT-START-HERE.md](./PILOT-START-HERE.md) | Root package index |
| [phase-4-mirror-import-operator.md](./phase-4-mirror-import-operator.md) | Mirror import commands |
| [phase-7-sandbox-pilot-qa-runbook.md](./phase-7-sandbox-pilot-qa-runbook.md) | Four write workflows |
