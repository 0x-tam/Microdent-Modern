# Distribution readiness record — TEMPLATE

**PHI statement:** This file contains no real patient data, clinic DBF rows, telemetry, or local paths.

**Review date:** YYYY-MM-DD
**Package version:** `pilot-YYYY-MM-DD`
**Channel:** direct-signed-download / partner-handoff / public-website
**Reviewer:**

## Evidence checklist

| Row | Pass | Fail | Evidence |
| --- | --- | --- | --- |
| Signed installer or approved channel artifact exists | ☐ | ☐ | |
| Download integrity / manifest verification documented | ☐ | ☐ | |
| Release notes reviewed | ☐ | ☐ | |
| Unsupported features listed honestly | ☐ | ☐ | |
| Marketing claims reviewed against evidence | ☐ | ☐ | |
| Support path published | ☐ | ☐ | |
| Privacy/security review complete | ☐ | ☐ | |

## Marketing claim review

| Claim | Allowed? | Notes |
| --- | --- | --- |
| Local-first Windows clinic app | yes / no | |
| Signed installer | yes / no | Requires signing evidence |
| Auto-update | yes / no | Requires update evidence |
| Clinic-ready | yes / no | Requires commercial gate ready |

## Commercial evidence mapping

| Field | Ready? | Evidence |
| --- | --- | --- |
| `distribution.status` | yes / no | |
| `distribution.downloadIntegrity` | yes / no | |
| `distribution.releaseNotesReady` | yes / no | |
| `distribution.marketingClaimsReviewed` | yes / no | |
| `distribution.supportPathPublished` | yes / no | |
