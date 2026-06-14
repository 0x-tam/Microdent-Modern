# Windows pilot — go / no-go checklist

**Purpose:** Single sign-off page for the pilot sponsor after a real Windows field run.

**Prerequisite:** **Windows execution completed** — tier 3 must show validated package verification evidence and PHI-safe Windows field evidence in `qa-runs/` referencing `packageVerification.evidencePath`. Mac-side release signoff (tier 1) and staged field pack (tier 2) are **not** sufficient for clinic go-live.

**Audience:** Pilot sponsor, IT lead, release coordinator.

**When:** Complete only after [windows-pilot-field-execution-script.md](./windows-pilot-field-execution-script.md) on a clinic Windows PC and record supporting detail on [windows-pilot-field-result-form.md](./windows-pilot-field-result-form.md).

**PHI:** Notes column only — no patient names, chart numbers, phones, DBF contents, or full `config.json` paths in shared tickets.

---

## Build identity

| Field | Value |
| --- | --- |
| **packageVersion** | e.g. `pilot-2026-05-21` (from `RELEASE-MANIFEST.json`) |
| **Field run date** | |
| **Machine label** | e.g. `CLINIC-PC-01` (fictional OK) |
| **Result form filed** | ☐ Yes — `qa-runs/YYYY-MM-DD-windows-field-log-<MACHINE>.md` |

---

## Decision criteria

Mark **Pass**, **Fail**, or **N/A** for each row. **Owner:** who attests (IT or operator).

| Criterion | Pass | Fail | N/A | Owner | Notes (no PHI) |
| --- | --- | --- | --- | --- | --- |
| **Package verified** — IT confirmed layout, manifest fields, no forbidden `.dbf`/`.sqlite`/`.env` in tree and filed `qa-runs/YYYY-MM-DD-windows-package-verify-evidence-CLINIC-PC-01.json` ([windows-package-verify-evidence.md](./windows-package-verify-evidence.md)) | ☐ | ☐ | ☐ | IT | |
| **Windows launch** — desktop opens; Node 22 on PATH; SmartScreen/AV handled if needed | ☐ | ☐ | ☐ | Operator | |
| **Config** — first-run setup saved sandbox paths outside install folder; `%AppData%\Microdent\config.json` valid | ☐ | ☐ | ☐ | Operator | |
| **Mirror import** — CLI safe import completed; Settings mirror status understood | ☐ | ☐ | ☐ | Operator | |
| **Read-only QA** — Today, Patients, Schedule, Settings pilot readiness pass | ☐ | ☐ | ☐ | Operator | |
| **Sandbox QA** — four workflows + backup/audit feedback (only if sandbox pilot approved) | ☐ | ☐ | ☐ | Operator | N/A if read-only pilot |
| **Restore** — backup verify + sandbox restore exercised when writes were tested | ☐ | ☐ | ☐ | Operator | N/A if no sandbox writes |
| **No PHI leakage observed** — UI, logs, screenshots, filed forms stay PHI-safe | ☐ | ☐ | ☐ | Sponsor | **Fail = automatic NO-GO** |
| **Unsupported writes blocked** — no payments, ledger, chart, memo, or live-legacy commits | ☐ | ☐ | ☐ | Sponsor | |
| **Issues triaged** — defects logged via [pilot-issue-template.md](./pilot-issue-template.md); blockers assigned | ☐ | ☐ | ☐ | IT | |

---

## Issue rollup (summary)

| Id | Severity | One-line symptom | Blocker? |
| --- | --- | --- | --- |
| | | | ☐ |

Troubleshooting reference: [windows-pilot-troubleshooting-pack.md](./windows-pilot-troubleshooting-pack.md).

---

## Decision

| Question | Answer |
| --- | --- |
| Any **Fail** on PHI leakage or unsupported writes? | ☐ No ☐ Yes → **NO-GO** |
| Any **Fail** on package verified, launch, config, or read-only QA? | ☐ No ☐ Yes |
| Sandbox scope requested? | ☐ Yes ☐ No (read-only pilot only) |

### Outcome (check one)

| | |
| --- | --- |
| ☐ **GO — limited sandbox pilot** | All required rows Pass; sandbox QA Pass or N/A with sponsor approval; issues non-blocking or tracked |
| ☐ **GO — read-only pilot only** | Launch + config + mirror + read-only QA Pass; sandbox rows N/A; no PHI leakage |
| ☐ **NO-GO** | Required fixes before next field attempt (list below) |

**Required fixes before re-test:**

1.
2.

---

## Sign-off

| Role | Name | Date |
| --- | --- | --- |
| **Operator** | | |
| **IT lead** | | |
| **Pilot sponsor** | | |

---

## Related docs

| Doc | Role |
| --- | --- |
| [windows-pilot-field-result-form.md](./windows-pilot-field-result-form.md) | Detailed step pass/fail |
| [qa-runs/TEMPLATE-windows-field-evidence.json](../qa-runs/TEMPLATE-windows-field-evidence.json) | Filed Windows field evidence JSON |
| [windows-pilot-release-notes.md](./windows-pilot-release-notes.md) | Scope and caveats |
| [PILOT-HANDOFF-PACK.md](./PILOT-HANDOFF-PACK.md) | Handoff index |
