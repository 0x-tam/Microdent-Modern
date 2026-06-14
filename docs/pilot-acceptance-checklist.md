# Windows pilot acceptance checklist

**Purpose:** IT / operator **pass-fail sign-off** for the first Windows pilot build. Use checkboxes before handing to clinic staff.

**Not a day-by-day script** — for guided testing see [pilot-tester-guide.md](./pilot-tester-guide.md).

**Baseline:** distribution RC batch · **Synthetic examples only** — no real patient data in this document.

---

## 0. Staged package verification (handoff machine)

Complete on the **build or IT machine** before copying `MicrodentModern/` to clinic PCs.

| # | Check | Pass |
| --- | --- | --- |
| 0.1 | `pnpm stage:pilot-release` completed after web + bridge + desktop builds | ☐ |
| 0.2 | `pnpm pilot:verify-release` exit 0 — layout + sensitive-artifact guards | ☐ |
| 0.2a | `pnpm pilot:verify-manifest` exit 0 — `RELEASE-MANIFEST.json` hashes match | ☐ |
| 0.3 | `MicrodentModern/HANDOFF-README.txt` read — start at `docs/PILOT-HANDOFF-PACK.md` | ☐ |
| 0.4 | Staged tree has `app/`, `bridge/`, `web/`, `config-templates/`, `docs/` — placeholders only in `logs/`, `mirror/`, `backups/` | ☐ |
| 0.5 | No `.sqlite`, `.dbf`, `.env`, `.log`, or live Legacy trees in staged package | ☐ |
| 0.6 | `config-templates/` uses placeholders only (e.g. `C:\ClinicData\Microdent\DATA`) — no real local paths | ☐ |
| 0.7 | IT package verification evidence filed and validated: `pnpm pilot:package-verify-evidence -- qa-runs/YYYY-MM-DD-windows-package-verify-evidence-CLINIC-PC-01.json` | ☐ |

Reference: [windows-pilot-release-layout.md](./windows-pilot-release-layout.md) · [windows-package-verify-evidence.md](./windows-package-verify-evidence.md)

---

## 1. Launch desktop

| # | Check | Pass |
| --- | --- | --- |
| 1.1 | Node 22 installed; `node -v` shows v22.x | ☐ |
| 1.2 | Portable smoke runner launches app or local web preview from package root | ☐ |
| 1.3 | First-run **setup** opens when paths missing | ☐ |
| 1.4 | Main UI loads after setup save; bridge shows connected in Settings | ☐ |
| 1.5 | `pnpm --filter @microdent/desktop run release-smoke` passed (dev) or staged verify (0.2) passed (handoff) | ☐ |

---

## 2. Folder selection (setup paths)

| # | Check | Pass |
| --- | --- | --- |
| 2.1 | **DATA_ROOT** points to disposable Write-Sandbox — **not** live `Microdent-Legacy` | ☐ |
| 2.2 | **SQLITE_PATH** is absolute file on local drive (example: `C:\Users\Public\MicrodentModern\mirror\clinic.sqlite`) — not inside app install | ☐ |
| 2.3 | **BACKUP_DIR** set before any sandbox commits (example: `C:\Users\Public\MicrodentModern\backups`) | ☐ |
| 2.4 | Config saved to `%AppData%\Microdent\config.json` — paths live outside install folder | ☐ |
| 2.5 | Settings **Pilot readiness** shows clinic service connected | ☐ |

Path reference: [windows-pilot-data-locations.md](./windows-pilot-data-locations.md)

**Synthetic setup example (do not copy real clinic paths):**

```text
DATA_ROOT   = C:\ClinicData\Microdent-Write-Sandbox\DATA
SQLITE_PATH = C:\Users\Public\MicrodentModern\mirror\clinic.sqlite
BACKUP_DIR  = C:\Users\Public\MicrodentModern\backups
writeMode   = disabled
```

---

## 3. Mirror import

| # | Check | Pass |
| --- | --- | --- |
| 3.1 | Mirror import run from CLI (PowerShell or repo checkout) — see [phase-4-mirror-import-operator.md](./phase-4-mirror-import-operator.md) | ☐ |
| 3.2 | Settings mirror table shows import run (success or partial understood) | ☐ |
| 3.3 | Stale mirror (>48h) understood — re-import per runbook | ☐ |
| 3.4 | DBF = source of truth; SQLite = snapshot — refresh after writes for readback | ☐ |

**Synthetic import example:**

```powershell
$env:DATA_ROOT = "C:\ClinicData\Microdent-Write-Sandbox\DATA"
$env:SQLITE_PATH = "C:\Users\Public\MicrodentModern\mirror\clinic.sqlite"
pnpm --filter @microdent/sqlite-mirror run import-safe
```

---

## 4. Read-only flows

`writeMode` stays **disabled** unless sandbox pilot is explicitly approved.

| # | Check | Pass |
| --- | --- | --- |
| 4.1 | **Today** — day list loads; no errors | ☐ |
| 4.2 | **Patients → search** — type a synthetic id or name fragment (e.g. `DEMO-001`); matches appear; no notes/phones in list | ☐ |
| 4.3 | **Schedule** — week/day navigation loads | ☐ |
| 4.4 | **Patient profile** — open a record; all read-only tabs load or show clear empty/unavailable state | ☐ |
| 4.4a | Profile tab **Summary** loads | ☐ |
| 4.4b | Profile tab **Appointments** loads | ☐ |
| 4.4c | Profile tab **Medical** loads (read-only; no writes) | ☐ |
| 4.4d | Profile tab **Treatments** loads (read-only) | ☐ |
| 4.4e | Profile tab **Chart** loads (read-only) | ☐ |
| 4.4f | Profile tab **Ledger preview** loads (read-only; no payment writes) | ☐ |
| 4.5 | **Settings** — Pilot readiness checklist reviewed; no raw paths in UI | ☐ |

---

## 5. Sandbox writes (optional pilot — four workflows only)

Only on a **disposable Write-Sandbox** copy with IT present. Requires `writeMode=enabled` and sandbox ack per runbook.

| # | Check | Pass |
| --- | --- | --- |
| 5.1 | `BACKUP_DIR` configured before first commit | ☐ |
| 5.2 | **Workflow 1** — `appointment.statusUpdate` (status change on schedule row) | ☐ |
| 5.3 | **Workflow 2** — `appointment.timeMove` (date/time/room change) | ☐ |
| 5.4 | **Workflow 3** — `appointment.create` (new schedule row) | ☐ |
| 5.5 | **Workflow 4** — `patient.demographics.update` (allowlisted name fields only) | ☐ |
| 5.6 | Each commit: preview → confirm → feedback shows `operationId` + backup line — no PHI | ☐ |
| 5.7 | `pnpm qa:sandbox` exit 0 with DBF readback (`source=dbf`) — optional automated proof | ☐ |
| 5.8 | No memo/payment/chart/medical write fields in requests | ☐ |

Reference: [out-of-scope-guardrails.md](./out-of-scope-guardrails.md) · [phase-3-sandbox-qa-runner.md](./phase-3-sandbox-qa-runner.md)

---

## 6. Backup and restore

| # | Check | Pass |
| --- | --- | --- |
| 6.1 | Write feedback shows backup created (or dry-run shows N/A) — metadata only | ☐ |
| 6.1a | Restore hint + sandbox-only note in write feedback understood | ☐ |
| 6.2 | Operator knows restore CLI (`legacy-restore`) on sandbox DATA only | ☐ |
| 6.2a | Operator ran `legacy-backup-verify` at least once — backup ids basename-only | ☐ |
| 6.3 | Test restore on **sandbox copy only** — not production legacy | ☐ |
| 6.4 | After restore, mirror re-import if search/schedule must match DBF again | ☐ |
| 6.5 | Audit line in write feedback understood (terminal status, operation id) | ☐ |
| 6.6 | Status-update workflow audit detail reviewed — other workflows show operation id + backup only | ☐ |

Reference: [pilot-backup-restore-audit.md](./pilot-backup-restore-audit.md)

---

## 7. Unsupported features and guardrails

| # | Check | Pass |
| --- | --- | --- |
| 7.1 | Payments, ledger, chart writes, medical summary edits, memo/comment fields — **not available**; UI shows clear “not available” | ☐ |
| 7.2 | [out-of-scope-guardrails.md](./out-of-scope-guardrails.md) reviewed — only four sandbox workflows allowed | ☐ |
| 7.3 | No NSIS/installer/signing promised — [windows-pilot-packaging-gap-report.md](./windows-pilot-packaging-gap-report.md) shared | ☐ |
| 7.4 | No in-app mirror import or write-mode toggle in this RC — CLI + setup only | ☐ |
| 7.5 | Staged package contains no `.sqlite`, `.dbf`, or Legacy trees (re-check after copy) | ☐ |

---

## 8. Feedback collection

| # | Check | Pass |
| --- | --- | --- |
| 8.1 | Issue template used — build hash, checklist section, screen name — **no PHI attachments** | ☐ |
| 8.2 | Screenshots OK if no patient names, phones, or full config paths visible | ☐ |
| 8.3 | [PILOT-START-HERE.md](./PILOT-START-HERE.md) troubleshooting consulted for bridge/mirror issues | ☐ |
| 8.4 | `operationId` and workflow name captured for write issues — not raw DBF contents | ☐ |

Template: [pilot-tester-guide.md](./pilot-tester-guide.md#issue-report-template)

---

## Sign-off

**Clinic go-live:** **BLOCKED** until tier 3 — package verification evidence is filed, a real Windows clinic PC field run references it through `packageVerification.evidencePath`, and [windows-pilot-go-no-go-checklist.md](./windows-pilot-go-no-go-checklist.md) records **GO**. Mac build-machine acceptance (sections 0–7) is **Windows-test readiness** only.

| Role | Name | Date | Signature |
| --- | --- | --- | --- |
| IT / operator lead | | | |
| Developer handoff | | | |

**Guided testing:** [pilot-tester-guide.md](./pilot-tester-guide.md) · **Handoff pack:** [PILOT-HANDOFF-PACK.md](./PILOT-HANDOFF-PACK.md) · **Start here:** [PILOT-START-HERE.md](./PILOT-START-HERE.md) · **Package root:** `MicrodentModern/HANDOFF-README.txt`
