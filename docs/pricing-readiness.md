# Pricing readiness

**Purpose:** Evidence requirements for a commercial pricing model that does not depend on PHI, usage telemetry, or network availability.

**Status today:** Not approved for commercial launch. The pilot RC has no pricing enforcement.

## Recommended first pricing model

Start with **per-clinic pricing** for the first commercial release:

- One clinic license covers the agreed pilot/commercial scope.
- Support terms are written separately from clinical data access.
- Pricing does not depend on patient count, schedule volume, appointment count, or usage telemetry.
- Any future subscription/tiered model must pass licensing and privacy review before implementation.

## Required evidence

| Evidence | Requirement |
| --- | --- |
| Model chosen | `per-clinic`, `subscription`, or `tiered` |
| License alignment | Pricing scope matches [licensing-readiness.md](./licensing-readiness.md) |
| Support terms | Response windows, update terms, and field support scope defined |
| No telemetry dependency | No patient/usage data is required to compute price |
| Sponsor approval | Product/clinic sponsor signs off |

## Machine-readable evidence

Create `qa-runs/YYYY-MM-DD-pricing-evidence.json` from [TEMPLATE-pricing-evidence.json](../qa-runs/TEMPLATE-pricing-evidence.json), then validate it:

```bash
pnpm pilot:pricing-evidence -- qa-runs/YYYY-MM-DD-pricing-evidence.json
```

The command must print `PRICING EVIDENCE: READY` before `pricing.pricingEvidencePath` can be used in commercial readiness.

## Commercial evidence mapping

```json
"pricing": {
  "status": "pass",
  "model": "per-clinic",
  "pricingEvidencePath": "qa-runs/YYYY-MM-DD-pricing-evidence.json",
  "scopeMatchesLicense": true,
  "supportTermsDefined": true,
  "noUsageTelemetryDependency": true,
  "sponsorApproved": true
}
```

Create `qa-runs/YYYY-MM-DD-pricing-readiness.md` from [TEMPLATE-pricing-readiness.md](../qa-runs/TEMPLATE-pricing-readiness.md) for the human review record. The JSON evidence file is the machine-readable gate used by `pnpm pilot:commercial-readiness`.
