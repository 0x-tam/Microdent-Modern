# Licensing readiness record — TEMPLATE

**PHI statement:** This file contains no real patient data, clinic DBF rows, telemetry, or local paths.

**Review date:** YYYY-MM-DD
**Package version:** `pilot-YYYY-MM-DD`
**Reviewer:**

## Model decision

| Field | Value |
| --- | --- |
| Selected model | per-clinic-perpetual / annual-subscription / tiered-subscription |
| Offline validation design reviewed | yes / no |
| License file location chosen | yes / no |
| Grace period behavior chosen | yes / no |

## Safety checklist

| Row | Pass | Fail | Evidence |
| --- | --- | --- | --- |
| No PHI in license payload | ☐ | ☐ | |
| No patient count or usage telemetry required | ☐ | ☐ | |
| No network dependency for core use | ☐ | ☐ | |
| Expiry degrades gracefully | ☐ | ☐ | |
| Support override design avoids server dependency | ☐ | ☐ | |
| Legacy Microdent/Sentinel licensing not bypassed | ☐ | ☐ | |

## Commercial evidence mapping

| Field | Ready? | Evidence |
| --- | --- | --- |
| `licensing.status` | yes / no | |
| `licensing.offlineValidation` | yes / no | |
| `licensing.noPhiTransmission` | yes / no | |
| `licensing.gracefulExpiry` | yes / no | |
| `licensing.safetyReviewed` | yes / no | |
