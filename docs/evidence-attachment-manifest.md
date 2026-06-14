# Evidence attachment manifest

**Purpose:** Machine-readable proof that field or commercial evidence attachments were redacted, hashed, reviewed, and stored outside the repository.

**Template:** [TEMPLATE-evidence-attachment-manifest.json](../qa-runs/TEMPLATE-evidence-attachment-manifest.json)

**Schema:** `microdent-evidence-attachment-manifest/v1`

**Validator:**

```bash
pnpm pilot:attachment-manifest -- qa-runs/YYYY-MM-DD-evidence-attachment-manifest-CLINIC-PC-01.json
pnpm pilot:evidence-repo-guard
```

Use `--repo-root <path>` only when validating an attachment manifest from an alternate checkout/evidence bundle.

## What Goes Here

Record metadata only:

- Redacted screenshot or document filename.
- SHA-256 hash of the reviewed attachment.
- Source step such as `EXEC-09` or `go-live`.
- Reviewer role and review date.
- Confirmation that PHI was not observed after redaction.
- Secure internal tracker location, not a local path.

Do **not** commit raw screenshots, raw logs, PDFs with patient context, DBF/SQLite files, archives, `.log` files, or full local paths.

Run `pnpm pilot:evidence-repo-guard` before handoff or review. It scans `qa-runs/` for raw screenshots/images, PDFs, logs, DBF/SQLite files, archives, executable attachments, and raw-evidence directory names so filed evidence remains metadata-only.

## Relationship To Field Evidence

`pnpm pilot:field-evidence` requires `attachments.manifestPath`, `attachments.redactionReviewed`, and `packageVerification.evidencePath` in the Windows field evidence JSON. It also loads the referenced attachment manifest and package verification evidence, then requires both `pnpm pilot:attachment-manifest` and `pnpm pilot:package-verify-evidence` to pass.

For Windows field evidence, `clinicLabel` must match the field report `machine.label`, and `evidenceId` must include that same machine label. Example: field evidence for `CLINIC-PC-01` should use an attachment manifest with `clinicLabel: "CLINIC-PC-01"` and an evidence id such as `FIELD-2026-06-06-CLINIC-PC-01`.

This keeps tier 3 evidence honest: the package JSON proves the staged Windows package was checked before operators started, the field JSON says which reviewed manifest supports the run, and the raw attachments remain in a secure internal tracker.
