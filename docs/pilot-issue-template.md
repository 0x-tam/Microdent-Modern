# Pilot issue report template (no PHI)

**Purpose:** Copy this template into your internal tracker, email, or `qa-runs/` field log. Use **fictional** machine names and **sandbox** paths only.

**Do not paste:** patient names, chart numbers, phones, addresses, insurance IDs, DBF contents, live `config.json`, or production legacy paths.

**Staged package:** Intended for `MicrodentModern/docs/pilot-issue-template.md` once the release staging docs list includes this file (see [PILOT-HANDOFF-PACK.md](./PILOT-HANDOFF-PACK.md) §10).

---

## Environment

| Field | What to record |
| --- | --- |
| **Windows version** | e.g. `Windows 11 23H2` (Settings → System → About) |
| **Package version** | `packageVersion` from `RELEASE-MANIFEST.json` at package root (e.g. `pilot-2026-05-24`) — not clinic data |
| **Release channel** | `releaseChannel` from manifest (pilot builds: `pilot`) |
| **Node on PATH** | `node -v` output only (e.g. `v22.11.0`) |
| **Machine label** | Fictional IT asset id only — e.g. `CLINIC-PC-01` |
| **Operator profile** | Domain\username is OK if IT policy allows — no patient context |

---

## Package and paths (synthetic examples only)

| Field | Example (replace with your sandbox labels) |
| --- | --- |
| **Unpack location** | `C:\Microdent\MicrodentModern\` — local drive, not `%TEMP%` only |
| **Install verified** | `pnpm pilot:verify-release` on build machine: pass / fail / n/a (clinic PC) |
| **DATA_ROOT class** | Local drive / spaced path / UNC — **do not** paste live legacy tree |
| **writeMode** | `disabled` / `enabled` (value only — not full config file) |

Path rules: [windows-pilot-data-locations.md](./windows-pilot-data-locations.md).

---

## Issue summary

| Field | Your notes |
| --- | --- |
| **Title** | One line — symptom only (no patient names) |
| **Severity** | Blocker / major / minor / question |
| **Screen / area** | Today / Patients / Schedule / Profile tab / Settings / setup / bridge / import CLI / write panel |
| **First seen** | Date (UTC or local) |

---

## Steps to reproduce

1. (Operator action — e.g. “Launch desktop from `app\` after extract.”)
2. …
3. …

Use **sandbox** paths in steps, e.g. `C:\ClinicData\PilotSandbox\DATA`, not production Microdent-Legacy.

---

## Expected vs actual

| | |
| --- | --- |
| **Expected** | What should have happened (from handoff pack or checklist row) |
| **Actual** | What happened — error **category** only (e.g. “bridge offline after 60s”) |

---

## Diagnostics (PHI-safe)

| Field | Include | Do not include |
| --- | --- | --- |
| **Settings pilot checklist** | Which rows warn/fail (screenshot OK — crop patient lists) | Patient names in screenshot |
| **Bridge** | Connected / offline; port number if changed from 17890 | Full `%AppData%` config dump |
| **Mirror** | stale / partial / failed / OK (from Settings refresh) | SQLite file attachment |
| **Writes (if sandbox)** | `operationId`, audit terminal status, workflow name | DBF files, backup folder listing with PHI |
| **Manifest verify** | `pnpm pilot:verify-manifest`: pass / fail / n/a | Tampered hash values in public tickets |
| **Checkpoints** | `pilot:release-signoff` / `qa:sandbox`: pass / fail / skipped | Sandbox DATA_ROOT path to production legacy |

Checklist reference: [windows-pilot-real-machine-checklist.md](./windows-pilot-real-machine-checklist.md).

---

## Redaction rules

Before sending externally or posting in a shared repo:

- Replace real clinic names with `Example Clinic`.
- Replace real drive letters with `X:` only if needed for pattern description.
- Redact `\\fileserver\...` UNC paths — describe as “UNC DATA_ROOT” without share name.
- Remove lines that echo DBF field values (`PAT_NAME`, phones, notes).
- Attach **no** `.dbf`, `.sqlite`, `.env`, or `config.json` files.

---

## Copy-paste block

```text
=== Microdent Modern pilot issue (no PHI) ===

Windows: 
Node: 
Package version (RELEASE-MANIFEST packageVersion): 
Release channel: 
Machine label: 
Unpack: C:\Microdent\MicrodentModern\  (example)

Title:
Severity:
Screen/area:

Steps:
1.
2.

Expected:
Actual:

Settings checklist rows (warn/fail):
Bridge:
Mirror:
writeMode:

Writes (if any):
  operationId:
  audit status:
  workflow: statusUpdate | timeMove | create | demographics

Build-machine checks (if known):
  pilot:verify-release:
  pilot:verify-manifest:
  qa:sandbox / release-signoff:

Attachments: none (no DBF/sqlite/config)
```

---

## Related docs

| Doc | Use when |
| --- | --- |
| [PILOT-START-HERE.md](./PILOT-START-HERE.md) | Operator index |
| [PILOT-HANDOFF-PACK.md](./PILOT-HANDOFF-PACK.md) | Staged package walkthrough |
| [windows-pilot-real-machine-checklist.md](./windows-pilot-real-machine-checklist.md) | Field matrix + execution log |
| [pilot-tester-guide.md](./pilot-tester-guide.md) | Guided day 1–3 script |
| [out-of-scope-guardrails.md](./out-of-scope-guardrails.md) | Unsupported features |
