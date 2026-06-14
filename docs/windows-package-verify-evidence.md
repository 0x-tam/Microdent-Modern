# Windows package verification evidence

**Purpose:** PHI-safe proof that IT verified the staged `MicrodentModern/` package on a Windows handoff or clinic PC before field execution starts.

**Template:** [TEMPLATE-windows-package-verify-evidence.json](../qa-runs/TEMPLATE-windows-package-verify-evidence.json)

**Validator:**

```bash
pnpm pilot:package-verify-packet -- --date YYYY-MM-DD --clinic-label CLINIC-PC-01 --write
pnpm pilot:package-verify-evidence -- qa-runs/YYYY-MM-DD-windows-package-verify-evidence-CLINIC-PC-01.json
```

Use `--repo-root <path>` only when validating package verification evidence from an alternate checkout/evidence bundle.

Run [windows-pilot-package-verify-on-windows.md](./windows-pilot-package-verify-on-windows.md) on the Windows handoff machine first. Then copy the template to the target evidence path printed by `pnpm pilot:package-verify-packet` and fill it from the real IT result.

This evidence proves package hygiene only. It does **not** prove first-run setup, read-only smoke, sandbox writes, Windows 10/11 compatibility, or commercial readiness.

## PHI rules

- Do not paste patient names, chart numbers, phone numbers, comments, DBF rows, SQLite rows, logs, or screenshots into this JSON.
- Do not commit raw PowerShell transcripts, screenshots, archives, installers, support logs, DBF files, SQLite files, or `.env` files.
- Record relative staged-package paths only, such as `RELEASE-MANIFEST.json` and `web/pilot-build.json`.
- Store raw attachments in the approved secure tracker and reference them through [evidence-attachment-manifest.md](./evidence-attachment-manifest.md).

## Required shape

```json
{
  "schemaVersion": "microdent-windows-package-verify/v1",
  "phiStatement": "no-real-patient-data",
  "build": {
    "packageVersion": "pilot-YYYY-MM-DD",
    "appVersion": "0.0.1",
    "gitCommit": "abcdef1",
    "releaseChannel": "pilot"
  },
  "machine": {
    "label": "CLINIC-PC-01",
    "windowsVersion": "Windows 11 23H2",
    "verifierRole": "IT"
  },
  "package": {
    "rootCategory": "portable-handoff",
    "manifestPath": "RELEASE-MANIFEST.json",
    "pilotBuildPath": "web/pilot-build.json",
    "verificationDoc": "docs/windows-pilot-package-verify-on-windows.md"
  },
  "checks": {
    "layoutPresent": "pass",
    "manifestFieldsRecorded": "pass",
    "manifestSafe": "pass",
    "forbiddenArtifactsAbsent": "pass",
    "configTemplatesPlaceholders": "pass",
    "placeholderFoldersClean": "pass",
    "pilotBuildMatchesManifest": "pass",
    "operatorDocsPresent": "pass",
    "unsupportedFeaturesRecorded": "pass"
  },
  "nodeRuntimeState": "placeholder-only",
  "decision": {
    "status": "pass",
    "approverRole": "IT",
    "date": "YYYY-MM-DD",
    "attachmentManifestPath": "qa-runs/YYYY-MM-DD-evidence-attachment-manifest-CLINIC-PC-01.json"
  },
  "rawArtifactsCommitted": false,
  "rawLogsAttached": false,
  "phiObserved": false
}
```

## Ready criteria

`PACKAGE VERIFY: READY` requires:

- All package hygiene checks pass.
- Manifest and pilot build metadata are recorded and safe.
- Forbidden staged artifacts are absent.
- Config templates and placeholder folders are clean.
- Raw artifacts/logs are not committed.
- No PHI is observed.
- The decision is `pass` or IT-approved `conditional` with an attachment manifest reference.

If package verification is blocked, do not proceed to Windows field execution until the package is restaged or IT explicitly approves a conditional handoff.
