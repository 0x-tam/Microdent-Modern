# Windows pilot acceptance checklist

**Purpose:** IT / operator **pass-fail sign-off** for the first Windows pilot build. Use checkboxes before handing to clinic staff.

**Not a day-by-day script** — for guided testing see [pilot-tester-guide.md](./pilot-tester-guide.md).

**Baseline:** `main` @ `1b67d2b` · No real patient data in this document.

---

## 1. Install and start

| # | Check | Pass |
| --- | --- | --- |
| 1.1 | Node 22 installed; `node -v` shows v22.x | ☐ |
| 1.2 | Bridge + web + desktop built (or pre-staged package verified) | ☐ |
| 1.3 | Desktop launches; first-run setup opens when paths missing | ☐ |
| 1.4 | `pnpm desktop:release-smoke` or `pnpm pilot:verify-release` passed on handoff machine | ☐ |

---

## 2. Configure paths

| # | Check | Pass |
| --- | --- | --- |
| 2.1 | DATA_ROOT is disposable Write-Sandbox — **not** live Microdent-Legacy | ☐ |
| 2.2 | SQLITE_PATH is absolute file on local drive (not inside app install) | ☐ |
| 2.3 | BACKUP_DIR set before any sandbox commits (if writes enabled later) | ☐ |
| 2.4 | Settings **Pilot readiness** shows clinic service connected | ☐ |

Path reference: [windows-pilot-data-locations.md](./windows-pilot-data-locations.md)

---

## 3. Mirror import

| # | Check | Pass |
| --- | --- | --- |
| 3.1 | Safe mirror import run from CLI (`pnpm mirror:import-safe` or filter command) | ☐ |
| 3.2 | Settings mirror table shows import run (success or partial understood) | ☐ |
| 3.3 | Stale mirror (>48h) understood — re-import per runbook | ☐ |

---

## 4. Read-only flows

| # | Check | Pass |
| --- | --- | --- |
| 4.1 | Today, Patients, Schedule, Profile load without errors | ☐ |
| 4.2 | `writeMode` remains **disabled** unless sandbox pilot approved | ☐ |
| 4.3 | Unsupported features show clear “not available” (no payments/ledger/chart writes) | ☐ |

---

## 5. Sandbox QA (optional pilot)

| # | Check | Pass |
| --- | --- | --- |
| 5.1 | `pnpm qa:sandbox` exit 0 with DBF readback (four workflows) | ☐ |
| 5.2 | Only four sandbox workflows used; no memo/payment fields in requests | ☐ |
| 5.3 | Write feedback shows backup/audit lines — no PHI in tickets | ☐ |

---

## 6. Restore

| # | Check | Pass |
| --- | --- | --- |
| 6.1 | Operator knows `legacy:restore` / phase-7 restore steps | ☐ |
| 6.2 | Test restore on sandbox copy documented (not production legacy) | ☐ |

---

## 7. Unsupported / guardrails

| # | Check | Pass |
| --- | --- | --- |
| 7.1 | [out-of-scope-guardrails.md](./out-of-scope-guardrails.md) reviewed | ☐ |
| 7.2 | No NSIS/installer/signing promised — [windows-pilot-packaging-gap-report.md](./windows-pilot-packaging-gap-report.md) shared | ☐ |
| 7.3 | Staged package contains no `.sqlite`, `.dbf`, or Legacy trees | ☐ |

---

## 8. Feedback collection

| # | Check | Pass |
| --- | --- | --- |
| 8.1 | Issue template used — build hash, checklist state, no PHI attachments | ☐ |
| 8.2 | [PILOT-START-HERE.md](./PILOT-START-HERE.md) troubleshooting consulted for bridge/mirror issues | ☐ |

---

## Sign-off

| Role | Name | Date | Signature |
| --- | --- | --- | --- |
| IT / operator lead | | | |
| Developer handoff | | | |

**Guided testing:** [pilot-tester-guide.md](./pilot-tester-guide.md) · **Start here:** [PILOT-START-HERE.md](./PILOT-START-HERE.md)
