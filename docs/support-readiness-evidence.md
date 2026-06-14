# Support readiness evidence

**Purpose:** Capture PHI-safe proof that the commercial support path is ready before launch.

**Schema:** `microdent-support-readiness/v1`

**Template:** [TEMPLATE-support-readiness-evidence.json](../qa-runs/TEMPLATE-support-readiness-evidence.json)

**Validator:**

```bash
pnpm pilot:commercial-launch-packet -- --date YYYY-MM-DD --clinic-label CLINIC-PC-01
pnpm pilot:support-readiness -- qa-runs/YYYY-MM-DD-support-readiness-evidence.json
```

Use `--repo-root <path>` only when validating support readiness evidence from an alternate checkout/evidence bundle.

Run the commercial launch packet before support evidence collection so support, license, distribution, pricing, marketing, and final commercial readiness evidence targets stay aligned.

## What This Proves

`SUPPORT READINESS: READY` means the filed evidence claims all of the following:

- Support KB is staged and reviewed.
- Issue template and triage workflow are staged and adopted.
- Safe evidence and PHI stop rules are understood.
- Backup/restore and installer/update rollback paths are documented.
- Support and IT leads signed off.

## Current Status

The portable pilot has support docs and templates, but commercial readiness still needs filed support evidence plus external field/signing/installer/update/pilot evidence.
