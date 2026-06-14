# Windows pilot — release notes

**Package:** `MicrodentModern/` portable handoff  
**Channel:** `pilot`  
**packageVersion:** `pilot-YYYY-MM-DD` — replace with value from `RELEASE-MANIFEST.json` on your machine

**Start here on clinic PCs:** [FIELD-TEST-START-HERE.md](./FIELD-TEST-START-HERE.md) · full index [PILOT-START-HERE.md](./PILOT-START-HERE.md)

---

## What works in this pilot

| Area | Capability |
| --- | --- |
| **Read-only viewer** | Today, Patients search, Schedule navigation, patient profile tabs (read-only) over a **copied sandbox** DATA tree + SQLite mirror |
| **Desktop setup** | First-run paths for `DATA_ROOT`, `SQLITE_PATH`, `BACKUP_DIR`; config saved to `%AppData%\Microdent\config.json` |
| **Bridge** | Local bridge on port **17890**; Settings **Pilot readiness** checklist |
| **Mirror import** | CLI-only safe import from a repo checkout or documented PowerShell flow |
| **Sandbox writes** (when IT enables) | Four workflows only: appointment status update, time move, create, patient demographics update |
| **Backup / restore** | Sandbox backup verify and restore on disposable DATA — not production legacy |

---

## Scope tiers

| Tier | Meaning | Operator action |
| --- | --- | --- |
| **Read-only pilot** | View clinic data from sandbox copy; `writeMode` **disabled** | Complete setup + mirror + read-only QA |
| **Sandbox pilot** | Same as above plus four allowlisted write workflows | IT enables write mode; `BACKUP_DIR` required before first commit |
| **Unsupported** | Out of product scope for this RC | UI must not promise these — see manifest `unsupportedFeatures` |

**Unsupported in this RC** (also in `RELEASE-MANIFEST.json` → `unsupportedFeatures`):

- payments
- ledger writes
- chart writes
- in-app mirror import
- installer (NSIS/MSI)

Detail: [out-of-scope-guardrails.md](./out-of-scope-guardrails.md).

---

## Known caveats

| Caveat | Impact |
| --- | --- |
| **No installer** | IT extracts a folder; no signed MSI/NSI auto-update |
| **No code signing** | SmartScreen may warn on first Electron launch — expected until signing spike |
| **Node 22 runtime** | Preferred: staged `node/` runtime validated with `pnpm pilot:node-runtime-check`; fallback: `node.exe` on PATH or `MICRODENT_NODE_BINARY` |
| **Local copy refresh** | First-run setup prepares the local copy automatically; Settings can refresh it without CLI |
| **Partial mirror warn-only** | Settings may show partial/stale mirror status — DBF remains write source of truth |
| **Audit strongest on status update** | Other sandbox workflows have lighter audit surfacing — capture `operationId` from write feedback |
| **Bash scripts in repo** | `qa:sandbox` is Node; bash fallbacks still need Git Bash/WSL on Windows. Prefer PowerShell flows in staged docs |

Permission and path risks: [windows-pilot-permission-and-path-risks.md](./windows-pilot-permission-and-path-risks.md).

---

## How to run the field test

1. IT verifies package: [windows-pilot-package-verify-on-windows.md](./windows-pilot-package-verify-on-windows.md)
2. IT files and validates package evidence: `pnpm pilot:package-verify-evidence -- qa-runs/YYYY-MM-DD-windows-package-verify-evidence-CLINIC-PC-01.json`
3. Operator follows: [windows-pilot-field-execution-script.md](./windows-pilot-field-execution-script.md)
4. Record results: [windows-pilot-field-result-form.md](./windows-pilot-field-result-form.md); final field JSON must reference the package proof via `packageVerification.evidencePath`
5. Sponsor signs off: [windows-pilot-go-no-go-checklist.md](./windows-pilot-go-no-go-checklist.md)

---

## How to report issues

Use **[pilot-issue-template.md](./pilot-issue-template.md)** — one copy per defect.

| Include | Do not attach |
| --- | --- |
| `packageVersion`, `gitCommit`, checklist row or EXEC step | Patient names, phones, DBF/sqlite files |
| Screen/area, severity, reproduce steps | Full `%AppData%\Microdent\config.json` in public tickets |
| `operationId` for write issues (sandbox) | Raw mirror CLI output with row payloads |

Troubleshooting: [windows-pilot-troubleshooting-pack.md](./windows-pilot-troubleshooting-pack.md).

**Contact (placeholder):** `pilot-support@contoso-clinic.example` or internal ticket queue **PILOT-WIN**.

---

## Related docs

| Doc | Role |
| --- | --- |
| [PILOT-HANDOFF-PACK.md](./PILOT-HANDOFF-PACK.md) | Full handoff journey |
| [windows-pilot-real-machine-checklist.md](./windows-pilot-real-machine-checklist.md) | Field matrix |
| [windows-pilot-installer-decision-record.md](./windows-pilot-installer-decision-record.md) | Installer next phase |
