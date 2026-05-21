# Windows pilot field run — TEMPLATE (copy me)

**PHI statement:** This file contains **no real patient data**. Use fictional machine names and sandbox paths only.

**Copy to:** `qa-runs/YYYY-MM-DD-windows-field-log-<MACHINE>.md`  
**Full form:** [docs/windows-pilot-field-result-form.md](../docs/windows-pilot-field-result-form.md)  
**Execution script:** [docs/windows-pilot-field-execution-script.md](../docs/windows-pilot-field-execution-script.md)  
**Checklist matrix:** [docs/windows-pilot-real-machine-checklist.md](../docs/windows-pilot-real-machine-checklist.md)  
**Go/no-go:** [docs/windows-pilot-go-no-go-checklist.md](../docs/windows-pilot-go-no-go-checklist.md)

---

## Run header

| Field | Value |
| --- | --- |
| **Date** | YYYY-MM-DD |
| **Tester** | e.g. Alex Chen |
| **Machine** | e.g. CLINIC-PC-01 |
| **Windows** | e.g. Windows 11 23H2 |
| **Operator profile** | e.g. CONTOSO\pilot.operator |
| **Package path** | e.g. `C:\Microdent\MicrodentModern\` |
| **packageVersion** | from `RELEASE-MANIFEST.json` |
| **appVersion** | |
| **gitCommit** | |
| **releaseChannel** | e.g. `pilot` |

---

## Sandbox paths (synthetic)

| Path | Value |
| --- | --- |
| DATA_ROOT | `C:\ClinicData\PilotSandbox\DATA` |
| SQLITE_PATH | `C:\Users\Public\MicrodentModern\mirror\clinic.sqlite` |
| BACKUP_DIR | `C:\Users\Public\MicrodentModern\backups` |

---

## EXEC step results

| Step | Pass | Fail | N/A | Notes |
| --- | --- | --- | --- | --- |
| EXEC-01 Receive zip | ☐ | ☐ | ☐ | |
| EXEC-02 Extract | ☐ | ☐ | ☐ | |
| EXEC-03 Read index | ☐ | ☐ | ☐ | |
| EXEC-04 Build identity | ☐ | ☐ | ☐ | |
| EXEC-05 Node 22 | ☐ | ☐ | ☐ | |
| EXEC-06 Launch | ☐ | ☐ | ☐ | |
| EXEC-07 SmartScreen/AV | ☐ | ☐ | ☐ | |
| EXEC-08 Setup | ☐ | ☐ | ☐ | |
| EXEC-09 Bridge | ☐ | ☐ | ☐ | |
| EXEC-10 Mirror import | ☐ | ☐ | ☐ | |
| EXEC-11 Read-only QA | ☐ | ☐ | ☐ | |
| EXEC-12 Sandbox writes | ☐ | ☐ | ☐ | skipped if read-only pilot |
| EXEC-13 Restore | ☐ | ☐ | ☐ | |
| EXEC-14 Restart app | ☐ | ☐ | ☐ | |
| EXEC-15 Reboot | ☐ | ☐ | ☐ | optional |
| EXEC-16 Filed | ☐ | ☐ | ☐ | |

---

## Section rollup

| Section | Pass | Fail | N/A |
| --- | --- | --- | --- |
| 1 Launch | ☐ | ☐ | ☐ |
| 2 Paths | ☐ | ☐ | ☐ |
| 3 Permissions | ☐ | ☐ | ☐ |
| 4 Bridge | ☐ | ☐ | ☐ |
| 5 Mirror | ☐ | ☐ | ☐ |
| 6 Read-only | ☐ | ☐ | ☐ |
| 7 Sandbox | ☐ | ☐ | ☐ |
| 8 Restore | ☐ | ☐ | ☐ |
| 9 Reboot | ☐ | ☐ | ☐ |
| 10 Locations | ☐ | ☐ | ☐ |

---

## Issues (no PHI)

| Id | Step | Severity | Summary |
| --- | --- | --- | --- |
| | | | |

Defect detail: [docs/pilot-issue-template.md](../docs/pilot-issue-template.md)

---

## Go / no-go (sponsor)

Complete [docs/windows-pilot-go-no-go-checklist.md](../docs/windows-pilot-go-no-go-checklist.md) for formal sign-off. Summary:

| Criterion | Pass | Fail | N/A |
| --- | --- | --- | --- |
| Package verified | ☐ | ☐ | ☐ |
| Windows launch | ☐ | ☐ | ☐ |
| Config | ☐ | ☐ | ☐ |
| Mirror import | ☐ | ☐ | ☐ |
| Read-only QA | ☐ | ☐ | ☐ |
| Sandbox QA | ☐ | ☐ | ☐ |
| Restore | ☐ | ☐ | ☐ |
| No PHI leakage | ☐ | ☐ | ☐ |
| Unsupported writes blocked | ☐ | ☐ | ☐ |
| Issues triaged | ☐ | ☐ | ☐ |

| | |
| --- | --- |
| **PHI leakage observed?** | ☐ No ☐ Yes — **NO-GO** |
| **Outcome** | ☐ GO (limited sandbox) ☐ GO (read-only only) ☐ NO-GO |
| **Sponsor** | |
| **Notes (no PHI)** | |
