# Windows pilot — real machine checklist

**Purpose:** Field test matrix for clinic Windows PCs. Separates what a **dev dry-run** on macOS/Linux can prove from what **requires a Windows PC**.

**Baseline:** Microdent-Modern `main` @ `1b67d2b`

**Examples:** Synthetic paths and clinic names only — no real patient data, DBF contents, or production legacy trees.

**Index:** [PILOT-START-HERE.md](./PILOT-START-HERE.md) · [pilot-issue-template.md](./pilot-issue-template.md) · [windows-pilot-packaging-gap-report.md](./windows-pilot-packaging-gap-report.md) · [windows-dev-dry-run.md](./windows-dev-dry-run.md)

**Field execution on clinic PCs:** [windows-pilot-field-execution-script.md](./windows-pilot-field-execution-script.md) (**how** — linear EXEC steps) · [windows-pilot-field-result-form.md](./windows-pilot-field-result-form.md) (**results** — PHI-safe form) · [TEMPLATE-windows-field-run.md](../qa-runs/TEMPLATE-windows-field-run.md) (qa-runs copy)

This file is the **matrix** (what to prove). Follow the execution script for day-0 order; do not treat section order alone as the runbook.

---

## Package unpack location (IT)

Use **synthetic** examples only when recording field results.

| Rule | Rationale |
| --- | --- |
| Extract to a **local fixed drive** | e.g. `C:\Microdent\MicrodentModern\` — survives reboot; IT can permission the folder |
| **Avoid** temp-only extract (`%TEMP%`, Downloads cleanup) | Windows may purge or lock paths; upgrades are harder to find |
| **Do not** put DATA_ROOT, mirror sqlite, backups, or logs inside the install folder | Reinstall/upgrade must not delete clinic sandbox data — see [windows-pilot-data-locations.md](./windows-pilot-data-locations.md) |
| Confirm `RELEASE-MANIFEST.json` and `HANDOFF-README.txt` at package root after extract | Build machine should have run `pnpm pilot:verify-release` before zip handoff |
| Read `packageVersion` from manifest for support tickets | PHI-safe build id — not patient data |

**Staged copy:** `pnpm stage:pilot-release` already includes this checklist in `MicrodentModern/docs/`; add `pilot-issue-template.md` to the staging docs list per [PILOT-HANDOFF-PACK.md](./PILOT-HANDOFF-PACK.md) §10.

---

## How to use this checklist

| Marker | Meaning |
| --- | --- |
| **Dev dry-run** | Runnable on a build machine (macOS/Linux or Windows dev box) via `pnpm`, staged smoke, or vitest — see [windows-dev-dry-run.md](./windows-dev-dry-run.md) |
| **Requires Windows PC** | Must be executed on a clinic Windows 10/11 machine with operator profile, AV, and real `%AppData%` behavior |

Record pass/fail in [windows-pilot-field-result-form.md](./windows-pilot-field-result-form.md) (preferred) or file a copy from [TEMPLATE-windows-field-run.md](../qa-runs/TEMPLATE-windows-field-run.md). The embedded log template at the bottom of this file is **legacy** — use the result form for new runs. Do not paste PHI, real DBF paths, or live `config.json` into shared tickets.

For defects or blockers, copy [pilot-issue-template.md](./pilot-issue-template.md) — redaction rules and manifest `packageVersion` fields are defined there.

---

## 1 — Package delivery and launch

| # | Check | Marker | Synthetic example / steps |
| --- | --- | --- | --- |
| 1.1 | Staged tree verifies on build machine | **Dev dry-run** | `pnpm stage:pilot-release` then `pnpm pilot:verify-release` on `dist/pilot-release/MicrodentModern/` |
| 1.2 | IT extracts zip to local drive (not temp-only) | **Requires Windows PC** | Extract to `C:\Microdent\MicrodentModern\` |
| 1.3 | Node 22 on PATH for bridge child | **Requires Windows PC** | `node -v` → `v22.x` in PowerShell |
| 1.4 | Desktop launches without blank UI | **Requires Windows PC** | Start from `C:\Microdent\MicrodentModern\app\` per `HANDOFF-README.txt` |
| 1.5 | SmartScreen / unsigned app prompt handled | **Requires Windows PC** | IT documents “More info → Run anyway” for unsigned Electron + `node.exe` |
| 1.6 | Antivirus does not block bridge startup within 60s | **Requires Windows PC** | Allowlist `node.exe` + app folder if first launch times out |

---

## 2 — Paths, drives, and UNC

| # | Check | Marker | Synthetic example / steps |
| --- | --- | --- | --- |
| 2.1 | Path validation unit tests pass | **Dev dry-run** | `pnpm --filter @microdent/desktop run test` (setup payload cases) |
| 2.2 | DATA_ROOT on local drive letter | **Requires Windows PC** | `C:\ClinicData\PilotSandbox\DATA` — not live legacy |
| 2.3 | Spaced path in DATA_ROOT | **Requires Windows PC** | `C:\Clinic Data\Pilot Sandbox\DATA` — setup save + bridge start |
| 2.4 | SQLITE_PATH outside install folder | **Requires Windows PC** | `C:\Users\Public\MicrodentModern\mirror\clinic.sqlite` |
| 2.5 | BACKUP_DIR outside install folder | **Requires Windows PC** | `C:\Users\Public\MicrodentModern\backups` |
| 2.6 | UNC share for DATA_ROOT (warn-only) | **Requires Windows PC** | `\\fileserver\clinic\PilotSandbox\DATA` — note latency; prefer `C:\` when possible |
| 2.7 | Config persists after reboot | **Requires Windows PC** | `%AppData%\Microdent\config.json` unchanged after restart |

Full location reference: [windows-pilot-data-locations.md](./windows-pilot-data-locations.md).

---

## 3 — Permissions and profiles

| # | Check | Marker | Synthetic example / steps |
| --- | --- | --- | --- |
| 3.1 | Operator can create Layer 3 folders | **Requires Windows PC** | Create `C:\ClinicData\PilotSandbox\DATA` without admin if policy allows |
| 3.2 | Write access to mirror and backup dirs | **Requires Windows PC** | Import + sandbox commit can create files under `C:\Users\Public\MicrodentModern\` |
| 3.3 | `%AppData%\Microdent` writable by signed-in user | **Requires Windows PC** | First-run save succeeds; Win+R → `%AppData%\Microdent` opens folder |
| 3.4 | Non-admin operator can run desktop + bridge | **Requires Windows PC** | Standard clinic login — no elevation required for pilot RC |
| 3.5 | Roaming profile / folder redirection | **Requires Windows PC** | If IT uses redirected AppData, confirm config.json follows user |

---

## 4 — Bridge lifecycle and networking

| # | Check | Marker | Synthetic example / steps |
| --- | --- | --- | --- |
| 4.1 | Release smoke: supervisor + defaults | **Dev dry-run** | `pnpm --filter @microdent/desktop run release-smoke`; staged: `PILOT_STAGED_RELEASE=1` |
| 4.2 | Bridge online in Settings after launch | **Requires Windows PC** | **Pilot readiness** shows bridge connected on loopback |
| 4.3 | Port **17890** free or alternate in config | **Requires Windows PC** | Change `bridgePort` to `17891` if conflict; restart desktop |
| 4.4 | Bridge survives desktop window close/reopen | **Requires Windows PC** | Quit UI, relaunch — bridge respawns or clean restart documented |
| 4.5 | Kill stray bridge from Task Manager | **Requires Windows PC** | End `node.exe` child; relaunch desktop — no zombie lock on port |
| 4.6 | No LAN exposure by default | **Requires Windows PC** | Confirm health check on `127.0.0.1` only (corporate scan optional) |

---

## 5 — Mirror import

| # | Check | Marker | Synthetic example / steps |
| --- | --- | --- | --- |
| 5.1 | Mirror import CLI tests pass | **Dev dry-run** | Workspace tests for `import-safe` / mirror package |
| 5.2 | Operator runs import with synthetic sandbox DATA | **Requires Windows PC** | PowerShell env: `DATA_ROOT=C:\ClinicData\PilotSandbox\DATA`, `SQLITE_PATH=C:\Users\Public\MicrodentModern\mirror\clinic.sqlite` |
| 5.3 | Settings mirror table shows recent import run | **Requires Windows PC** | Refresh metadata — status not “never imported” |
| 5.4 | Read surfaces load post-import | **Requires Windows PC** | Today / Patients / Schedule show sandbox counts (no real names in screenshots) |

Runbook: [phase-4-mirror-import-operator.md](./phase-4-mirror-import-operator.md).

---

## 6 — Read-only QA

| # | Check | Marker | Synthetic example / steps |
| --- | --- | --- | --- |
| 6.1 | `writeMode: disabled` in staged config template | **Dev dry-run** | Release smoke greps supervisor spawn env |
| 6.2 | Settings shows write mode disabled | **Requires Windows PC** | No sandbox write panels in default production web build |
| 6.3 | Today, Patients, Schedule, Profile lede | **Requires Windows PC** | Navigate all four — no console errors |
| 6.4 | Unsupported actions show guardrail copy | **Requires Windows PC** | Payment/ledger/chart routes blocked per [out-of-scope-guardrails.md](./out-of-scope-guardrails.md) |
| 6.5 | Stale mirror callout if DBF changed outside app | **Requires Windows PC** | Document operator workflow — mirror does not auto-refresh on external edits |

Runbook: [phase-5-operator-qa-runbook.md](./phase-5-operator-qa-runbook.md).

---

## 7 — Sandbox write QA

| # | Check | Marker | Synthetic example / steps |
| --- | --- | --- | --- |
| 7.1 | `pnpm qa:sandbox` on dev machine with sandbox copy | **Dev dry-run** | Git Bash + env paths to disposable DATA (not production legacy) |
| 7.2 | Four write workflows on Windows | **Requires Windows PC** | Follow [phase-7-sandbox-pilot-qa-runbook.md](./phase-7-sandbox-pilot-qa-runbook.md) |
| 7.3 | DBF not open in FoxPro/Excel during commits | **Requires Windows PC** | Close handles on `SCHEDULE.DBF` / `PATIENT.DBF` in sandbox DATA |
| 7.4 | UI feedback shows `operationId` + audit status only | **Requires Windows PC** | No patient names in feedback lines |
| 7.5 | `BACKUP_DIR` populated before destructive steps | **Requires Windows PC** | `C:\Users\Public\MicrodentModern\backups` contains backup artifacts |

---

## 8 — Backup, restore, and audit

| # | Check | Marker | Synthetic example / steps |
| --- | --- | --- | --- |
| 8.1 | Backup/restore docs and tests green | **Dev dry-run** | `pnpm test` + [pilot-backup-restore-audit.md](./pilot-backup-restore-audit.md) |
| 8.2 | Operator verifies backup CLI on Windows | **Requires Windows PC** | Run documented verify command against synthetic sandbox |
| 8.3 | Restore returns sandbox to known state | **Requires Windows PC** | Restore workflow — re-run read-only smoke |
| 8.4 | Audit scope understood (`appointment.statusUpdate` fullest) | **Requires Windows PC** | IT sign-off row in [pilot-acceptance-checklist.md](./pilot-acceptance-checklist.md) |

---

## 9 — Reboot and longevity

| # | Check | Marker | Synthetic example / steps |
| --- | --- | --- | --- |
| 9.1 | Cold boot: desktop + bridge + UI | **Requires Windows PC** | Reboot `CLINIC-PC-01`; launch app — bridge online within 2 min |
| 9.2 | Config paths survive reboot | **Requires Windows PC** | `%AppData%\Microdent\config.json` still points to `C:\ClinicData\PilotSandbox\DATA` |
| 9.3 | Scheduled task / login item (if IT adds one) | **Requires Windows PC** | Optional shortcut to staged `app` — document who installed |
| 9.4 | Second operator profile (if multi-user clinic) | **Requires Windows PC** | Separate `%AppData%` — paths re-entered or IT template applied |

---

## 10 — Logs, config, and backups (locations)

| # | Check | Marker | Synthetic example / steps |
| --- | --- | --- | --- |
| 10.1 | Install dir contains no clinic DBF/sqlite | **Dev dry-run** | `pnpm pilot:verify-release` artifact rules |
| 10.2 | Config only under `%AppData%\Microdent\` | **Requires Windows PC** | No `config.json` inside `C:\Microdent\MicrodentModern\` |
| 10.3 | Logs convention documented (optional folder) | **Requires Windows PC** | Create `%AppData%\Microdent\logs\` manually if IT wants file logs — pilot RC may not auto-create |
| 10.4 | Bridge console PHI-safe | **Requires Windows PC** | Launch terminal shows status lines only — no `PAT_NAME` in output |
| 10.5 | Backups remain outside install | **Requires Windows PC** | Upgrading `C:\Microdent\MicrodentModern\` does not delete `C:\Users\Public\MicrodentModern\backups` |

---

## Summary matrix

| Area | Dev dry-run count | Requires Windows PC count |
| --- | --- | --- |
| Package / launch | 1 | 5 |
| Paths / UNC | 1 | 6 |
| Permissions | 0 | 5 |
| Bridge lifecycle | 1 | 5 |
| Mirror import | 1 | 3 |
| Read-only QA | 1 | 4 |
| Sandbox QA | 1 | 4 |
| Backup / restore | 1 | 3 |
| Reboot / longevity | 0 | 4 |
| Logs / locations | 1 | 4 |

**Rule of thumb:** Green dev dry-run + distribution checkpoint is necessary but **not sufficient** for clinic go-live. Complete all **Requires Windows PC** rows and file a PHI-safe field log before treating the pilot as clinic go-live ready.

---

## Issue reporting (field test)

When a **Requires Windows PC** row fails:

1. Note checklist **section #** and row (e.g. `2.3 Spaced path in DATA_ROOT`) — no patient context.
2. Open [pilot-issue-template.md](./pilot-issue-template.md) and fill **Environment**, **Steps**, **Expected vs actual**, and **Diagnostics** using sandbox paths only.
3. Set **Package version** from `RELEASE-MANIFEST.json` → `packageVersion` (and `releaseChannel` if present).
4. File internally or in `qa-runs/` — filename example: `qa-runs/2026-05-24-windows-field-log-EXAMPLE.md` (fictional machine id).
5. Do **not** attach DBF, sqlite, screenshots with patient names, or full `%AppData%\Microdent\config.json`.

Escalation index: [PILOT-START-HERE.md § Issue report template](./PILOT-START-HERE.md#issue-report-template-no-phi).

---

## Field execution log (legacy — prefer result form)

**Preferred:** [windows-pilot-field-result-form.md](./windows-pilot-field-result-form.md) + [TEMPLATE-windows-field-run.md](../qa-runs/TEMPLATE-windows-field-run.md), filled while following [windows-pilot-field-execution-script.md](./windows-pilot-field-execution-script.md).

Legacy inline template (synthetic example only):

```markdown
# Windows pilot field log — EXAMPLE ONLY

| Field | Value |
| --- | --- |
| Machine | CLINIC-PC-01 (Windows 11 23H2) |
| Operator profile | CONTOSO\pilot.operator |
| Package path | C:\Microdent\MicrodentModern\ |
| DATA_ROOT | C:\ClinicData\PilotSandbox\DATA |
| Build | main @ 1b67d2b |
| Date | 2026-05-21 |

## Results (Requires Windows PC)

| Section | Pass | Fail | Notes |
| --- | --- | --- | --- |
| 1 Launch | ☐ | ☐ | SmartScreen: IT approved |
| 2 Paths | ☐ | ☐ | Spaced path OK |
| 3 Permissions | ☐ | ☐ | |
| 4 Bridge | ☐ | ☐ | Port 17890 |
| 5 Mirror | ☐ | ☐ | |
| 6 Read-only | ☐ | ☐ | |
| 7 Sandbox | ☐ | ☐ | |
| 8 Restore | ☐ | ☐ | |
| 9 Reboot | ☐ | ☐ | |
| 10 Locations | ☐ | ☐ | |

## Blockers

- (none / describe without PHI)
```

---

## Related docs

| Doc | Use when |
| --- | --- |
| [windows-pilot-field-execution-script.md](./windows-pilot-field-execution-script.md) | Linear day-0 steps on clinic Windows PC |
| [windows-pilot-field-result-form.md](./windows-pilot-field-result-form.md) | PHI-safe pass/fail after field run |
| [TEMPLATE-windows-field-run.md](../qa-runs/TEMPLATE-windows-field-run.md) | Slim qa-runs filing copy |
| [pilot-issue-template.md](./pilot-issue-template.md) | PHI-safe defect report (manifest version, redaction rules) |
| [windows-dev-dry-run.md](./windows-dev-dry-run.md) | Build-machine checkpoint before shipping zip |
| [windows-pilot-data-locations.md](./windows-pilot-data-locations.md) | Layer 1/2/3 path rules |
| [pilot-acceptance-checklist.md](./pilot-acceptance-checklist.md) | IT formal sign-off |
| [windows-pilot-packaging-gap-report.md](./windows-pilot-packaging-gap-report.md) | Installer and automation gaps |
| [windows-pilot-installer-decision-record.md](./windows-pilot-installer-decision-record.md) | Portable vs NSIS/MSI next phase |
| [PILOT-START-HERE.md](./PILOT-START-HERE.md) | Operator numbered flow |
| [PILOT-HANDOFF-PACK.md](./PILOT-HANDOFF-PACK.md) | Staged package operator journey |
