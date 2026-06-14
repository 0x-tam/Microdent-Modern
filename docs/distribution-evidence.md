# Distribution evidence

**Purpose:** Capture PHI-safe proof that the commercial release channel is ready.

**Schema:** `microdent-distribution-evidence/v1`

**Template:** [TEMPLATE-distribution-evidence.json](../qa-runs/TEMPLATE-distribution-evidence.json)

**Validator:**

```bash
pnpm pilot:commercial-launch-packet -- --date YYYY-MM-DD --clinic-label CLINIC-PC-01
pnpm pilot:distribution-evidence -- qa-runs/YYYY-MM-DD-distribution-evidence.json
```

Use `--repo-root <path>` only when validating distribution evidence from an alternate checkout/evidence bundle.

Run the commercial launch packet before distribution evidence collection so the signed artifact, support path, pricing, marketing, license, and final commercial-readiness references remain consistent.

## What This Proves

`DISTRIBUTION EVIDENCE: READY` means the filed evidence claims all of the following:

- Channel is selected.
- Signed release artifact and SHA-256 identity are recorded.
- Download integrity is documented.
- Release notes and unsupported-feature disclosure are ready.
- Marketing claims were reviewed against actual evidence.
- Support path is published.
- Privacy/security review is complete.

## Current Status

The portable pilot has a staged handoff package, but commercial distribution remains blocked until signed artifacts, installer/update proof, support evidence, marketing review, and go-live approval exist.
