# Licensing readiness

**Purpose:** Guardrails and evidence requirements for a future Microdent Modern commercial license mechanism.

**Status today:** Offline license format, PHI-safe validator, and local-only
runtime status display are implemented for commercial evidence prep. The
portable pilot must not hard-enforce licenses or call a license service.

**Mechanism:** [offline-license-mechanism.md](./offline-license-mechanism.md)

**Validator:**

```bash
pnpm license:validate -- qa-runs/YYYY-MM-DD-offline-license-CLINIC-PC-01.json --public-key keys/microdent-license-public.pem
```

Use `--repo-root <path>` only when validating an offline license and public key from an alternate checkout/evidence bundle.

## Recommended first model

Start with **per-clinic perpetual license** for the first commercial release:

- License file installed locally by IT.
- Signed license payload, verified offline by the app using the `microdent-offline-license/v1` format.
- Settings displays local-only license status from `GET /v1/meta/license-status`
  without returning paths, raw signatures, telemetry, or PHI.
- No license check may transmit PHI, patient counts, schedule data, DBF rows, local paths, or usage telemetry.
- Expiry or invalid license must degrade gracefully according to sponsor policy, preferably read-only access with clear support copy rather than a hard lockout.

Subscription or tiered pricing can be revisited after field pilots, but any network licensing requires explicit privacy and security review.

## Required evidence before implementation

| Evidence | Requirement |
| --- | --- |
| License model selected | `per-clinic-perpetual`, `annual-subscription`, or `tiered-subscription` |
| Offline validation design | App can validate license without internet access |
| No-PHI transmission review | License payload and any checks exclude PHI and local paths |
| Graceful expiry behavior | Expired or invalid license behavior documented and tested |
| Safety review | Security/privacy review signs off before code ships |

## Commercial evidence mapping

Set these fields in [TEMPLATE-commercial-readiness-evidence.json](../qa-runs/TEMPLATE-commercial-readiness-evidence.json) only after the matching evidence is complete:

```json
{
  "licensing": {
  "status": "pass",
  "model": "per-clinic-perpetual",
  "licenseEvidencePath": "qa-runs/YYYY-MM-DD-offline-license-CLINIC-PC-01.json",
  "offlineValidation": true,
  "noPhiTransmission": true,
  "gracefulExpiry": true,
  "safetyReviewed": true
  }
}
```

## Out of scope for pilot RC

- Online activation.
- License-server calls from clinic machines.
- Feature gating based on patient count or usage telemetry.
- Hard lockout that blocks safe read-only access without sponsor approval.
- Any license mechanism that reuses or bypasses legacy Microdent/Sentinel licensing.

## Open decisions

| Decision | Default recommendation |
| --- | --- |
| License model | Per-clinic perpetual for first commercial release |
| License file location | `%ProgramData%\MicrodentModern\license.json` or installer-managed equivalent |
| Grace period | Sponsor decision; document before implementation |
| Support override | Offline signed override file only, not a support-server dependency |
