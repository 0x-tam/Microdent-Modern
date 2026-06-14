# Clinic pilot report evidence

**Purpose:** Capture PHI-safe commercial pilot outcome evidence after a real Windows field run and issue triage.

**Schema:** `microdent-clinic-pilot-report/v1`

**Template:** [TEMPLATE-clinic-pilot-report.json](../qa-runs/TEMPLATE-clinic-pilot-report.json)

**Validator:**

```bash
pnpm pilot:go-live-packet -- --date YYYY-MM-DD --clinic-label CLINIC-PC-01
pnpm pilot:clinic-report -- qa-runs/YYYY-MM-DD-clinic-pilot-report-CLINIC-PC-01.json
```

Use `--repo-root <path>` only when validating clinic pilot report evidence from an alternate checkout/evidence bundle.

Run the go-live packet before final pilot reporting. It prints the clinic pilot report target, triage rollup target, support readiness target, commercial readiness target, go-live evidence target, repo guard, and final audit commands.

## What this proves

`CLINIC PILOT REPORT: READY` means the filed evidence claims all of the following, and the validator found no placeholders, PHI-sensitive tokens, live legacy paths, or local user paths:

- The report references completed Windows field evidence that already references validated package verification evidence through `packageVerification.evidencePath`.
- The report references a PHI-safe pilot feedback triage rollup.
- Pilot outcome is pass/ready/go.
- Issues were triaged.
- There are no open P0/P1 issues.
- No PHI was observed in filed evidence.
- Live legacy data was not touched.
- Unsupported writes were not attempted.
- Restore did not fail after sandbox writes.
- Operator workflow and support path were accepted.
- Sponsor signoff date and role are recorded.

## Evidence rules

- Do not include patient names, chart numbers, phone numbers, DBF rows, screenshots, or raw logs.
- Use clinic labels such as `CLINIC-PC-01`, not staff or patient names.
- Reference filed field evidence and triage rollups instead of copying their contents.
- Do not proceed with pilot reporting until `pnpm pilot:package-verify-evidence` has passed for the staged package used by the field run.
- Do not use this report to bypass `pnpm pilot:field-evidence`; the field evidence must pass separately.

## Current status

No real clinic pilot report is filed in this repo yet. This validator defines the commercial evidence gate; it does not create external field proof.
