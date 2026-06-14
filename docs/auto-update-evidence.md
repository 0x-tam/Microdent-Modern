# Auto-update evidence

**Purpose:** Capture PHI-safe proof that a signed update channel preserves data, supports rollback, and does not upload PHI or local paths before commercial release.

**Schema:** `microdent-auto-update-evidence/v1`

**Template:** [TEMPLATE-auto-update-evidence.json](../qa-runs/TEMPLATE-auto-update-evidence.json)

**Validator:**

```bash
pnpm pilot:auto-update-packet -- --date YYYY-MM-DD --channel internal-signed-feed
pnpm pilot:auto-update-evidence -- qa-runs/YYYY-MM-DD-auto-update-evidence.json
```

Use `--repo-root <path>` only when validating auto-update evidence from an alternate checkout/evidence bundle.

Run the packet command before an update-channel validation session. It prints the signed-artifact evidence target, auto-update evidence target, update install, rollback, offline recovery, privacy review, operator notice, repo guard, and commercial-readiness follow-up commands.

## What this proves

`AUTO UPDATE EVIDENCE: READY` means the filed evidence claims all of the following, and the validator found no placeholders, PHI-sensitive tokens, raw logs, or local user paths:

- Update channel is selected and access-controlled.
- Update payload is signed and has a SHA-256 identity.
- Signed-artifact evidence is referenced.
- Update install passed on Windows.
- Rollback was proven on Windows.
- Operator data, config, local copy, backups, and logs are preserved.
- Restart and offline recovery behavior are documented.
- Privacy review confirms no PHI or local paths are uploaded by update checks.
- Operator-facing update notice is ready.

## Evidence rules

- Do not paste raw update logs if they include local paths or user names.
- Use support-safe machine labels such as `WIN11-CLINIC-PC-01`.
- Use relative payload paths such as `updates/MicrodentModernUpdate.exe`.
- Reference signed-artifact evidence instead of duplicating signing proof.
- Do not mark commercial readiness ready until this evidence, installer evidence, and signing evidence all pass.

## Current status

The portable pilot has no auto-update feed. This validator defines the production evidence gate; it does not add update dependencies or enable network update checks.
