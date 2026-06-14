# Commercial readiness evidence

**Purpose:** Final evidence checklist for calling Microdent Modern sellable and clinic-ready. This is intentionally stricter than Mac-side release signoff and Windows field evidence.

**Template:** [TEMPLATE-commercial-readiness-evidence.json](../qa-runs/TEMPLATE-commercial-readiness-evidence.json)

**Validator:**

```bash
pnpm pilot:commercial-readiness -- qa-runs/YYYY-MM-DD-commercial-readiness-evidence.json --public-key keys/microdent-license-public.pem
```

Use `--repo-root <path>` only when validating a commercial readiness report and referenced evidence files from an alternate checkout/evidence bundle.

**Preflight status:**

```bash
pnpm pilot:evidence-collection-packet -- --date YYYY-MM-DD --clinic-label CLINIC-PC-01 --public-key keys/microdent-license-public.pem --write
pnpm pilot:commercial-launch-packet -- --date YYYY-MM-DD --clinic-label CLINIC-PC-01 --public-key keys/microdent-license-public.pem
pnpm pilot:commercial-evidence-status -- --public-key keys/microdent-license-public.pem
```

Run [evidence-collection-packet.md](./evidence-collection-packet.md) first when coordinating the full package-verification, field, and commercial evidence run. It writes a PHI-safe Markdown command packet only; it does not create evidence JSON or approve readiness.

Run `pnpm pilot:commercial-launch-packet -- --date YYYY-MM-DD --clinic-label CLINIC-PC-01 --public-key keys/microdent-license-public.pem` before support/licensing/distribution/pricing/marketing evidence collection. It prints the target filenames and validator commands without creating fake JSON evidence. Then run the preflight before assembling the final commercial readiness JSON. It scans non-template `qa-runs/*.json` reports and prints which commercial evidence families are still missing or invalid.

## What this proves

`COMMERCIAL READINESS: READY` means the evidence file claims all of the following, the validator found no placeholders or PHI-sensitive tokens, and every referenced evidence JSON exists and validates:

- Mac-side strict signoff and manifest verification passed.
- Windows staged-package verification evidence is filed through [windows-package-verify-evidence.md](./windows-package-verify-evidence.md), and the Windows field evidence JSON references it with `packageVerification.evidencePath`.
- Windows field evidence is `ready`.
- Field screenshots/signoff outputs are represented by a filed [evidence-attachment-manifest.md](./evidence-attachment-manifest.md), with raw attachments kept outside the repository.
- `pnpm pilot:evidence-repo-guard` passes, confirming `qa-runs/` contains PHI-safe metadata/templates instead of raw screenshots, PDFs, logs, data files, or archives.
- Windows 10, Windows 11, and antivirus/endpoint validation passed, with a filed [windows-compatibility-evidence.md](./windows-compatibility-evidence.md) report.
- Authenticode certificate and signed app/installer verification passed, with a filed [signed-artifact-evidence.md](./signed-artifact-evidence.md) report.
- Installer clean install, upgrade, uninstall/data-preservation, shortcut behavior, Add/Remove Programs entry, first-run launch, and data-outside-install behavior passed, with a filed [installer-evidence.md](./installer-evidence.md) report.
- Auto-update channel, signed update payload, data preservation, rollback, operator notice, offline recovery, and privacy review passed, with a filed [auto-update-evidence.md](./auto-update-evidence.md) report.
- At least one real clinic pilot report is filed through [clinic-pilot-report-evidence.md](./clinic-pilot-report-evidence.md) and issues are triaged.
- [support-knowledge-base.md](./support-knowledge-base.md), [pilot-feedback-triage-workflow.md](./pilot-feedback-triage-workflow.md), [support-readiness-checklist.md](./support-readiness-checklist.md), and [support-readiness-evidence.md](./support-readiness-evidence.md) are complete and signed off.
- [licensing-readiness.md](./licensing-readiness.md) and [offline-license-mechanism.md](./offline-license-mechanism.md) prove signed offline/no-PHI licensing design and expiry behavior.
- [distribution-readiness.md](./distribution-readiness.md) and [distribution-evidence.md](./distribution-evidence.md) prove channel, integrity, release notes, support path, and marketing claims review.
- [pricing-readiness.md](./pricing-readiness.md) and [pricing-evidence.md](./pricing-evidence.md) prove pricing does not depend on PHI or usage telemetry and that `pricing.pricingEvidencePath` points to approved evidence.
- [marketing-readiness.md](./marketing-readiness.md) and [marketing-evidence.md](./marketing-evidence.md) prove public/sponsor claims match actual evidence and that `marketing.marketingEvidencePath` points to approved evidence.
- [go-live-evidence.md](./go-live-evidence.md) proves final go/no-go approval and that `goLive.goLiveEvidencePath` points to approved evidence.

## Expected status today

The current portable pilot should return:

```text
COMMERCIAL READINESS: BLOCKED
```

That is the correct result until external Windows/signing/installer/update/pilot evidence exists. Do not weaken this validator to make a pilot RC look commercially complete.

The command validates referenced reports such as `fieldEvidence.reportPath`, `windowsValidation.compatibilityReportPath`, `signing.signedArtifactEvidencePath`, `installer.installerEvidencePath`, `autoUpdate.autoUpdateEvidencePath`, `pilotReports[].reportPath`, `supportReadiness.supportEvidencePath`, `licensing.licenseEvidencePath`, `distribution.distributionEvidencePath`, `pricing.pricingEvidencePath`, `marketing.marketingEvidencePath`, and `goLive.goLiveEvidencePath`.

It also checks bundle consistency: field evidence must load a ready attachment manifest with matching machine identity, installer/update/distribution evidence must point to the same signed-artifact evidence, pricing evidence must point to the same license evidence and model, pilot/go-live evidence must point to the same field/support reports, and distribution channel must match the commercial summary.

Use `--public-key` or `MICRODENT_LICENSE_PUBLIC_KEY` so the referenced offline license evidence can be signature-verified as part of the final commercial gate.

## PHI rules

- No patient names, chart numbers, phone numbers, DBF rows, raw logs, or raw `config.json`.
- Use clinic labels such as `CLINIC-PC-01`, not patient or staff names.
- Reference separate filed reports by path, not by copying sensitive contents.

## Relationship to other gates

| Gate | Scope |
| --- | --- |
| `pnpm strict-signoff:local` | PHI-free Mac-side strict signoff rehearsal |
| `pnpm pilot:package-verify-evidence` | Machine-readable Windows staged-package verification evidence required before field evidence |
| `pnpm pilot:attachment-manifest` | Machine-readable redacted attachment metadata and hash manifest |
| `pnpm pilot:evidence-repo-guard` | Repository-level guard that keeps raw evidence attachments and data files out of `qa-runs/` |
| `pnpm pilot:field-evidence` | Machine-readable Windows field execution evidence that references validated package proof through `packageVerification.evidencePath` |
| `pnpm pilot:windows-compatibility` | Machine-readable Windows 10/11 and endpoint/AV matrix evidence |
| `pnpm pilot:signed-artifacts` | Machine-readable Authenticode app/installer signing evidence |
| `pnpm pilot:installer-evidence` | Machine-readable signed installer install/upgrade/uninstall evidence |
| `pnpm pilot:auto-update-evidence` | Machine-readable signed update, rollback, and privacy evidence |
| `pnpm pilot:clinic-report` | Machine-readable PHI-safe clinic pilot outcome and issue-triage evidence |
| `pnpm pilot:commercial-launch-packet` | PHI-safe packet for support, licensing, distribution, pricing, marketing, and commercial-readiness evidence targets |
| `pnpm pilot:support-readiness` | Machine-readable support KB, issue workflow, rollback, training, and signoff evidence |
| `pnpm pilot:distribution-evidence` | Machine-readable distribution channel, artifact integrity, claims, support path, and privacy/security evidence |
| `pnpm pilot:pricing-evidence` | Machine-readable pricing, license alignment, support terms, telemetry independence, and sponsor approval evidence |
| `pnpm pilot:marketing-evidence` | Machine-readable marketing claim, disclosure, privacy review, packet approval, and safe-screenshot evidence |
| `pnpm pilot:go-live-evidence` | Machine-readable final go/no-go approval plus referenced package, field, clinic pilot, support, and commercial readiness evidence files |
| `pnpm license:validate` | Machine-readable signed offline license evidence |
| `pnpm pilot:evidence-collection-packet` | PHI-safe master command packet for field, installer, update, commercial launch, go-live, filing-plan, repo guard, status, and completion audit steps |
| `pnpm pilot:evidence-filing-plan` | PHI-safe packet command, target filename, and validator checklist for filed package-verification, field, and commercial evidence |
| `pnpm pilot:commercial-evidence-status` | Preflight scanner for missing or invalid non-template commercial evidence reports |
| `pnpm pilot:commercial-readiness` | Final sellable-product evidence across field, signing, installer, update, pilots, support, distribution, pricing, marketing, licensing, and go-live approval |
