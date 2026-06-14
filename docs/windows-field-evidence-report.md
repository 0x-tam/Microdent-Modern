# Windows field evidence report

**Purpose:** Machine-readable, PHI-safe proof that a Windows field run completed the required execution steps. This complements the human result form; it does not replace screenshots, issue tickets, or sponsor sign-off.

**Template:** [TEMPLATE-windows-field-evidence.json](../qa-runs/TEMPLATE-windows-field-evidence.json)

**Validator:**

```bash
pnpm pilot:windows-field-packet -- --date YYYY-MM-DD --clinic-label CLINIC-PC-01
pnpm pilot:field-evidence -- qa-runs/YYYY-MM-DD-windows-field-evidence-CLINIC-PC-01.json
```

Use `--repo-root <path>` only when validating a field report and referenced package/attachment evidence files from an alternate checkout/evidence bundle.

## Returned Safe-Results Zip

When a Windows operator runs `DOUBLE-CLICK-WINDOWS-TEST.cmd`, they should send back only `MicrodentModern-safe-results.zip`. From a full repo checkout, engineering/IT can intake that zip with:

```bash
pnpm pilot:intake-safe-results -- /path/to/MicrodentModern-safe-results.zip
```

The intake command rejects raw clinic/data files, unexpected JSON, logs, archives, and path traversal. It validates the three generated evidence JSON files in a temporary evidence root first, then copies them into `qa-runs/` only when the attachment manifest, package verification evidence, and field evidence all pass reference checks. If intake prints `SAFE RESULTS INTAKE: BLOCKED`, the returned files are not copied into `qa-runs/`; fix the returned safe bundle or record the blocker. A read-only smoke bundle can produce `FIELD EVIDENCE: READ_ONLY_READY`; it still does **not** satisfy sandbox-signoff or commercial go-live.

Before the Windows session, run `pnpm pilot:package-verify-packet -- --date YYYY-MM-DD --clinic-label CLINIC-PC-01 --write` to create the PHI-safe no-pnpm package verification packet for IT. After the staged package passes that check, run `pnpm pilot:windows-field-packet -- --date YYYY-MM-DD --clinic-label CLINIC-PC-01` to print the PHI-safe EXEC checklist, target evidence filenames, and validator commands. Before filing, run `pnpm pilot:evidence-filing-plan -- --clinic-label CLINIC-PC-01` to print the recommended packet commands, non-template filenames, and follow-up commercial evidence validators. Also validate the attachment manifest with `pnpm pilot:attachment-manifest -- qa-runs/YYYY-MM-DD-evidence-attachment-manifest-CLINIC-PC-01.json`.

The field evidence JSON must include `packageVerification.evidencePath` pointing to the validated `qa-runs/YYYY-MM-DD-windows-package-verify-evidence-CLINIC-PC-01.json` file and `packageVerification.verifiedBeforeFieldRun: true`. Strict/reference validation rejects field evidence when that package evidence is missing, blocked, or for a different machine/build.

## Modes

| Mode | Meaning | Go-live impact |
| --- | --- | --- |
| `sandbox-signoff` | EXEC-01 through EXEC-14 and EXEC-16 passed; EXEC-12 sandbox writes and EXEC-13 backup/restore are required; EXEC-15 cold reboot may be `na` with evidence | Can satisfy tier 3 evidence for limited sandbox pilot review when go/no-go also passes |
| `read-only` | Read-only Windows run passed; EXEC-12, EXEC-13, and EXEC-15 may be `na` | Useful field proof, but clinic go-live remains blocked for sandbox/write readiness |

For `sandbox-signoff`, `EXEC-12.evidence` must explicitly mention all four write workflows: appointment status update, appointment time move, appointment creation, and patient demographics update. It must also mention operation IDs. `EXEC-13.evidence` must mention both backup and restore. Generic text such as "sandbox writes passed" is intentionally blocked because it is too easy to over-claim.

## PHI rules

Keep this JSON boring and synthetic:

- Do not include patient names, chart numbers, phone numbers, DBF rows, or raw `config.json`.
- Use fictional machine labels such as `CLINIC-PC-01`.
- Use sandbox paths only, never live `Microdent-Legacy`.
- Evidence lines should say what was observed, not paste logs.
- Put screenshots and longer notes through the redaction policy in [windows-pilot-field-result-form.md](./windows-pilot-field-result-form.md).

## Required shape

```json
{
  "schemaVersion": "microdent-windows-field-evidence/v1",
  "mode": "sandbox-signoff",
  "phiStatement": "no-real-patient-data",
  "build": {
    "packageVersion": "pilot-YYYY-MM-DD",
    "appVersion": "0.0.1",
    "gitCommit": "abcdef1",
    "releaseChannel": "pilot"
  },
  "machine": {
    "label": "CLINIC-PC-01",
    "windowsVersion": "Windows 11 23H2",
    "nodeVersion": "v22.11.0"
  },
  "packageVerification": {
    "evidencePath": "qa-runs/YYYY-MM-DD-windows-package-verify-evidence-CLINIC-PC-01.json",
    "verifiedBeforeFieldRun": true
  },
  "paths": {
    "packageRoot": "C:\\Microdent\\MicrodentModern",
    "dataRoot": "C:\\ClinicData\\PilotSandbox\\DATA",
    "sqlitePath": "C:\\ClinicData\\PilotSandbox\\mirror\\clinic.sqlite",
    "backupDir": "C:\\ClinicData\\PilotSandbox\\microdent-backups"
  },
  "steps": {
    "EXEC-01": { "status": "pass", "evidence": "Handoff zip opened and root files were present." }
  },
  "goNoGo": {
    "phiObserved": false,
    "unsupportedWritesAttempted": false,
    "outcome": "go-limited-sandbox"
  },
  "attachments": {
    "manifestPath": "qa-runs/YYYY-MM-DD-evidence-attachment-manifest-CLINIC-PC-01.json",
    "redactionReviewed": true,
    "rawAttachmentsCommitted": false
  }
}
```

Every `EXEC-01` through `EXEC-16` key must be present in the real file.

## Validator outcomes

| Output | Meaning |
| --- | --- |
| `FIELD EVIDENCE: READY` | `sandbox-signoff` evidence is complete and PHI-safe enough for tier 3 review |
| `FIELD EVIDENCE: READ_ONLY_READY` | The read-only Windows run is valid, but sandbox/go-live evidence remains incomplete |
| `FIELD EVIDENCE: BLOCKED` | Required step failed, was skipped, is missing evidence, or report contains unsafe tokens |

This validator is intentionally strict. If it blocks a report, fix the field evidence or record a real blocker; do not weaken the validator to make an incomplete run look complete.

The field evidence JSON must point to a reviewed [evidence-attachment-manifest.md](./evidence-attachment-manifest.md) file. The validator loads that referenced manifest, requires it to be `ATTACHMENT MANIFEST: READY`, and verifies that the manifest `clinicLabel`/`evidenceId` match the field report `machine.label`. Raw screenshots/logs stay outside the repository in the secure internal tracker.
