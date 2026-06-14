# Pilot issue report template (no PHI)

**Purpose:** Copy this template into your internal tracker, support email, or a PHI-safe field evidence attachment note. Use **fictional** machine names and **sandbox** paths only; this template is not a substitute for filed Windows field evidence JSON.

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
| **Severity** | See [Severity guide](#severity-guide) — Blocker / Major / Minor / Question |
| **Screen / area** | Exact route — see [Screen / area guide](#screen--area-guide) |
| **First seen** | Date (UTC or local) |

### Severity guide

| Level | Use when | Examples |
| --- | --- | --- |
| **Blocker** | Cannot proceed with pilot script; data safety concern; app unusable | App will not launch; bridge never connects after IT steps; sandbox write committed without backup; restore failed with no rollback |
| **Major** | Core workflow broken but workaround exists | Mirror import fails repeatedly; one sandbox write workflow fails; Settings checklist red on required row |
| **Minor** | Cosmetic, confusing copy, or non-blocking warn | Tooltip wrong; partial mirror warn-only when documented; SmartScreen extra click |
| **Question** | Scope, policy, or “is this expected?” | Unsupported feature prompt; UNC warning on valid share; installer not bundled |

Before filing: check [windows-pilot-troubleshooting-pack.md](./windows-pilot-troubleshooting-pack.md) for the matching symptom — note which section you tried.

### Screen / area guide

Record the **exact** surface where the issue appeared (pick one primary; add sub-area in notes):

| Area | What to record |
| --- | --- |
| **Setup** | First-run window — which field (DATA_ROOT / SQLITE_PATH / BACKUP_DIR / writeMode) |
| **Today** | Dashboard / day view — not patient row content |
| **Patients** | List vs detail vs search — **crop lists** in screenshots |
| **Schedule** | Calendar / time grid — **crop appointment rows** |
| **Profile tab** | Which sub-tab (demographics, chart, etc.) — no PHI in title |
| **Settings** | Pilot readiness / Pilot build card / checklist row name |
| **Write panel** | Workflow: status update / time move / create / demographics |
| **Bridge / health** | Offline, timeout, port — from Settings only |
| **Import CLI** | Mirror import step — category only (stale / partial / failed) |
| **Desktop shell** | Blank UI, crash on launch, Re-open setup |

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
| **Expected** | What should have happened (from handoff pack, execution script step, or checklist row #) |
| **Actual** | What happened — error **category** only (e.g. “bridge offline after 60s”, “EPERM on backup folder”) |

Include **one** checklist or script step ID when applicable (e.g. `EXEC-7`, checklist §5.4).

---

## Safe screenshots (PHI-safe)

Screenshots help IT and engineering when they show **UI chrome and status**, not clinic data.

| Do | Do not |
| --- | --- |
| Crop to Settings pilot checklist, build card, bridge status, setup fields | Full Patients or Schedule grids with names |
| Blur or omit patient list columns before saving | Profile tab with demographics visible |
| Capture error **category** text from dialogs (no stack dumps with paths) | Window titles that include patient search terms |
| Use fictional machine labels in filename — e.g. `CLINIC-PC-01-settings-checklist.png` | Attach screenshots to public channels without IT review |

**How to crop (Windows):**

1. **Snipping Tool** or **Win+Shift+S** — select only the checklist panel or setup form.
2. Open in **Photos** or **Paint** — crop again if any name column is visible.
3. If you must show a list row for layout bugs, replace names with `Patient A` / `Patient B` in notes instead of capturing real rows.

More symptom-specific steps: [windows-pilot-troubleshooting-pack.md § Safe logs and support hygiene](./windows-pilot-troubleshooting-pack.md#safe-logs-and-support-hygiene).

---

## Safe log export (PHI-safe)

Export **summaries** for internal tickets — not raw files with paths or row data.

| Source | Safe export steps | Never attach |
| --- | --- | --- |
| **Settings → Pilot build card** | Copy `packageVersion`, `appVersion`, `gitCommit` (or screenshot cropped to card only) | Full desktop window with patient data behind modal |
| **`RELEASE-MANIFEST.json`** | Copy `packageVersion`, `releaseChannel`, `unsupportedFeatures` keys only | Entire manifest in public ticket if it embeds local paths |
| **Bridge / launch console** | Copy last 20 lines; redact `C:\…` paths → `C:\ClinicData\…\DATA` pattern only | Full console scrollback with import row errors |
| **`%AppData%\Microdent\config.json`** | IT local review only — note `writeMode` and path **class** (local / UNC / spaced) | File attachment or paste of full JSON in shared tracker |
| **`%AppData%\Microdent\logs\`** (if folder exists) | IT exports to secure share; redact per [phase-8-log-redaction-review.md](./phase-8-log-redaction-review.md) | Log zip in email or public repo |

Open config folder locally: **Win+R** → `%AppData%\Microdent`

Redaction rules: [Redaction rules](#redaction-rules) below · full policy [phase-8-log-redaction-review.md](./phase-8-log-redaction-review.md).

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
Severity: (Blocker / Major / Minor / Question)
Screen/area: (exact route — see template guide)

Steps:
1.
2.

Expected:
Actual:

Troubleshooting pack section tried: (e.g. Bridge offline)
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
Screenshot: (yes — cropped / no)
Log summary: (build card fields only / none)
Contact: (internal ticket # or IT email — fictional OK)
```

---

## Contact / escalation (placeholder)

Replace with your clinic’s real queue before field test. **Fictional example only:**

| Channel | Example (do not use as-is) |
| --- | --- |
| **Internal IT email** | `it-helpdesk@example-clinic.local` |
| **Ticket queue** | ServiceNow / Jira project `CLINIC-PILOT` |
| **Pilot coordinator** | `pilot-coordinator@example-clinic.local` |
| **Urgent blocker** | IT desk extension `x5500` — app won’t launch or data path concern |

**Include in every ticket:** severity, screen/area, steps, expected vs actual, package version, machine label (fictional OK). Attach nothing from [Safe log export](#safe-log-export-phi-safe) redaction list.

After a full field run, also file pass/fail on [windows-pilot-field-result-form.md](./windows-pilot-field-result-form.md) (or `qa-runs/TEMPLATE-windows-field-run.md` copy) — defects go here; the result form is the run summary.

---

## Related docs

| Doc | Use when |
| --- | --- |
| [windows-pilot-troubleshooting-pack.md](./windows-pilot-troubleshooting-pack.md) | Try operator actions before filing; map symptom to section |
| [windows-pilot-field-result-form.md](./windows-pilot-field-result-form.md) | PHI-safe pass/fail after full field script (separate from defects) |
| [windows-pilot-field-execution-script.md](./windows-pilot-field-execution-script.md) | Step IDs for reproduce steps |
| [PILOT-START-HERE.md](./PILOT-START-HERE.md) | Operator index |
| [PILOT-HANDOFF-PACK.md](./PILOT-HANDOFF-PACK.md) | Staged package walkthrough |
| [windows-pilot-real-machine-checklist.md](./windows-pilot-real-machine-checklist.md) | Field matrix + execution log |
| [windows-pilot-permission-and-path-risks.md](./windows-pilot-permission-and-path-risks.md) | ACL, UNC, drive letters, backup writability |
| [pilot-tester-guide.md](./pilot-tester-guide.md) | Guided day 1–3 script |
| [out-of-scope-guardrails.md](./out-of-scope-guardrails.md) | Unsupported features |
