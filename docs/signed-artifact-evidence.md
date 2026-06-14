# Signed artifact evidence

**Purpose:** Capture PHI-safe proof that production Windows artifacts are Authenticode signed and verified before commercial release.

**Schema:** `microdent-signed-artifact-evidence/v1`

**Template:** [TEMPLATE-signed-artifact-evidence.json](../qa-runs/TEMPLATE-signed-artifact-evidence.json)

**Validator:**

```bash
pnpm pilot:installer-packet -- --date YYYY-MM-DD --target nsis
pnpm pilot:signed-artifacts -- qa-runs/YYYY-MM-DD-signed-artifact-evidence.json
```

Use `--repo-root <path>` only when validating signing evidence from an alternate checkout/evidence bundle.

For installer-bound signing work, run `pnpm pilot:installer-packet` first so signed app and signed installer verification stay paired with the installer behavior evidence.

## What this proves

`SIGNED ARTIFACTS: READY` means the filed evidence claims all of the following and the validator found no placeholders, PHI-sensitive tokens, raw logs, or local user paths:

- Authenticode certificate subject, issuer, thumbprint, validity dates, and chain status were recorded.
- App executable signature verification passed.
- Installer signature verification passed.
- RFC 3161 timestamping was verified.
- SmartScreen/reputation review was recorded.
- Evidence uses relative artifact paths only, not local machine paths.

## Evidence rules

- Do not paste raw `signtool` output if it contains local paths or user names.
- Summarize verification results in support-safe language.
- Use SHA-256 hashes for signed artifact identity.
- Record the verification command, such as `signtool verify /pa /tw`.
- Do not claim signing is complete until both the app executable and installer are signed and verified on Windows.

## Current status

The portable pilot remains unsigned. This validator is an evidence gate for the production signing track; it does not sign artifacts and does not make the current RC commercially ready.
