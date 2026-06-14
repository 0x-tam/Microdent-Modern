# Installer evidence

**Purpose:** Capture PHI-safe proof that a signed Windows installer behaves correctly before commercial release.

**Schema:** `microdent-installer-evidence/v1`

**Template:** [TEMPLATE-installer-evidence.json](../qa-runs/TEMPLATE-installer-evidence.json)

**Validator:**

```bash
pnpm pilot:installer-packet -- --date YYYY-MM-DD --target nsis
pnpm pilot:installer-evidence -- qa-runs/YYYY-MM-DD-installer-evidence.json
```

Use `--repo-root <path>` only when validating installer evidence from an alternate checkout/evidence bundle.

Run the packet command before a Windows installer validation session. It prints the signed-artifact evidence target, installer evidence target, clean install/upgrade/uninstall checklist, data-boundary checks, rollback checks, repo guard, and commercial-readiness follow-up commands.

## What this proves

`INSTALLER EVIDENCE: READY` means the filed evidence claims all of the following, and the validator found no placeholders, PHI-sensitive tokens, raw logs, or local user paths:

- Installer target is `nsis` or `msi`.
- Installer artifact identity is recorded with a relative path and SHA-256 hash.
- Signed-artifact evidence is referenced.
- Clean install passed on Windows.
- Upgrade install passed on Windows.
- Uninstall preserved operator data, local copy, backups, and config.
- Start menu or desktop shortcut launches the app.
- Add/Remove Programs entry exists.
- First-run setup launches after install.
- Clinic data, mirror SQLite, backups, logs, and config stay outside the install tree.
- No PHI-bearing files are bundled in the installer.
- Previous installer is available for rollback.

## Evidence rules

- Do not paste raw installer logs if they include local paths or user names.
- Use support-safe machine labels such as `WIN11-CLINIC-PC-01`.
- Use relative artifact paths such as `installer/MicrodentModernSetup.exe`.
- Reference the signed artifact evidence file instead of duplicating signing proof.
- Do not mark commercial readiness ready until this evidence and signing evidence both pass.

## Current status

The portable pilot has no NSIS/MSI installer. This validator defines the production evidence gate; it does not add installer dependencies or change the current portable release path.
