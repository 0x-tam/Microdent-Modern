# Microdent Modern — Continuation Plan to Reach Product Completion

**Baseline:** commit `a96131b` (`merge: integrate remote productization updates`) on 2026-06-06.
**Primary source of truth:** [PRODUCT-COMPLETION-ROADMAP.md](./PRODUCT-COMPLETION-ROADMAP.md).  
**Recent handoff memory:** [SESSION-HANDOFF-2026-06-06.md](./SESSION-HANDOFF-2026-06-06.md).

## 1. Target End State

Microdent Modern is complete when it is a sellable, clinic-ready Windows desktop product with:

- One-click install and first-run setup.
- No normal operator need to start services, run CLI commands, edit environment variables, or understand DBF/SQLite internals.
- Local-only patient data handling with no cloud dependency.
- PHI-safe logs, diagnostics, crash handling, and support workflows.
- Premium, uncluttered dental-clinic UI/UX.
- Current dental chart/tooth representation preserved until real tooth assets or a validated odontogram are available.
- Real Windows clinic-machine validation, signed installer, and production support path.

## 2. What Is Already Complete

The latest committed checkpoint includes:

- Desktop first-run setup with automatic local-copy import.
- Settings quick fixes for clinic service restart, local-copy refresh, support log export, diagnostics summary, support log preview, service-port check, and safe port cleanup policy.
- PHI-safe rotating logs, sanitized support export, local crash dumps, and sanitized crash metadata preview.
- Packaged Node runtime preference and release staging validation.
- Operator-facing language cleanup: clinic service, copied clinic files, fast local copy, editing mode.
- Local-copy failure handling for unavailable, failed, partial, and incomplete states.
- Operator docs updated to Settings-first local-copy refresh with CLI only as support fallback.
- Codex attribution documented.
- Release staging, manifest verification, and sensitive-artifact guards passing as of the checkpoint.

## 3. Hard External Blockers

These cannot be fully completed from the current Mac/dev environment alone:

| Blocker | Why it blocks completion | Evidence needed |
| --- | --- | --- |
| Windows field execution `EXEC-01` through `EXEC-16` | The app has not been proven on a real clinic Windows PC. | Validated package verification evidence, completed field script, PHI-safe screenshots/log summaries, signed result form, and Windows field evidence JSON referencing `packageVerification.evidencePath`. |
| Windows 10/11 validation | Commercial target is Windows clinics. | Test matrix results on Windows 10 and 11. |
| Antivirus/endpoint validation | Clinic environments commonly lock local apps, Node, SQLite, or DBF files. | AV test notes and any required exclusions. |
| Code signing certificate | Unsigned Electron apps trigger SmartScreen and are not commercially acceptable. | Authenticode certificate, signed executable verification. |
| Signed installer | Current release is staged portable output, not a professional install flow. | Signed NSIS/MSI installer with install/uninstall proof. |
| Auto-update feed | Production support needs safe update distribution. | Update channel decision and working update test. |
| Real clinic pilot | Sellable status needs clinical feedback and operational proof. | 1-3 clinic pilot reports and issue triage. |

Commercial readiness is now explicitly audited with `pnpm pilot:commercial-readiness -- qa-runs/YYYY-MM-DD-commercial-readiness-evidence.json --public-key keys/microdent-license-public.pem`; field/commercial filing can be planned with `pnpm pilot:evidence-filing-plan -- --public-key keys/microdent-license-public.pem --clinic-label CLINIC-PC-01`; redacted attachment metadata is checked with `pnpm pilot:attachment-manifest -- qa-runs/YYYY-MM-DD-evidence-attachment-manifest-CLINIC-PC-01.json`; the evidence bundle can be preflighted with `pnpm pilot:commercial-evidence-status -- --public-key keys/microdent-license-public.pem`; signed artifact evidence is separately checked with `pnpm pilot:signed-artifacts -- qa-runs/YYYY-MM-DD-signed-artifact-evidence.json`; installer behavior evidence is separately checked with `pnpm pilot:installer-evidence -- qa-runs/YYYY-MM-DD-installer-evidence.json`; auto-update behavior evidence is separately checked with `pnpm pilot:auto-update-evidence -- qa-runs/YYYY-MM-DD-auto-update-evidence.json`; clinic pilot report evidence is separately checked with `pnpm pilot:clinic-report -- qa-runs/YYYY-MM-DD-clinic-pilot-report-CLINIC-PC-01.json`; support readiness evidence is separately checked with `pnpm pilot:support-readiness -- qa-runs/YYYY-MM-DD-support-readiness-evidence.json`; distribution evidence is separately checked with `pnpm pilot:distribution-evidence -- qa-runs/YYYY-MM-DD-distribution-evidence.json`; pricing evidence is separately checked with `pnpm pilot:pricing-evidence -- qa-runs/YYYY-MM-DD-pricing-evidence.json`; marketing evidence is separately checked with `pnpm pilot:marketing-evidence -- qa-runs/YYYY-MM-DD-marketing-evidence.json`; go-live evidence is separately checked with `pnpm pilot:go-live-evidence -- qa-runs/YYYY-MM-DD-go-live-evidence.json`; signed offline license evidence is separately checked with `pnpm license:validate -- qa-runs/YYYY-MM-DD-offline-license-CLINIC-PC-01.json --public-key keys/microdent-license-public.pem`. The current expected state is `COMMERCIAL READINESS: BLOCKED` until the external evidence above exists.

## 4. Remaining Local Work

These can be advanced before external blockers are resolved.

### 4.1 Operator Manual / Help Documentation

**Goal:** Create a clear operator manual that reflects the current Settings-first, one-click workflow.

Deliverables:

- `docs/operator-manual.md`
- Link from `PILOT-START-HERE.md` and `PILOT-HANDOFF-PACK.md`
- Sections for first-run setup, Today, Patients, Schedule, Settings, local-copy refresh, support logs, safe port policy, read-only mode, sandbox editing, and troubleshooting.
- Explicit “do not include PHI in support tickets” guidance.

Verification:

- Markdown links resolve.
- Artifact staging includes the manual.
- `pnpm test:pilot-artifacts`
- `pnpm stage:pilot-release`
- `pnpm pilot:verify-release`
- `pnpm pilot:verify-manifest`

### 4.2 Accessibility Audit

**Goal:** Establish a WCAG 2.2 AA-oriented audit path and fix high-risk issues.

Deliverables:

- Add an accessibility checklist doc or script-backed audit harness.
- Review Settings, AppShell navigation, Today, Patients, Schedule, write panels.
- Fix missing labels, focus order traps, keyboard-only flows, contrast issues, and status announcements.
- Preserve current dental chart visuals unless a validated replacement exists.

Verification:

- App tests for key keyboard/focus paths where practical.
- Static/manual audit doc with pass/fail evidence.
- `pnpm --filter @microdent/app run test`
- `pnpm --filter @microdent/app run build`

### 4.3 Performance Profiling on Clinic-Scale Data

**Goal:** Prove the UI and local-copy path can handle at least 5,000 patients and 50,000 appointments.

Deliverables:

- Synthetic data generator or fixture plan that avoids PHI.
- Performance script measuring local-copy import time, core read routes, patient search, schedule fetch, and app render-sensitive paths.
- Baseline thresholds and report output under `qa-runs/` or `docs/`.

Verification:

- Script runs locally with synthetic data.
- Report records machine, Node version, dataset size, timings, and failures.
- No generated PHI or real clinic data committed.

### 4.4 Post-Write Local-Copy Refresh Policy

**Goal:** Define and implement a safe policy for keeping search/schedule aligned after sandbox writes.

Recommended approach:

- Do not auto-run full refresh immediately after every write without field proof.
- Add a “local copy may need refresh” state after successful sandbox commits.
- Show operator-safe Settings/Today/Schedule copy directing user to **Refresh local copy**.
- Optionally add a deferred/manual prompt after write success.

Deliverables:

- Policy doc section in roadmap/operator manual.
- UI state/copy for post-write local-copy refresh needed.
- Tests proving write success does not hide stale local-copy risk.

Verification:

- App tests for post-write refresh-needed state.
- Existing sandbox write tests still pass.

### 4.5 DBF-Change-Since-Import Staleness Detection

**Goal:** Move beyond age-only stale warnings and detect when copied clinic files are newer than the local-copy import metadata.

Recommended approach:

- Record a support-safe source snapshot during import: table name, file mtime, file size, and import time. No paths, no row payloads.
- Compare current copied clinic file metadata against last import snapshot.
- Show “copied files changed since refresh” in Settings.

Deliverables:

- Import metadata schema addition.
- Bridge status addition with safe fields only.
- Settings stale callout update.
- Tests for changed, unchanged, missing, and unreadable file states.

Verification:

- Contract tests.
- Bridge route tests.
- App Settings tests.

### 4.6 Incremental Local-Copy Re-Import

**Goal:** Reduce import time by refreshing only changed tables/files where safe.

Recommended approach:

- Start with table-level incremental refresh based on source file metadata, not row-level diffing.
- Keep full import as fallback.
- Preserve atomic temp-file promotion for first-run/core refresh.
- Never use partial SQLite writes as the only copy if core tables fail.

Deliverables:

- Incremental import design doc.
- Implementation for at least low-risk reference tables first.
- Tests proving unchanged tables are skipped and changed tables refresh.

Verification:

- SQLite mirror tests.
- Desktop refresh tests.
- Performance comparison report.

### 4.7 Operator-Friendly Error Messages

**Goal:** Convert common failures into plain clinic actions without exposing internals.

Common cases:

- Clinic service offline.
- Local copy unavailable.
- Copied clinic folder invalid.
- Backup folder missing.
- Writes blocked.
- Support log export failed.
- Port conflict.
- Permission denied / antivirus lock.

Deliverables:

- Centralized error-copy mapping where practical.
- Tests for no raw paths, DBF rows, patient names, `DATA_ROOT`, `SQLITE_PATH`, or bridge jargon in primary UI.

Verification:

- App tests and desktop startup-failure tests.

### 4.8 Data Privacy Review

**Goal:** Document local-only PHI storage and support boundaries before field use.

Deliverables:

- `docs/data-privacy-review.md`
- Data location table.
- What may contain PHI vs what must not.
- Support-ticket rules.
- Crash/log/export behavior.
- Backup/local-copy retention guidance.

Verification:

- Cross-check with `windows-pilot-data-locations.md`
- Review support export tests.

### 4.9 Optional Opt-In Telemetry / Upload Design

**Goal:** Decide whether telemetry/upload exists at all. Default remains local-only.

Recommended approach:

- Keep telemetry off by default.
- Do not implement upload before privacy review and explicit opt-in design.
- If designed, limit to non-PHI operational metrics with local preview before send.

Deliverables:

- Decision record.
- Explicit out-of-scope if deferred.

## 5. Production Packaging Track

Once local docs/reviews are stronger, focus on packaging.

### 5.1 Installer

Deliverables:

- NSIS or MSI decision record if not already final.
- Installer config.
- Desktop shortcut.
- Uninstaller.
- Install location picker.
- Data directories outside install tree.
- Pre-flight checks for disk, permissions, packaged runtime, and config location.

Verification:

- Clean install on Windows.
- Upgrade install.
- Uninstall preserves operator data unless explicitly removed.
- `Microdent Modern.exe` launches first-run setup.

### 5.2 Code Signing

Deliverables:

- Authenticode certificate.
- Signing step in packaging.
- Verification docs.

Verification:

- `Get-AuthenticodeSignature` reports valid signature.
- SmartScreen behavior documented.

### 5.3 Auto-Update

Deliverables:

- Update channel decision.
- Signed update artifacts.
- Rollback plan.
- Release notes workflow.

Verification:

- Install old version, update to new version, preserve config/local data.

## 6. Windows Field Execution Track

Run after a staged package or installer candidate exists.

Required sequence:

1. Verify bundled Node 22+ or fallback Node 22+ on clinic PC.
2. Extract/install package and verify layout.
3. File package verification evidence with `pnpm pilot:package-verify-evidence -- qa-runs/YYYY-MM-DD-windows-package-verify-evidence-CLINIC-PC-01.json`.
4. Keep the package verification evidence path ready for the field report as `packageVerification.evidencePath`.
5. Run first-run setup.
6. Choose copied clinic data folder and derived paths.
7. Confirm automatic local-copy import.
8. Read-only smoke: Today, Patients, Schedule, Settings.
9. Verify clinic service health.
10. Enable sandbox writes only in disposable sandbox.
11. Test appointment status update.
12. Test appointment time move.
13. Test appointment creation.
14. Test demographics update.
15. Verify backup before writes.
16. Verify DBF readback proof.
17. Verify restore workflow.
18. Complete field result form and sign-off.

After the run, create `qa-runs/YYYY-MM-DD-windows-field-evidence-<MACHINE>.json` from `qa-runs/TEMPLATE-windows-field-evidence.json`. The field evidence must reference the already validated package proof with `packageVerification.evidencePath` and `packageVerification.verifiedBeforeFieldRun: true`, then validate it with:

```bash
pnpm pilot:field-evidence -- qa-runs/YYYY-MM-DD-windows-field-evidence-CLINIC-PC-01.json
```

`FIELD EVIDENCE: READY` requires `sandbox-signoff` mode and does not allow read-only-only evidence to masquerade as clinic go-live proof.

Do not mark the roadmap complete until this evidence exists.

## 7. Commercial Launch Track

After field execution:

- Clinical pilot with 1-3 clinics.
- Feedback collection system.
- Issue triage workflow.
- Support knowledge base, feedback triage workflow, and rollback/support readiness evidence.
- Pricing model.
- Offline/local license mechanism.
- Support knowledge base and FAQ.
- Website/marketing materials.
- Distribution channel.

## 8. Recommended Execution Order

1. Write `docs/operator-manual.md` and link it into start/handoff docs.
2. Add accessibility audit and fix the highest-risk keyboard/focus/status issues.
3. Add synthetic performance profiling.
4. Implement post-write local-copy refresh-needed state.
5. Implement DBF-change-since-import detection.
6. Decide incremental import scope and implement table-level incremental refresh if still needed.
7. Write data privacy review.
8. Build signed installer path.
9. Run Windows field execution.
10. Pilot with real clinics.
11. Finish licensing/support/marketing/distribution.

## 9. Verification Commands to Keep Running

Use these after meaningful changes:

```bash
pnpm --filter @microdent/desktop run test
pnpm --filter @microdent/app run test
pnpm --filter @microdent/app run build
pnpm --filter @microdent/web run build
pnpm --filter @microdent/desktop run build
pnpm test:pilot-artifacts
pnpm --filter @microdent/desktop run release-smoke
pnpm stage:pilot-release
pnpm pilot:verify-release
pnpm pilot:verify-manifest
pnpm pilot:package-verify-packet -- --date YYYY-MM-DD --clinic-label CLINIC-PC-01
pnpm pilot:package-verify-evidence -- qa-runs/YYYY-MM-DD-windows-package-verify-evidence-CLINIC-PC-01.json
pnpm pilot:windows-field-packet -- --date YYYY-MM-DD --clinic-label CLINIC-PC-01
pnpm pilot:attachment-manifest -- qa-runs/YYYY-MM-DD-evidence-attachment-manifest-CLINIC-PC-01.json
pnpm pilot:evidence-repo-guard
pnpm pilot:field-evidence -- qa-runs/YYYY-MM-DD-windows-field-evidence-CLINIC-PC-01.json
pnpm pilot:windows-compatibility -- qa-runs/YYYY-MM-DD-windows-compatibility-evidence.json
pnpm pilot:signed-artifacts -- qa-runs/YYYY-MM-DD-signed-artifact-evidence.json
pnpm pilot:installer-packet -- --date YYYY-MM-DD --target nsis
pnpm pilot:installer-evidence -- qa-runs/YYYY-MM-DD-installer-evidence.json
pnpm pilot:auto-update-packet -- --date YYYY-MM-DD --channel internal-signed-feed
pnpm pilot:auto-update-evidence -- qa-runs/YYYY-MM-DD-auto-update-evidence.json
pnpm pilot:clinic-report -- qa-runs/YYYY-MM-DD-clinic-pilot-report-CLINIC-PC-01.json
pnpm pilot:commercial-launch-packet -- --date YYYY-MM-DD --clinic-label CLINIC-PC-01
pnpm pilot:support-readiness -- qa-runs/YYYY-MM-DD-support-readiness-evidence.json
pnpm pilot:distribution-evidence -- qa-runs/YYYY-MM-DD-distribution-evidence.json
pnpm pilot:pricing-evidence -- qa-runs/YYYY-MM-DD-pricing-evidence.json
pnpm pilot:marketing-evidence -- qa-runs/YYYY-MM-DD-marketing-evidence.json
pnpm pilot:go-live-packet -- --date YYYY-MM-DD --clinic-label CLINIC-PC-01
pnpm pilot:go-live-evidence -- qa-runs/YYYY-MM-DD-go-live-evidence.json
pnpm license:validate -- qa-runs/YYYY-MM-DD-offline-license-CLINIC-PC-01.json --public-key keys/microdent-license-public.pem
pnpm pilot:evidence-filing-plan -- --public-key keys/microdent-license-public.pem --clinic-label CLINIC-PC-01
pnpm pilot:commercial-evidence-status -- --public-key keys/microdent-license-public.pem
pnpm pilot:commercial-readiness -- qa-runs/YYYY-MM-DD-commercial-readiness-evidence.json --public-key keys/microdent-license-public.pem
pnpm roadmap:completion-audit -- --public-key keys/microdent-license-public.pem
pnpm roadmap:local-audit
```

Use `pnpm strict-signoff:local` for the reproducible PHI-free local strict signoff rehearsal. Use `pnpm pilot:release-signoff` directly only when sandbox environment paths are already configured for the strict signoff gate.

## 10. Completion Rules

Do not mark the roadmap complete until:

- Every unchecked roadmap item is either completed with evidence or formally deferred with a decision record.
- Windows package verification evidence is filed and validated before field execution.
- Windows field execution has passed with field evidence referencing `packageVerification.evidencePath`.
- Non-template commercial readiness and go-live evidence are filed and validated for any sellable/commercial claim.
- Installer/signing/update decisions are implemented or explicitly deferred for a non-commercial pilot.
- No primary UI exposes bridge/DBF/SQLite/`DATA_ROOT`/`SQLITE_PATH` internals to normal operators.
- Support exports/log previews remain PHI-safe.
- Dental chart/tooth visuals remain unchanged unless validated replacement assets/design exist.
- Full release verification passes from a clean checkout.

## 11. Execution Update — 2026-06-06

Local roadmap work advanced in this pass:

- `docs/operator-manual.md` created and linked from pilot start/handoff docs.
- `docs/data-privacy-review.md` created with local-only PHI, support export, crash/log, and retention boundaries.
- Accessibility checklist and high-risk app semantics added for Settings, navigation, Patients, Schedule, Today, and post-write notices.
- Synthetic performance profiling added with a 5,000-patient / 50,000-appointment baseline report under `qa-runs/`.
- Post-write local-copy refresh-needed state added after sandbox commits; Settings refresh clears the notice.
- DBF-change-since-import detection added through PHI-safe source file snapshots and mirror status metadata.
- Table-level incremental import added for low-risk reference tables; full refresh remains the fallback and core clinical-table path.
- Operator-friendly local-copy changed-since-refresh copy added in Settings.
- Data privacy, installer, code-signing, auto-update, telemetry, and external field blocker decision records added.

Still not complete:

- Windows field execution `EXEC-01` through `EXEC-16`.
- Windows 10/11 validation.
- Antivirus and endpoint validation.
- Authenticode certificate and signed artifact verification.
- Signed installer install/upgrade/uninstall proof.
- Auto-update feed implementation and update/rollback proof.
- Real clinic pilot reports and issue triage.

These external items remain blockers for sellable clinic-ready status.

Verification rerun after roadmap/status alignment:

- `git diff --check` passed.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed.
- `corepack pnpm --filter @microdent/app run test -- local-copy-issue.test.ts mirror-stale.test.ts settings-panel.test.tsx schedule-panel.test.tsx post-write-local-copy.test.tsx` passed; Vitest executed the app suite, 51 files / 499 tests.
- `PATH="$(pwd):$PATH" corepack pnpm stage:pilot-release` passed and staged 304 files.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:verify-release` passed.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:verify-manifest` passed and verified 303 files for commit `a96131b9de285087afded94f61ae312b1daa5d74`.
- `PATH="$(pwd):$PATH" corepack pnpm --filter @microdent/desktop run release-smoke` passed, including 13 desktop test files / 119 tests.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:release-check` passed as a dev-distribution checkpoint; it rebuilt/tested/staged/verified the pilot package and warned that sandbox QA was skipped because strict `DATA_ROOT`, `SQLITE_PATH`, and `BACKUP_DIR` signoff paths were not configured.
- A disposable synthetic strict-signoff sandbox was generated under ignored local workspace `services/strict-signoff/`; `pnpm legacy:create-sandbox` and `pnpm mirror:import-safe` passed with 8 synthetic DBFs, 2 patients, 2 appointments, 1 doctor, 1 procedure, 2 schedule rooms, and empty medical/treatment tables.
- `PATH="$(pwd):$PATH" DATA_ROOT=... SQLITE_PATH=... BACKUP_DIR=... BRIDGE_PORT=17991 BRIDGE_URL=http://127.0.0.1:17991 corepack pnpm qa:sandbox` passed all four synthetic write workflows: appointment status update, appointment time move, appointment create, and patient demographics update, each with dry-run, backup, commit, DBF readback, and restore proof.
- `PATH="$(pwd):$PATH" DATA_ROOT=... SQLITE_PATH=... BACKUP_DIR=... BRIDGE_PORT=17992 BRIDGE_URL=http://127.0.0.1:17992 corepack pnpm pilot:release-signoff` passed and printed `PILOT RELEASE SIGNOFF: READY`; Tier 1 Mac-side release readiness and Tier 2 Windows-test readiness are ready, while Tier 3 Windows execution remains deferred/not run.
- `pnpm strict-signoff:prepare` now recreates the ignored PHI-free synthetic strict-signoff source/sandbox workspace so the strict local signoff proof is reproducible instead of relying on ad-hoc generated files.
- `PATH="$(pwd):$PATH" corepack pnpm strict-signoff:local -- --port 17995` passed end-to-end: generated the PHI-free sandbox, imported the mirror, passed sandbox preflight, ran the full strict release signoff, and printed `PILOT RELEASE SIGNOFF: READY`.
- `pnpm pilot:field-evidence` now validates PHI-safe Windows field evidence JSON against EXEC-01 through EXEC-16; `sandbox-signoff` can produce `FIELD EVIDENCE: READY`, while `read-only` evidence remains explicitly blocked from clinic go-live claims.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 21 tests, including Windows field evidence acceptance/rejection cases.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:field-evidence -- /tmp/microdent-field-evidence-valid.json` passed and printed `FIELD EVIDENCE: READY` for a completed synthetic sandbox-signoff JSON.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:field-evidence -- qa-runs/TEMPLATE-windows-field-evidence.json` correctly failed with `FIELD EVIDENCE: BLOCKED` because the template still contains placeholders.
- `PATH="$(pwd):$PATH" corepack pnpm stage:pilot-release` passed and staged 305 files, including `docs/windows-field-evidence-report.md`.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:verify-release` passed.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:verify-manifest` passed and verified 304 files for commit `a96131b9de285087afded94f61ae312b1daa5d74`.
- `pnpm pilot:commercial-readiness` now validates final sellable-product evidence across Mac signoff, Windows field proof, Windows 10/11, antivirus, signing, installer, auto-update, pilot reports, support readiness, and go-live approvals.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 25 tests, including commercial readiness acceptance/rejection cases.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:commercial-readiness -- /tmp/microdent-commercial-ready.json` passed and printed `COMMERCIAL READINESS: READY` for a completed synthetic evidence file.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:commercial-readiness -- qa-runs/TEMPLATE-commercial-readiness-evidence.json` correctly failed with `COMMERCIAL READINESS: BLOCKED` because the checked-in template contains placeholders and unresolved external evidence.
- `PATH="$(pwd):$PATH" corepack pnpm stage:pilot-release` passed and staged 306 files, including `docs/commercial-readiness-evidence.md`.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:verify-release` passed after adding the commercial readiness guide.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:verify-manifest` passed and verified 305 files for commit `a96131b9de285087afded94f61ae312b1daa5d74`.
- Support launch assets added: `docs/support-knowledge-base.md`, `docs/pilot-feedback-triage-workflow.md`, `docs/support-readiness-checklist.md`, `qa-runs/TEMPLATE-pilot-feedback-triage.md`, and `qa-runs/TEMPLATE-support-readiness.md`.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 25 tests after adding required support docs to the staged layout rules.
- `PATH="$(pwd):$PATH" corepack pnpm stage:pilot-release` passed and staged 309 files, including the support knowledge base, feedback triage workflow, and support readiness checklist.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:verify-release` passed after adding the support docs.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:verify-manifest` passed and verified 308 files for commit `a96131b9de285087afded94f61ae312b1daa5d74`.
- Licensing/distribution readiness assets added: `docs/licensing-readiness.md`, `docs/distribution-readiness.md`, `qa-runs/TEMPLATE-licensing-readiness.md`, and `qa-runs/TEMPLATE-distribution-readiness.md`.
- `pnpm pilot:commercial-readiness` now requires licensing evidence (`offlineValidation`, `noPhiTransmission`, `gracefulExpiry`, `safetyReviewed`) and distribution evidence (`downloadIntegrity`, `releaseNotesReady`, `marketingClaimsReviewed`, `supportPathPublished`) before reporting ready.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 26 tests after expanding the commercial readiness validator for licensing and distribution.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:commercial-readiness -- /tmp/microdent-commercial-ready.json` passed and printed `COMMERCIAL READINESS: READY` for a completed synthetic evidence file with licensing/distribution sections.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:commercial-readiness -- qa-runs/TEMPLATE-commercial-readiness-evidence.json` correctly failed with `COMMERCIAL READINESS: BLOCKED` because licensing/distribution and other external evidence remain unresolved.
- `PATH="$(pwd):$PATH" corepack pnpm stage:pilot-release` passed and staged 311 files, including `docs/licensing-readiness.md` and `docs/distribution-readiness.md`.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:verify-release` passed after adding licensing/distribution readiness docs.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:verify-manifest` passed and verified 310 files for commit `a96131b9de285087afded94f61ae312b1daa5d74`.
- Pricing/marketing readiness assets added: `docs/pricing-readiness.md`, `docs/marketing-readiness.md`, `qa-runs/TEMPLATE-pricing-readiness.md`, and `qa-runs/TEMPLATE-marketing-readiness.md`.
- `pnpm pilot:commercial-readiness` now requires pricing evidence (`scopeMatchesLicense`, `supportTermsDefined`, `noUsageTelemetryDependency`, `sponsorApproved`) and marketing evidence (`claimsMatchEvidence`, `unsupportedFeaturesDisclosed`, `privacyClaimsReviewed`, `websiteOrPacketReady`, `noClinicReadyClaimBeforeGate`) before reporting ready.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 27 tests after expanding the commercial readiness validator for pricing and marketing.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:commercial-readiness -- /tmp/microdent-commercial-ready.json` passed and printed `COMMERCIAL READINESS: READY` for a completed synthetic evidence file with pricing/marketing sections.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:commercial-readiness -- qa-runs/TEMPLATE-commercial-readiness-evidence.json` correctly failed with `COMMERCIAL READINESS: BLOCKED` because pricing/marketing and other external evidence remain unresolved.
- `PATH="$(pwd):$PATH" corepack pnpm stage:pilot-release` passed and staged 313 files, including `docs/pricing-readiness.md` and `docs/marketing-readiness.md`.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:verify-release` passed after adding pricing/marketing readiness docs.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:verify-manifest` passed and verified 312 files for commit `a96131b9de285087afded94f61ae312b1daa5d74`.
- Staged package now includes curated PHI-safe `qa-runs/TEMPLATE-*` files so package docs that link to evidence templates resolve inside the handoff tree; completed QA/clinic reports remain excluded.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 27 tests after adding required `qa-runs/TEMPLATE-*` layout entries.
- `PATH="$(pwd):$PATH" corepack pnpm stage:pilot-release` passed and staged 323 files, including 10 curated `qa-runs/TEMPLATE-*` files.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:verify-release` passed after staging the templates.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:verify-manifest` passed and verified 322 files for commit `a96131b9de285087afded94f61ae312b1daa5d74`.
- `pnpm roadmap:local-audit` added as a non-destructive one-command local audit for artifact tests, stage/verify, template staging, and expected-blocked field/commercial evidence templates.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:local-audit` passed and printed `ROADMAP LOCAL AUDIT: READY`; tier 1 Mac-side staged handoff checks and tier 2 Windows-test pack/docs/templates are ready, while tier 3 Windows execution and commercial readiness remain correctly blocked pending external evidence.
- `pnpm roadmap:completion-audit` added as the strict requirement-by-requirement completion gate. It verifies local roadmap evidence for sections 4.1 through 7, then requires non-template Windows field and commercial readiness evidence under `qa-runs/` before reporting complete.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:completion-audit` correctly failed with `ROADMAP COMPLETION: BLOCKED`: all local sections reported ready, while Windows field evidence and commercial readiness remained blocked because no completed non-template evidence JSONs have been filed.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 28 tests after adding roadmap completion audit coverage.
- `scripts/qa-sandbox-run.mjs` added as the cross-platform Node `pnpm qa:sandbox` orchestrator. It replaces the bash-only default while preserving the same write proof: build bridge, start `node dist/server.js`, poll health/write-capability, dry-run/backup/commit/DBF-readback/restore for the four allowed workflows, then stop the bridge.
- `pnpm qa:sandbox:bash` added as the historical bash fallback; docs now point native Windows/PowerShell users at `pnpm qa:sandbox`.
- `PATH="$(pwd):$PATH" DATA_ROOT=... SQLITE_PATH=... BACKUP_DIR=... BRIDGE_PORT=17998 BRIDGE_URL=http://127.0.0.1:17998 corepack pnpm qa:sandbox` passed against the generated PHI-free strict-signoff sandbox. All four workflows completed with backup, commit, DBF readback, and restore proof.
- `PATH="$(pwd):$PATH" corepack pnpm strict-signoff:local -- --port 17999` passed end-to-end after the Node runner update and printed `PILOT RELEASE SIGNOFF: READY`; tier 1 and tier 2 remain ready, while tier 3 Windows execution remains deferred.
- `pnpm pilot:windows-compatibility` added as the PHI-safe Windows 10/11 and antivirus/endpoint evidence validator, with `qa-runs/TEMPLATE-windows-compatibility-evidence.json` and [windows-compatibility-evidence.md](./windows-compatibility-evidence.md).
- `pnpm pilot:commercial-readiness` now requires `windowsValidation.compatibilityReportPath` so commercial readiness must point to a filed Windows compatibility matrix, not just loose pass labels.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:windows-compatibility -- qa-runs/TEMPLATE-windows-compatibility-evidence.json` correctly failed with `WINDOWS COMPATIBILITY: BLOCKED` because the template contains placeholders and unresolved Windows matrix evidence.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 33 tests after adding Windows compatibility evidence acceptance/rejection cases.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:local-audit` passed after staging 325 files, verifying 324 manifest entries, checking 11 PHI-safe `qa-runs/TEMPLATE-*` files, and confirming field/compatibility/commercial evidence templates remain expected-blocked.
- `pnpm license:validate` added as the PHI-safe signed offline license validator, with `qa-runs/TEMPLATE-offline-license.json` and [offline-license-mechanism.md](./offline-license-mechanism.md).
- `pnpm pilot:commercial-readiness` now requires `licensing.licenseEvidencePath` so commercial readiness must point to filed signed offline license evidence, not just Boolean readiness labels.
- `PATH="$(pwd):$PATH" corepack pnpm license:validate -- qa-runs/TEMPLATE-offline-license.json` correctly failed with `OFFLINE LICENSE: BLOCKED` because the template contains placeholders and no real public key/signature.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 38 tests after adding offline license signature, tamper, expiry, PHI-token, and template rejection cases.
- `pnpm pilot:signed-artifacts` added as the PHI-safe Authenticode app/installer evidence validator, with `qa-runs/TEMPLATE-signed-artifact-evidence.json` and [signed-artifact-evidence.md](./signed-artifact-evidence.md).
- `pnpm pilot:commercial-readiness` now requires `signing.signedArtifactEvidencePath` so commercial readiness must point to filed signing evidence, not just loose pass labels.
- `pnpm pilot:installer-evidence` added as the PHI-safe signed installer behavior validator, with `qa-runs/TEMPLATE-installer-evidence.json` and [installer-evidence.md](./installer-evidence.md).
- `pnpm pilot:commercial-readiness` now requires `installer.installerEvidencePath` so commercial readiness must point to filed clean install, upgrade, uninstall, shortcut, first-run, and data-boundary installer evidence.
- `pnpm pilot:auto-update-evidence` added as the PHI-safe signed update channel, payload, update, rollback, offline recovery, and privacy evidence validator, with `qa-runs/TEMPLATE-auto-update-evidence.json` and [auto-update-evidence.md](./auto-update-evidence.md).
- `pnpm pilot:commercial-readiness` now requires `autoUpdate.autoUpdateEvidencePath` so commercial readiness must point to filed update/rollback/privacy evidence.
- `pnpm pilot:clinic-report` added as the PHI-safe clinic pilot outcome and issue-triage evidence validator, with `qa-runs/TEMPLATE-clinic-pilot-report.json` and [clinic-pilot-report-evidence.md](./clinic-pilot-report-evidence.md).
- `pnpm pilot:commercial-readiness` now requires every `pilotReports[]` entry to point to a filed clinic pilot report JSON.
- `pnpm pilot:support-readiness` added as the PHI-safe support KB, issue workflow, rollback, training, and lead signoff validator, with `qa-runs/TEMPLATE-support-readiness-evidence.json` and [support-readiness-evidence.md](./support-readiness-evidence.md).
- `pnpm pilot:commercial-readiness` now requires `supportReadiness.supportEvidencePath`.
- `pnpm pilot:distribution-evidence` added as the PHI-safe distribution channel, artifact integrity, release notes, claims review, support path, and privacy/security validator, with `qa-runs/TEMPLATE-distribution-evidence.json` and [distribution-evidence.md](./distribution-evidence.md).
- `pnpm pilot:commercial-readiness` now requires `distribution.distributionEvidencePath`.
- `pnpm pilot:pricing-evidence` added as the PHI-safe pricing, license alignment, support terms, telemetry independence, and sponsor approval validator, with `qa-runs/TEMPLATE-pricing-evidence.json` and [pricing-evidence.md](./pricing-evidence.md).
- `pnpm pilot:commercial-readiness` now requires `pricing.pricingEvidencePath`.
- `pnpm pilot:marketing-evidence` added as the PHI-safe marketing claims, disclosures, privacy review, packet approval, and safe-screenshot validator, with `qa-runs/TEMPLATE-marketing-evidence.json` and [marketing-evidence.md](./marketing-evidence.md).
- `pnpm pilot:commercial-readiness` now requires `marketing.marketingEvidencePath`.
- `pnpm pilot:go-live-evidence` added as the PHI-safe final go/no-go approval validator, with `qa-runs/TEMPLATE-go-live-evidence.json` and [go-live-evidence.md](./go-live-evidence.md).
- `pnpm pilot:commercial-readiness` now requires `goLive.goLiveEvidencePath`.
- `pnpm pilot:commercial-readiness` now validates referenced evidence files by default and checks cross-report consistency for signing, installer, update, distribution, license/pricing, field, pilot, support, and go-live evidence paths.
- `pnpm pilot:commercial-readiness` now accepts `--public-key <public-key.pem>` and forwards it to offline license evidence validation, matching `pnpm license:validate`.
- `pnpm roadmap:completion-audit` now also accepts `--public-key <public-key.pem>` and forwards it into nested commercial readiness validation.
- `pnpm pilot:commercial-evidence-status` added as a preflight scanner for all filed non-template commercial evidence reports before the final commercial readiness JSON is assembled.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:commercial-evidence-status` correctly failed with `COMMERCIAL EVIDENCE STATUS: BLOCKED` and listed every missing non-template commercial evidence family.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 86 tests after adding commercial evidence status missing/ready/no-public-key cases.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:local-audit` passed after staging 345 files, verifying 344 manifest entries, and confirming the new commercial evidence status preflight remains expected-blocked until external evidence is filed.
- `pnpm pilot:evidence-filing-plan` added as a PHI-safe field/commercial evidence filing checklist generator. It prints recommended non-template filenames, source templates, and validator commands without creating fake evidence JSON reports.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:evidence-filing-plan -- --date 2026-06-06 --clinic-label CLINIC-PC-01` correctly failed with a blocked Markdown plan listing the required external evidence files.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 88 tests after adding evidence filing plan blocked/ready cases.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:local-audit` passed after confirming the evidence filing plan remains expected-blocked until external evidence is filed.
- `pnpm pilot:attachment-manifest` added as the PHI-safe redacted attachment metadata/hash validator, with `qa-runs/TEMPLATE-evidence-attachment-manifest.json` and [evidence-attachment-manifest.md](./evidence-attachment-manifest.md).
- `pnpm pilot:field-evidence` now requires `attachments.manifestPath`, `attachments.redactionReviewed`, and `attachments.rawAttachmentsCommitted=false` so Windows tier 3 evidence points to reviewed attachment metadata without committing raw screenshots or logs.
- `pnpm pilot:field-evidence`, `pnpm pilot:commercial-evidence-status`, and `pnpm roadmap:completion-audit` now validate the referenced attachment manifest, not just the field evidence path string.
- `pnpm pilot:commercial-readiness` now also validates the field evidence attachment manifest transitively when checking `fieldEvidence.reportPath`.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:attachment-manifest -- qa-runs/TEMPLATE-evidence-attachment-manifest.json` correctly failed with `ATTACHMENT MANIFEST: BLOCKED` because the template contains placeholders.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:field-evidence -- qa-runs/TEMPLATE-windows-field-evidence.json` now also fails because the template's referenced attachment manifest path does not exist.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 95 tests after adding attachment manifest ready/rejection cases, stricter field-evidence attachment requirements, and strict referenced-manifest validation.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:local-audit` passed after staging 347 files, verifying 346 manifest entries, checking 22 staged templates, and confirming the attachment manifest template remains expected-blocked.
- `pnpm pilot:commercial-readiness` now validates `fieldEvidence.reportPath` with strict referenced attachment-manifest checking, so commercial readiness cannot pass on a field evidence JSON whose manifest is missing or blocked.
- Strict field evidence now also requires the referenced attachment manifest `clinicLabel` and `evidenceId` to match the field report `machine.label`.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 96 tests after adding the commercial readiness transitive attachment-manifest regression.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:local-audit` passed after confirming commercial readiness and roadmap completion remain expected-blocked without external evidence.
- Strict field evidence and commercial readiness now reject attachment manifests whose `clinicLabel` or `evidenceId` do not match the field evidence `machine.label`.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 98 tests after adding direct field-evidence and transitive commercial-readiness identity mismatch regressions.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:local-audit` passed again with tier 1 and tier 2 ready, while tier 3 and commercial readiness remain correctly blocked on missing external evidence.
- `pnpm pilot:evidence-repo-guard` added as a repository-level PHI safety gate for `qa-runs/`, blocking raw screenshots/images, PDFs, logs, DBF/SQLite files, archives, executable attachments, and raw-evidence directory names.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:evidence-repo-guard` passed with `EVIDENCE REPO GUARD: READY` after checking 51 `qa-runs/` files.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 100 tests after adding repository-guard acceptance/rejection coverage.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:completion-audit` correctly failed with `ROADMAP COMPLETION: BLOCKED`; all local sections are ready, while non-template Windows field and commercial readiness evidence are still missing.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:local-audit` passed with the evidence repo guard included, staged 347 files, verified 346 manifest entries, and confirmed external evidence gates remain expected-blocked.
- `pnpm pilot:windows-field-packet` added as a PHI-safe Windows field collection packet generator for EXEC-01 through EXEC-16. It prints target evidence filenames, attachment-manifest validation, repo guard, field evidence, compatibility evidence, filing-plan, commercial status, and completion-audit commands without creating fake evidence JSON.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:windows-field-packet -- --date 2026-06-06 --clinic-label CLINIC-PC-01 --json` passed and produced a `blocked-until-field-run` packet covering every EXEC step and target evidence path.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 102 tests after adding Windows field packet coverage.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:completion-audit` correctly failed with `ROADMAP COMPLETION: BLOCKED`; all local sections remain ready, while non-template Windows field and commercial readiness evidence are still missing.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:local-audit` passed with the Windows field packet generator included, staged 347 files, verified 346 manifest entries, and confirmed external evidence gates remain expected-blocked.
- `pnpm pilot:installer-packet` added as a PHI-safe signed-installer readiness packet generator. It coordinates signed-artifact evidence, installer evidence, repo guard, evidence filing plan, commercial status, and completion-audit commands without adding installer dependencies or creating fake evidence JSON.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:installer-packet -- --date 2026-06-06 --target nsis --json` passed and produced a `blocked-until-signed-installer-candidate` packet covering signing, clean install, upgrade, uninstall, data-boundary, and rollback checks.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 104 tests after adding signed-installer packet coverage.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:completion-audit` correctly failed with `ROADMAP COMPLETION: BLOCKED`; all local sections remain ready, while non-template Windows field and commercial readiness evidence are still missing.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:local-audit` passed with the installer packet generator included, staged 347 files, verified 346 manifest entries, and confirmed external evidence gates remain expected-blocked.
- `pnpm pilot:auto-update-packet` added as a PHI-safe signed-update readiness packet generator. It coordinates signed-artifact evidence, auto-update evidence, repo guard, evidence filing plan, commercial status, and completion-audit commands without adding update dependencies or enabling network update checks.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:auto-update-packet -- --date 2026-06-06 --channel internal-signed-feed --json` passed and produced a `blocked-until-signed-update-channel` packet covering channel, signed payload, update install, rollback, offline recovery, privacy, and operator-notice checks.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 106 tests after adding signed-update packet coverage.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:completion-audit` correctly failed with `ROADMAP COMPLETION: BLOCKED`; all local sections remain ready, while non-template Windows field and commercial readiness evidence are still missing.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:local-audit` passed with the auto-update packet generator included, staged 347 files, verified 346 manifest entries, and confirmed external evidence gates remain expected-blocked.
- `pnpm pilot:go-live-packet` added as a PHI-safe final approval packet generator. It ties field evidence, clinic pilot report, triage rollup, support readiness, commercial readiness, go-live evidence, repo guard, evidence filing plan, commercial status, and completion audit commands without approving launch or creating fake evidence JSON.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:go-live-packet -- --date 2026-06-06 --clinic-label CLINIC-PC-01 --json` passed and produced a `blocked-until-real-pilot-and-approvals` packet covering field evidence, clinic pilot, support readiness, commercial readiness, rollback path, and final approvers.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 108 tests after adding go-live packet coverage.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:completion-audit` correctly failed with `ROADMAP COMPLETION: BLOCKED`; all local sections remain ready, while non-template Windows field and commercial readiness evidence are still missing.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:local-audit` passed with the go-live packet generator included, staged 347 files, verified 346 manifest entries, and confirmed external evidence gates remain expected-blocked.
- `pnpm pilot:commercial-launch-packet` added as a PHI-safe commercial launch packet generator for support, offline license, distribution, pricing, marketing, commercial readiness, repo guard, evidence filing plan, commercial status, and completion audit commands without approving commercial readiness or creating fake evidence JSON.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:commercial-launch-packet -- --date 2026-06-06 --clinic-label CLINIC-PC-01 --json` passed and produced a `blocked-until-commercial-evidence-filed` packet covering support, licensing, distribution, pricing, marketing, and commercial readiness targets.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 110 tests after adding commercial launch packet coverage.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:completion-audit` correctly failed with `ROADMAP COMPLETION: BLOCKED`; all local sections remain ready, while non-template Windows field and commercial readiness evidence are still missing.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:local-audit` passed with the commercial launch packet generator included, staged 347 files, verified 346 manifest entries, and confirmed external evidence gates remain expected-blocked.
- `pnpm pilot:evidence-filing-plan` now includes per-evidence packet commands so the master filing checklist points operators to `pilot:windows-field-packet`, `pilot:installer-packet`, `pilot:auto-update-packet`, `pilot:commercial-launch-packet`, and `pilot:go-live-packet` before the matching validators.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:evidence-filing-plan -- --date 2026-06-06 --clinic-label CLINIC-PC-01 --json` correctly failed with a blocked JSON plan listing packet commands, target filenames, validators, and missing external evidence for all 14 evidence items.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 110 tests after adding evidence filing plan packet-command coverage.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:completion-audit` correctly failed with `ROADMAP COMPLETION: BLOCKED`; all local sections, including packet orchestration checks, remain ready while non-template Windows field and commercial readiness evidence are still missing.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:local-audit` passed after the filing plan packet-command update, staged 347 files, verified 346 manifest entries, and confirmed external evidence gates remain expected-blocked.
- `pnpm roadmap:local-audit` now runs the cross-platform Node orchestrator `scripts/roadmap-local-audit.mjs`; the previous bash implementation remains available as `pnpm roadmap:local-audit:bash`.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 111 tests after adding the roadmap local-audit entrypoint regression.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:local-audit` passed through the Node orchestrator, staged 347 files, verified 346 manifest entries, and confirmed every evidence template, evidence filing plan, commercial evidence status, commercial readiness, and roadmap completion audit remains expected-blocked.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:completion-audit` correctly failed with `ROADMAP COMPLETION: BLOCKED`; all local sections remain ready while non-template Windows field and commercial readiness evidence are still missing.
- `pnpm pilot:release-signoff` now runs the cross-platform Node strict signoff orchestrator `scripts/pilot-release-signoff.mjs`; the previous bash implementation remains available as `pnpm pilot:release-signoff:bash`.
- `env -u DATA_ROOT -u SQLITE_PATH -u BACKUP_DIR PATH="$(pwd):$PATH" corepack pnpm pilot:release-signoff` correctly failed before running partial signoff work and printed that `DATA_ROOT` is unset, preserving the strict sandbox-evidence requirement.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 112 tests after adding the strict release-signoff entrypoint regression.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:completion-audit` correctly failed with `ROADMAP COMPLETION: BLOCKED`; all local sections, including the Node release-signoff entrypoint, remain ready while non-template Windows field and commercial readiness evidence are still missing.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:local-audit` passed after the Node release-signoff entrypoint update, staged 347 files, verified 346 manifest entries, and confirmed external evidence gates remain expected-blocked.
- `pnpm strict-signoff:local` now runs the cross-platform Node rehearsal orchestrator `scripts/strict-signoff-local.mjs`; the previous bash implementation remains available as `pnpm strict-signoff:local:bash`.
- `PATH="$(pwd):$PATH" corepack pnpm strict-signoff:local -- --port 18005 --prepare-only` passed through the Node orchestrator after generating the PHI-free sandbox, importing the SQLite mirror, and preflighting marker/dist/sqlite readiness without running the full signoff.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 113 tests after adding the local strict-signoff entrypoint regression and clearer evidence-filing ready-case diagnostics.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:completion-audit` correctly failed with `ROADMAP COMPLETION: BLOCKED`; all local sections, including the Node strict-signoff local rehearsal, remain ready while non-template Windows field and commercial readiness evidence are still missing.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:local-audit` passed after the Node strict-signoff local update, staged 347 files, verified 346 manifest entries, and confirmed external evidence gates remain expected-blocked.
- `pnpm mirror:import-safe` now runs the cross-platform Node wrapper `scripts/mirror-import-safe.mjs`; the previous bash implementation remains available as `pnpm mirror:import-safe:bash`.
- `env -u DATA_ROOT -u SQLITE_PATH PATH="$(pwd):$PATH" corepack pnpm mirror:import-safe` correctly failed before import and printed the absolute-path setup guidance.
- `PATH="$(pwd):$PATH" corepack pnpm strict-signoff:local -- --port 18006 --prepare-only` passed through the Node `mirror:import-safe` wrapper, generated the PHI-free sandbox, imported the SQLite mirror, and preflighted marker/dist/sqlite readiness without running the full signoff.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 114 tests after adding the mirror import entrypoint regression.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:completion-audit` correctly failed with `ROADMAP COMPLETION: BLOCKED`; all local sections, including the Node mirror import wrapper, remain ready while non-template Windows field and commercial readiness evidence are still missing.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:local-audit` passed after the Node mirror import update, staged 347 files, verified 346 manifest entries, and confirmed external evidence gates remain expected-blocked.
- `pnpm legacy:backup`, `pnpm legacy:create-sandbox`, `pnpm legacy:restore`, and `pnpm legacy:backup-verify` now run the cross-platform Node wrapper `scripts/legacy-command.mjs`; the previous bash implementations remain available as `pnpm legacy:backup:bash`, `pnpm legacy:create-sandbox:bash`, `pnpm legacy:restore:bash`, and `pnpm legacy:backup-verify:bash`.
- Missing-env and relative-path guards were verified for the Node legacy wrapper before any build/import/write work: `legacy:backup`, `legacy:create-sandbox`, `legacy:restore`, and `legacy:backup-verify` all failed with the expected setup or absolute-path guidance.
- A disposable PHI-free `services/strict-signoff/Legacy-Command-Wrapper-Sandbox` proved the Node legacy wrapper positive path: `pnpm legacy:create-sandbox`, `pnpm legacy:backup`, `pnpm legacy:backup-verify`, and `pnpm legacy:restore` all passed against synthetic data.
- `PATH="$(pwd):$PATH" corepack pnpm strict-signoff:local -- --port 18007 --prepare-only` passed after the Node legacy command wrapper update, confirming the strict local rehearsal still prepares/imports/preflights the PHI-free sandbox.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 115 tests after adding the legacy data safety entrypoint regression.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:completion-audit` correctly failed with `ROADMAP COMPLETION: BLOCKED`; all local sections, including the Node legacy safety wrapper, remain ready while non-template Windows field and commercial readiness evidence are still missing.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:local-audit` passed after the Node legacy command wrapper update, staged 347 files, verified 346 manifest entries, and confirmed external evidence gates remain expected-blocked.
- `pnpm pilot:full-checkpoint`, `pnpm pilot:distribution-checkpoint`, and `pnpm pilot:release-check` now run the cross-platform Node orchestrator `scripts/pilot-checkpoint.mjs`; the previous bash implementations remain available as `pnpm pilot:full-checkpoint:bash`, `pnpm pilot:distribution-checkpoint:bash`, and `pnpm pilot:release-check:bash`.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:release-check` passed end-to-end through the Node release checkpoint: workspace tests/builds, web build, bridge/desktop build, pilot staging, release verification, `PILOT_STAGED_RELEASE=1` desktop release-smoke, and the expected not-signoff sandbox warning.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 116 tests after adding the pilot checkpoint entrypoint regression.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:completion-audit` correctly failed with `ROADMAP COMPLETION: BLOCKED`; all local sections, including the Node pilot checkpoint orchestrator, remain ready while non-template Windows field and commercial readiness evidence are still missing.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:local-audit` passed after the Node pilot checkpoint update, staged 347 files, verified 346 manifest entries, and confirmed external evidence gates remain expected-blocked.
- Windows readiness documentation now consistently classifies root `pnpm legacy:*` and `pnpm mirror:import-safe` commands as cross-platform Node wrappers for PowerShell/cmd; Git Bash/WSL is documented only for explicit `:bash` fallbacks.
- `scripts/README.md` now points Windows operators at the root Node wrappers rather than lower-level `pnpm --filter` commands for mirror import and legacy data safety tasks.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 117 tests after adding the Windows readiness documentation regression that rejects the stale “Bash wrappers — use WSL/Git Bash” root-command guidance.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:completion-audit` correctly failed with `ROADMAP COMPLETION: BLOCKED`; all local sections, including the Windows readiness documentation checks, remain ready while non-template Windows field and commercial readiness evidence are still missing.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:local-audit` passed after the Windows readiness documentation hardening, staged 347 files, verified 346 manifest entries, and confirmed external evidence gates remain expected-blocked.
- `pnpm pilot:evidence-collection-packet` added as a PHI-safe master evidence collection coordinator. It generates one command packet for Windows field, installer, auto-update, commercial launch, go-live, filing-plan, repo guard, commercial status, and completion-audit steps without creating evidence JSON or approving readiness.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:evidence-collection-packet -- --date 2026-06-06 --clinic-label CLINIC-PC-01 --json` passed and produced a `blocked-until-real-evidence-filed` packet whose outputs are Markdown packet/checklist targets only.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 119 tests after adding master evidence collection packet coverage.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:completion-audit` correctly failed with `ROADMAP COMPLETION: BLOCKED`; all local sections, including the master evidence collection packet, remain ready while non-template Windows field and commercial readiness evidence are still missing.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:local-audit` passed after the master evidence collection packet update, staged 347 files, verified 346 manifest entries, and confirmed external evidence gates remain expected-blocked.
- `pnpm roadmap:local-audit` now runs `pnpm pilot:evidence-collection-packet -- --date 2026-06-06 --clinic-label CLINIC-PC-01 --json` alongside the individual field/installer/update/go-live/commercial packet smoke checks, so the master evidence coordinator is part of the standard local-readiness gate.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 119 tests after adding a regression that `scripts/roadmap-local-audit.mjs` contains the master evidence packet check.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:local-audit` passed with the master evidence packet smoke included, staged 347 files, verified 346 manifest entries, and confirmed external evidence gates remain expected-blocked.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:completion-audit` correctly failed with `ROADMAP COMPLETION: BLOCKED`; all local sections remain ready while non-template Windows field and commercial readiness evidence are still missing.
- `scripts/stage-pilot-release.mjs` now writes a staged `scripts/README.txt` pointer for `pnpm pilot:evidence-collection-packet -- --clinic-label CLINIC-PC-01 --write`, explicitly saying the command runs from a full repo checkout and writes PHI-safe Markdown packet/checklist files only.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 120 tests after adding a staged evidence-collection pointer regression.
- `PATH="$(pwd):$PATH" corepack pnpm stage:pilot-release`, `pnpm pilot:verify-release`, and `pnpm pilot:verify-manifest` passed; the generated `dist/pilot-release/MicrodentModern/scripts/README.txt` includes the repo-side evidence collection pointer and still preserves staged-package safety.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:completion-audit` correctly failed with `ROADMAP COMPLETION: BLOCKED`; all local sections, including the staged evidence-collection pointer, remain ready while non-template Windows field and commercial readiness evidence are still missing.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:local-audit` passed after the staged pointer update, staged 347 files, verified 346 manifest entries, and confirmed external evidence gates remain expected-blocked.
- `docs/evidence-collection-packet.md` added as the dedicated operator guide for the master evidence collection packet. It documents command usage, Markdown-only outputs, full-repo checkout requirement, PHI rules, relationship to `pilot:evidence-filing-plan`, and the required `ROADMAP COMPLETION: BLOCKED` state until real evidence exists.
- `FIELD-TEST-START-HERE.md`, `PILOT-START-HERE.md`, and `commercial-readiness-evidence.md` now link to the master evidence collection packet guide.
- `scripts/stage-pilot-release.mjs` now stages `docs/evidence-collection-packet.md`; `roadmap:completion-audit` verifies the doc, staged-doc source list, and cross-links.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 120 tests after strengthening the staged evidence collection doc regression.
- `PATH="$(pwd):$PATH" corepack pnpm stage:pilot-release`, `pnpm pilot:verify-release`, and `pnpm pilot:verify-manifest` passed; the staged release now contains 348 files and the manifest verified 347 files including `docs/evidence-collection-packet.md`.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:completion-audit` correctly failed with `ROADMAP COMPLETION: BLOCKED`; all local sections, including the master evidence collection guide, remain ready while non-template Windows field and commercial readiness evidence are still missing.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:local-audit` passed after the evidence collection guide update, staged 348 files, verified 347 manifest entries, and confirmed external evidence gates remain expected-blocked.
- `docs/evidence-collection-packet.md` is now part of `REQUIRED_STAGED_LAYOUT`, so `pnpm pilot:verify-release` fails if the master evidence collection guide is missing from `dist/pilot-release/MicrodentModern/docs/`.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 120 tests after extending the required staged layout regression to cover `docs/evidence-collection-packet.md`.
- `PATH="$(pwd):$PATH" corepack pnpm stage:pilot-release`, `pnpm pilot:verify-release`, and `pnpm pilot:verify-manifest` passed with the required-layout guard enforcing the staged master evidence guide; the manifest verified 347 files.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:completion-audit` correctly failed with `ROADMAP COMPLETION: BLOCKED`; all local sections remain ready while non-template Windows field and commercial readiness evidence are still missing.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:local-audit` passed after adding the required-layout guard, staged 348 files, verified 347 manifest entries, and confirmed external evidence gates remain expected-blocked.
- Staged pilot docs now include additional operator/QA references that are linked from the handoff entry points: Windows runbook, packaging gap report, pre-installer checklist, Windows dry run, phase 3 backup/restore/sandbox/write-mode/readiness docs, phase 4 quickstart, phase 5/6/7 operator QA docs, phase 8 log-redaction review, and the desktop/scripts README documentation copies.
- `REQUIRED_STAGED_LAYOUT` now requires the additional staged operator docs plus documentation-only `apps/desktop/README.md` and `scripts/README.md`, so `pnpm pilot:verify-release` enforces their presence.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 120 tests after expanding the staged-layout regression.
- `PATH="$(pwd):$PATH" corepack pnpm stage:pilot-release`, `pnpm pilot:verify-release`, and `pnpm pilot:verify-manifest` passed; the staged release now contains 374 files across 31 directories and the manifest verified 373 files.
- A staged Markdown dry scan improved from 74 unresolved relative links before this pass to 43 remaining unresolved references after staging the high-traffic operator/QA docs and README pointers. Remaining unresolved references are mostly deeper planning/source-code links and are not yet promoted to a hard gate.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:completion-audit` correctly failed with `ROADMAP COMPLETION: BLOCKED`; all local sections remain ready while non-template Windows field and commercial readiness evidence are still missing.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:local-audit` passed after the staged docs expansion, staged 374 files, verified 373 manifest entries, and confirmed external evidence gates remain expected-blocked.
- `pnpm pilot:staged-link-audit` now runs `scripts/staged-markdown-link-audit.mjs` against `dist/pilot-release/MicrodentModern`, failing on unexpected missing staged Markdown relative links while explicitly allowing the 43 known source/deep-planning references that are useful context but not shipped in the staged package.
- `pnpm roadmap:local-audit` now runs `pnpm pilot:staged-link-audit` immediately after manifest verification, turning the staged Markdown link scan into a repeatable local-readiness gate.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:staged-link-audit` passed with `STAGED MARKDOWN LINKS: READY`, checking 85 Markdown files and allowing 43 documented missing source/deep-planning references.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 122 tests after adding staged Markdown link audit coverage and local-audit wiring regression coverage.
- `PATH="$(pwd):$PATH" corepack pnpm stage:pilot-release`, `pnpm pilot:verify-release`, and `pnpm pilot:verify-manifest` passed; the staged release remains at 374 files across 31 directories and the manifest verified 373 files.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:local-audit` passed with the staged Markdown link audit included, confirming local/staged handoff readiness while preserving the expected external evidence blockers.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:completion-audit` correctly failed with `ROADMAP COMPLETION: BLOCKED`; all local sections, including the staged Markdown link audit ratchet, remain ready while non-template Windows field and commercial readiness evidence are still missing.
- `git diff --check` passed after the staged Markdown link audit update.
- `pnpm pilot:package-verify-packet` added as a PHI-safe Windows staged-package verification packet generator. It produces a no-pnpm package hygiene checklist, attachment-manifest target, follow-up Windows field packet command, and final audit commands without creating evidence JSON or claiming field execution.
- `pnpm pilot:evidence-collection-packet` now starts with the package verification packet before the Windows field packet, so release coordinators verify the staged portable package before collecting EXEC-01 through EXEC-16 evidence.
- `pnpm roadmap:local-audit` and `pnpm roadmap:local-audit:bash` now smoke-check `pnpm pilot:package-verify-packet -- --date 2026-06-06 --clinic-label CLINIC-PC-01 --json` before field/installer/update/commercial packet checks.
- `PILOT-START-HERE.md`, `evidence-collection-packet.md`, and `windows-field-evidence-report.md` now document `pnpm pilot:package-verify-packet` as the pre-field package verification step and preserve that it does not prove Windows execution.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:package-verify-packet -- --date 2026-06-06 --clinic-label CLINIC-PC-01 --json` passed and emitted `blocked-until-windows-package-verified` with 8 package hygiene checks.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:evidence-collection-packet -- --date 2026-06-06 --clinic-label CLINIC-PC-01 --json` passed and included `qa-runs/2026-06-06-windows-package-verify-packet-CLINIC-PC-01.md` as the first packet target.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 124 tests after adding package verification packet coverage and master-packet/local-audit wiring regressions.
- `PATH="$(pwd):$PATH" corepack pnpm stage:pilot-release`, `pnpm pilot:verify-release`, `pnpm pilot:verify-manifest`, and `pnpm pilot:staged-link-audit` passed; the staged release remains at 374 files across 31 directories, the manifest verified 373 files, and the staged Markdown link audit checked 85 Markdown files with 43 documented source/deep-planning references allowed.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:local-audit` passed with the package verification packet included, confirming local/staged handoff readiness while preserving expected external evidence blockers.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:completion-audit` correctly failed with `ROADMAP COMPLETION: BLOCKED`; all local sections, including the package verification packet, remain ready while non-template Windows field and commercial readiness evidence are still missing.
- `git diff --check` passed after the package verification packet update.
- `pnpm pilot:package-verify-evidence` added as a PHI-safe Windows staged-package verification evidence validator with schema `microdent-windows-package-verify/v1`. It validates the IT package-hygiene result before field execution and still does not prove Windows app execution or commercial readiness.
- `qa-runs/TEMPLATE-windows-package-verify-evidence.json` and `docs/windows-package-verify-evidence.md` added so IT package verification has both a blocked template and an operator guide.
- `pnpm pilot:package-verify-packet` now prints `qa-runs/YYYY-MM-DD-windows-package-verify-evidence-CLINIC-PC-01.json` and `pnpm pilot:package-verify-evidence -- ...` before the attachment-manifest and Windows field-packet commands.
- `windows-pilot-package-verify-on-windows.md`, `PILOT-START-HERE.md`, and `evidence-collection-packet.md` now point operators at the package verification evidence validator and keep the package check scoped to staged-package hygiene only.
- `scripts/stage-pilot-release.mjs` and `REQUIRED_STAGED_LAYOUT` now stage/require the package verification evidence guide and template; `pnpm roadmap:local-audit` and its bash fallback now expect 23 staged `qa-runs/TEMPLATE-*` files and verify the package evidence template stays blocked.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:package-verify-evidence -- qa-runs/TEMPLATE-windows-package-verify-evidence.json` correctly failed with `PACKAGE VERIFY: BLOCKED` because the checked-in template contains placeholders and blocked checks.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:package-verify-packet -- --date 2026-06-06 --clinic-label CLINIC-PC-01 --json` passed and emitted the package evidence target, attachment manifest target, follow-up Windows field packet, evidence filing plan, repo guard, and completion audit commands.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 127 tests after adding package verification evidence ready/blocked/PHI-token coverage.
- `PATH="$(pwd):$PATH" corepack pnpm stage:pilot-release`, `pnpm pilot:verify-release`, `pnpm pilot:verify-manifest`, and `pnpm pilot:staged-link-audit` passed; the staged release now contains 376 files across 31 directories, the manifest verified 375 files, and the staged Markdown link audit checked 86 Markdown files with 43 documented source/deep-planning references allowed.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:local-audit` passed with the package verification evidence template included, confirming local/staged handoff readiness while preserving expected external evidence blockers.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:completion-audit` correctly failed with `ROADMAP COMPLETION: BLOCKED`; all local sections, including package verification evidence validation, remain ready while non-template Windows field and commercial readiness evidence are still missing.
- `git diff --check` passed after the package verification evidence update.
- `pnpm pilot:field-evidence` now requires field reports to include `packageVerification.evidencePath` and `packageVerification.verifiedBeforeFieldRun: true`, tying tier-3 Windows field evidence to the pre-field package verification proof instead of relying on documentation-only sequencing.
- Strict/reference field evidence validation now loads `qa-runs/YYYY-MM-DD-windows-package-verify-evidence-CLINIC-PC-01.json`, validates it with `pnpm pilot:package-verify-evidence`, and rejects the field report if the package evidence is missing, blocked, or for a different machine/build.
- `pnpm pilot:windows-field-packet` now prints `packageVerifyEvidencePath` and includes `pnpm pilot:package-verify-evidence -- qa-runs/YYYY-MM-DD-windows-package-verify-evidence-CLINIC-PC-01.json` in the field packet command sequence.
- `qa-runs/TEMPLATE-windows-field-evidence.json` and `docs/windows-field-evidence-report.md` now include the `packageVerification` block so filed field reports point at the validated package evidence.
- Synthetic commercial readiness/reference validation now carries the package verification evidence file through the nested field evidence dependency; `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 131 tests after adding missing/blocked/mismatched package-verification field evidence coverage.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:field-evidence -- qa-runs/TEMPLATE-windows-field-evidence.json` correctly failed with `FIELD EVIDENCE: BLOCKED`, now including the missing template package-verification evidence path among the expected blockers.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:windows-field-packet -- --date 2026-06-06 --clinic-label CLINIC-PC-01 --json` passed and emitted the package verification evidence target plus attachment manifest, field evidence, Windows compatibility, filing-plan, commercial-status, and completion-audit commands.
- `PATH="$(pwd):$PATH" corepack pnpm stage:pilot-release`, `pnpm pilot:verify-release`, `pnpm pilot:verify-manifest`, and `pnpm pilot:staged-link-audit` passed; the staged release remains at 376 files across 31 directories, the manifest verified 375 files, and the staged Markdown link audit checked 86 Markdown files with 43 documented source/deep-planning references allowed.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:local-audit` passed with the stricter field evidence/package verification dependency included, confirming local/staged handoff readiness while preserving expected external evidence blockers.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:completion-audit` correctly failed with `ROADMAP COMPLETION: BLOCKED`; all local sections, including package-verification-linked field evidence validation, remain ready while non-template Windows field and commercial readiness evidence are still missing.
- `git diff --check` passed after the field evidence package-verification dependency update.
- `pnpm pilot:evidence-filing-plan` now treats `package-verification` as the first filed evidence item, with target `qa-runs/YYYY-MM-DD-windows-package-verify-evidence-CLINIC-PC-01.json`, template `qa-runs/TEMPLATE-windows-package-verify-evidence.json`, validator `pnpm pilot:package-verify-evidence -- ...`, and packet prep command `pnpm pilot:package-verify-packet -- ...`.
- `pnpm pilot:commercial-evidence-status` now reports `package-verification` as a first-class evidence component, so preflight output explicitly lists missing or invalid package verification evidence before attachment, field, compatibility, signing, installer, update, pilot, support, license, distribution, pricing, marketing, go-live, and commercial readiness evidence.
- `docs/evidence-collection-packet.md` and `docs/commercial-readiness-evidence.md` now describe package verification evidence as part of the filing/status flow, not only the field packet flow.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:evidence-filing-plan -- --date 2026-06-06 --clinic-label CLINIC-PC-01 --json` correctly failed with a blocked JSON plan whose first item is `package-verification`, bringing the total planned evidence files to 15.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:commercial-evidence-status -- --json` correctly failed with `package-verification` as the first blocked component and a missing `qa-runs/*windows-package-verify-evidence*.json` error.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 131 tests after extending filing-plan and commercial-status coverage for package verification evidence.
- `PATH="$(pwd):$PATH" corepack pnpm stage:pilot-release`, `pnpm pilot:verify-release`, `pnpm pilot:verify-manifest`, and `pnpm pilot:staged-link-audit` passed; the staged release remains at 376 files across 31 directories, the manifest verified 375 files, and the staged Markdown link audit checked 86 Markdown files with 43 documented source/deep-planning references allowed.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:local-audit` passed with package verification evidence included in filing/status checks, confirming local/staged handoff readiness while preserving expected external evidence blockers.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:completion-audit` correctly failed with `ROADMAP COMPLETION: BLOCKED`; all local sections, including package-verification-aware filing/status, remain ready while non-template Windows field and commercial readiness evidence are still missing.
- `git diff --check` passed after the filing-plan/commercial-status package verification integration.
- Human Windows field-run docs now match the package-verification-linked evidence chain: `FIELD-TEST-START-HERE.md`, `windows-pilot-field-execution-script.md`, `windows-pilot-field-result-form.md`, and `windows-pilot-go-no-go-checklist.md` all require/file/reference `qa-runs/YYYY-MM-DD-windows-package-verify-evidence-CLINIC-PC-01.json` before field evidence is accepted.
- `windows-pilot-field-result-form.md` now records the package verification evidence path in run metadata and instructs operators to set `packageVerification.evidencePath` plus `packageVerification.verifiedBeforeFieldRun: true` in the field evidence JSON.
- `windows-pilot-field-execution-script.md` now includes package verification evidence in the pre-day-0 IT checklist and in EXEC-16 filing/validation criteria before attachment manifest and field evidence validation.
- `windows-pilot-go-no-go-checklist.md` now requires package verification evidence, not only a manual package-check box, before go/no-go review.
- `roadmap:completion-audit` now verifies the human field-run docs retain the package verification evidence references.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 131 tests after the human-doc alignment checks.
- `PATH="$(pwd):$PATH" corepack pnpm stage:pilot-release`, `pnpm pilot:verify-release`, `pnpm pilot:verify-manifest`, and `pnpm pilot:staged-link-audit` passed; the staged release remains at 376 files across 31 directories, the manifest verified 375 files, and the staged Markdown link audit checked 86 Markdown files with 43 documented source/deep-planning references allowed.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:local-audit` passed with the updated human field-run docs staged and verified, confirming local/staged handoff readiness while preserving expected external evidence blockers.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:completion-audit` correctly failed with `ROADMAP COMPLETION: BLOCKED`; all local sections, including human field-run package verification evidence references, remain ready while non-template Windows field and commercial readiness evidence are still missing.
- `git diff --check` passed after the human field-run package verification evidence alignment.
- The broader Windows field-facing docs now also enforce the package-verification-linked evidence chain: `windows-pilot-real-machine-checklist.md`, `pilot-acceptance-checklist.md`, `windows-pilot-release-notes.md`, and `evidence-attachment-manifest.md` require/file/reference `qa-runs/YYYY-MM-DD-windows-package-verify-evidence-CLINIC-PC-01.json` before or alongside accepted field evidence.
- `roadmap:completion-audit` now verifies those broader field-facing docs retain `pilot:package-verify-evidence`, `packageVerification.evidencePath`, and `pilot:package-verify-evidence` attachment-manifest guidance so the pre-field package proof cannot silently regress.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 131 tests after the broader field-facing doc audit checks.
- `PATH="$(pwd):$PATH" corepack pnpm stage:pilot-release`, `pnpm pilot:verify-release`, `pnpm pilot:verify-manifest`, and `pnpm pilot:staged-link-audit` passed; the staged release remains at 376 files across 31 directories, the manifest verified 375 files, and the staged Markdown link audit checked 86 Markdown files with 43 documented source/deep-planning references allowed.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:local-audit` passed after the broader field-facing package evidence alignment, confirming local/staged handoff readiness while preserving expected external evidence blockers.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:completion-audit` correctly failed with `ROADMAP COMPLETION: BLOCKED`; all local sections remain ready while non-template Windows field evidence and commercial readiness evidence are still missing.
- `git diff --check` passed after the broader field-facing package evidence alignment.
- `scripts/README.md` now lists `pnpm pilot:package-verify-packet` and `pnpm pilot:package-verify-evidence` immediately before the Windows field evidence commands, and its tier-3 warning now requires package verification evidence plus Windows field evidence that references that package proof with `packageVerification.evidencePath`.
- `PILOT-HANDOFF-PACK.md` now links [windows-package-verify-evidence.md](./windows-package-verify-evidence.md), [evidence-attachment-manifest.md](./evidence-attachment-manifest.md), and [windows-field-evidence-report.md](./windows-field-evidence-report.md) from the handoff journey so IT has the machine-readable evidence docs alongside the no-pnpm package checklist.
- `roadmap:completion-audit` now verifies the scripts command index and handoff pack retain the package verification evidence and field evidence report links.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 131 tests after the scripts/handoff evidence index checks.
- `PATH="$(pwd):$PATH" corepack pnpm stage:pilot-release`, `pnpm pilot:verify-release`, `pnpm pilot:verify-manifest`, and `pnpm pilot:staged-link-audit` passed; the staged release remains at 376 files across 31 directories, the manifest verified 375 files, and the staged Markdown link audit checked 86 Markdown files with 43 documented source/deep-planning references allowed.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:local-audit` passed after the scripts/handoff evidence index alignment, confirming local/staged handoff readiness while preserving expected external evidence blockers.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:completion-audit` correctly failed with `ROADMAP COMPLETION: BLOCKED`; all local sections remain ready while non-template Windows field evidence and commercial readiness evidence are still missing.
- `git diff --check` passed after the scripts/handoff evidence index alignment.
- A sidecar read-only audit agent reviewed field/go-live/commercial docs for remaining package-verification prerequisite drift and identified higher-level stale summaries in go-live, clinic-pilot, external-blocker, installer, backup/restore, packaging-gap, guardrail, and product-completeness docs.
- `PILOT-START-HERE.md`, `commercial-readiness-evidence.md`, and `evidence-collection-packet.md` now state that field evidence must reference validated package proof with `packageVerification.evidencePath`, keeping the quick-start, commercial gate, and master packet aligned.
- The sidecar findings were incorporated in `go-live-evidence.md`, `clinic-pilot-report-evidence.md`, `external-field-blockers-decision-record.md`, `out-of-scope-guardrails.md`, `windows-pilot-packaging-gap-report.md`, `windows-pilot-pre-installer-checklist.md`, `INSTALLER-READINESS.md`, `windows-pilot-installer-decision-record.md`, `pilot-backup-restore-audit.md`, and `product-completeness-audit.md`.
- `roadmap:completion-audit` now verifies those higher-level docs retain package verification evidence and `packageVerification.evidencePath` language, so future tier-3 shorthand cannot drift back to “field log only.”
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 131 tests after the quick-start/commercial and sidecar-audited doc alignment checks.
- `PATH="$(pwd):$PATH" corepack pnpm stage:pilot-release`, `pnpm pilot:verify-release`, `pnpm pilot:verify-manifest`, and `pnpm pilot:staged-link-audit` passed; the staged release remains at 376 files across 31 directories, the manifest verified 375 files, and the staged Markdown link audit checked 86 Markdown files with 43 documented source/deep-planning references allowed.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:local-audit` passed after the sidecar-audited doc alignment, confirming local/staged handoff readiness while preserving expected external evidence blockers.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:completion-audit` correctly failed with `ROADMAP COMPLETION: BLOCKED`; all local sections remain ready while non-template Windows field evidence and commercial readiness evidence are still missing.
- `git diff --check` passed after the sidecar-audited doc alignment.
- A follow-up broad stale-wording scan skipped historical `qa-runs/2026-*` reports but updated live operator/status docs that future batches still read: `PILOT-START-HERE.md`, `operator-manual.md`, `PRODUCT-ACCELERATION-REPORT.md`, `mac-pilot-qa-runbook.md`, `clinic-workspace-design-spec.md`, `installer-deferral-decision-record.md`, and `windows-pilot-installer-decision-record.md`.
- Future generated/coordinated packet output now carries the package-verification prerequisite too: `go-live-readiness-packet.mjs`, `commercial-launch-packet.mjs`, and `evidence-collection-packet.mjs` all describe roadmap completion/go-live as blocked until package verification evidence, field evidence referencing it with `packageVerification.evidencePath`, and commercial readiness evidence validate.
- `qa-runs/TEMPLATE-batch-report.md` now asks future batch reports to record both package verification evidence JSON path and Windows field evidence JSON path for tier 3 instead of the old field-log-only shorthand.
- `roadmap:completion-audit` now verifies those live docs, packet generators, and the batch-report template retain `packageVerification.evidencePath` / package-evidence wording.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 131 tests after the follow-up stale-wording guard additions.
- `PATH="$(pwd):$PATH" corepack pnpm stage:pilot-release`, `pnpm pilot:verify-release`, `pnpm pilot:verify-manifest`, and `pnpm pilot:staged-link-audit` passed; the staged release remains at 376 files across 31 directories, the manifest verified 375 files, and the staged Markdown link audit checked 86 Markdown files with 43 documented source/deep-planning references allowed.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:local-audit` passed after the follow-up stale-wording cleanup, confirming local/staged handoff readiness while preserving expected external evidence blockers.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:completion-audit` correctly failed with `ROADMAP COMPLETION: BLOCKED`; all local sections remain ready while non-template Windows field evidence and commercial readiness evidence are still missing.
- `git diff --check` passed after the follow-up stale-wording cleanup.

Note: repo scripts that invoke bare `pnpm` need either a system `pnpm` or the repository-local `pnpm` helper on `PATH` in this environment.

## 2026-06-06 Current Verification Checkpoint

- GitHub remote check: `origin/main` is at `a96131b` (`merge: integrate remote productization updates`) and includes `0f400e4` (`docs: update roadmap handoff checkpoint`) plus `2b7b1ec` (`feat: harden desktop setup and support workflows`); `git pull --ff-only --tags` reported `Already up to date.`
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 131 tests after package-verification-linked field/commercial evidence hardening.
- `PATH="$(pwd):$PATH" corepack pnpm --filter @microdent/app run test` passed with 51 files and 499 tests; existing Vitest stderr includes act warnings and intentional schema-mismatch test noise, but the suite exits successfully.
- `PATH="$(pwd):$PATH" corepack pnpm --filter @microdent/app run build` passed.
- `PATH="$(pwd):$PATH" corepack pnpm stage:pilot-release` passed and staged 376 files across 31 directories under `dist/pilot-release/MicrodentModern/`.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:verify-release` passed.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:verify-manifest` passed and verified 375 files for package `pilot-2026-06-06`, app `0.0.1`, commit `a96131b9de285087afded94f61ae312b1daa5d74`.
- `PATH="$(pwd):$PATH" corepack pnpm pilot:staged-link-audit` passed with 86 checked Markdown files and 43 documented allowed missing/deep-planning references.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:local-audit` passed: local Mac-side staged handoff checks and Windows-test pack/docs/templates are ready.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:completion-audit` correctly failed with `ROADMAP COMPLETION: BLOCKED`; all local sections are ready, but there is still no non-template `qa-runs/*windows-field-evidence*.json` and no non-template `qa-runs/*commercial-readiness*.json`.
- `git diff --check` passed.

Remaining true blockers are external evidence tasks, not local implementation gaps: real Windows staged-package verification, real Windows field execution evidence, commercial readiness evidence, signed installer/signing/update/support/distribution/pricing/marketing/license/go-live evidence, and final commercial approval.

## 2026-06-06 Evidence Chain Hardening Checkpoint

- A read-only side audit checked Windows package verification, field evidence, commercial readiness, and go-live guidance for stale completion shortcuts.
- The Windows field execution sequence above now explicitly requires package verification evidence before the operator field run and requires field evidence to reference `packageVerification.evidencePath`.
- The verification command list now includes `pnpm pilot:package-verify-packet` and `pnpm pilot:package-verify-evidence` before `pnpm pilot:windows-field-packet` / `pnpm pilot:field-evidence`.
- Completion rules now explicitly require package verification evidence, field evidence referencing package verification, and non-template commercial readiness plus go-live evidence before any sellable/commercial completion claim.
- `docs/PILOT-HANDOFF-PACK.md` now blocks clinic go-live until validated package evidence, PHI-safe field evidence referencing `packageVerification.evidencePath`, and non-template commercial/go-live GO evidence exist.
- `scripts/go-live-evidence.mjs` now supports reference validation and `loadAndValidateGoLiveEvidence()` verifies the referenced package, field, clinic pilot, support, and commercial readiness evidence files before standalone CLI use can return `GO-LIVE EVIDENCE: READY`.
- `scripts/commercial-readiness-audit.mjs` now rejects commercial readiness bundles when referenced go-live evidence points at a different commercial readiness report, and it narrows `fieldEvidence.reportPath` to Windows field evidence reports.
- `scripts/roadmap-completion-audit.mjs` now guards the stricter go-live/reference and package-verification wording so these evidence-chain requirements cannot silently regress.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 135 tests after the hardening changes.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:local-audit` passed after regenerating the staged release; staged output remains 376 files across 31 directories, manifest verification remains 375 files, and staged Markdown link audit remains 86 files with 43 documented allowed missing/deep-planning references.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:completion-audit` still correctly reports `ROADMAP COMPLETION: BLOCKED` because real non-template Windows field evidence and commercial readiness evidence are still absent.
- `git diff --check` passed.

## 2026-06-06 Quick-Start Evidence Wording Checkpoint

- `docs/PILOT-START-HERE.md` now asks whether package verification evidence and real Windows field evidence are filed, not whether a generic Windows run was logged.
- The quick-start field-pack path now routes operators through package verification evidence before the Windows field execution script.
- `docs/PILOT-START-HERE.md` now describes `pnpm pilot:field-evidence` as validating real Windows field JSON referencing `packageVerification.evidencePath`, and `pnpm pilot:go-live-evidence` as checking referenced package, field, clinic pilot, support, and commercial readiness evidence files.
- `docs/commercial-readiness-evidence.md` now says the Windows field evidence JSON references package proof with `packageVerification.evidencePath`, replacing the looser field-report wording.
- `scripts/roadmap-completion-audit.mjs` now guards these high-visibility quick-start and commercial-readiness phrases.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 137 tests.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:local-audit` passed after regenerating the staged release; staged output remains 376 files across 31 directories, manifest verification remains 375 files, and staged Markdown link audit remains 86 files with 43 documented allowed missing/deep-planning references.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:completion-audit` still correctly reports `ROADMAP COMPLETION: BLOCKED` because real non-template Windows field evidence and commercial readiness evidence are still absent.
- `git diff --check` passed.

## 2026-06-06 Status Output Parity Checkpoint

- A read-only side audit checked shell/Node status output parity for `roadmap-local-audit`, `pilot-release-signoff`, `pilot-mac-release-status`, `scripts/README.md`, and staged root quick-start output.
- `scripts/pilot-release-signoff.mjs`, `scripts/pilot-release-signoff.sh`, and `scripts/pilot-mac-release-status.mjs` now summarize clinic go-live as blocked on package evidence, linked field evidence, and commercial/go-live evidence instead of generic go/no-go wording.
- `scripts/README.md` now describes `pnpm pilot:field-evidence` as validating Windows field evidence that references `packageVerification.evidencePath`, and describes `pnpm pilot:go-live-evidence` as validating referenced package, field, clinic pilot, support, and commercial readiness evidence files.
- `scripts/roadmap-local-audit.mjs` and `scripts/roadmap-local-audit.sh` now print tier 3 as blocked until package verification and field evidence with `packageVerification.evidencePath` are filed.
- `scripts/stage-pilot-release.mjs` now generates root `PILOT-START-HERE.md` with package verification evidence before Windows field execution.
- `docs/commercial-readiness-evidence.md` now uses the same go-live evidence description as the script index.
- `scripts/roadmap-completion-audit.mjs` guards those status-output and staged quick-start strings.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 137 tests.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:local-audit` passed after regenerating the staged release; tier 3 now reports blocked until package verification and field evidence with `packageVerification.evidencePath` are filed.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:completion-audit` still correctly reports `ROADMAP COMPLETION: BLOCKED` because real non-template Windows field evidence and commercial readiness evidence are still absent.
- `git diff --check` passed.

## 2026-06-06 Go-Live / Commercial Evidence Preflight Checkpoint

- A read-only side audit checked generated filing/status packets and `qa-runs` templates for stale package/field/commercial/go-live evidence instructions.
- `scripts/commercial-evidence-status.mjs` now validates go-live evidence with referenced package, field, clinic pilot, support, and commercial readiness evidence files instead of treating go-live as a shallow JSON shape check.
- `scripts/commercial-readiness-audit.mjs` now invokes go-live evidence with reference validation when loading final commercial readiness evidence.
- `scripts/pilot-release-artifacts.test.mjs` added regression tests proving commercial readiness and commercial evidence status stay blocked when go-live evidence references missing nested evidence files.
- `scripts/evidence-filing-plan.mjs` and `scripts/go-live-readiness-packet.mjs` now explain the final-gate cross-reference pattern: prepare commercial readiness and go-live evidence together so `commercialReadinessPath` / `goLiveEvidencePath` match, then validate commercial readiness/status with the public key and go-live evidence with referenced files checked.
- `qa-runs/TEMPLATE-batch-report.md`, `scripts/README.md`, `scripts/pilot-release-signoff.mjs`, `scripts/pilot-release-signoff.sh`, `scripts/pilot-mac-release-status.mjs`, `scripts/stage-pilot-release.mjs`, and the high-visibility operator docs now prefer “Windows field evidence JSON” over the older “field log” shorthand for readiness gates.
- `docs/go-live-evidence.md` now states that `pnpm pilot:go-live-evidence` loads and checks referenced package verification, Windows field, clinic pilot, support readiness, and commercial readiness evidence files before reporting ready.
- `scripts/roadmap-completion-audit.mjs` now guards the stricter commercial/go-live reference-validation behavior and the updated Windows field evidence wording.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 137 tests.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:local-audit` passed after regenerating the staged release; staged output remains 376 files across 31 directories, manifest verification remains 375 files, and staged Markdown link audit remains 86 files with 43 documented allowed missing/deep-planning references.
- `PATH="$(pwd):$PATH" corepack pnpm roadmap:completion-audit` still correctly reports `ROADMAP COMPLETION: BLOCKED` because real non-template Windows field evidence and commercial readiness evidence are still absent.
- `git diff --check` passed.

## 2026-06-06 Operator Evidence Wording Checkpoint

- Follow-up live-doc scan removed the remaining future-facing shorthand that could make an issue note, generic field run, or plain go/no-go mention look like completion evidence.
- `docs/pilot-issue-template.md` now says the issue template can support PHI-safe attachment notes but is not a substitute for filed Windows field evidence JSON.
- `docs/operator-manual.md`, `docs/mac-pilot-qa-runbook.md`, and `docs/external-field-blockers-decision-record.md` now refer to Windows field evidence and a filed go/no-go checklist instead of looser field-run/log wording.
- `docs/windows-pilot-real-machine-checklist.md` now labels the old inline Markdown example as supporting field evidence notes, not a field log that could replace the required Windows field evidence JSON.
- `docs/external-field-blockers-decision-record.md` now lists distribution, pricing, marketing, license, and go-live evidence in the expected commercial-readiness blocker set.

## 2026-06-06 External Blocker Table Alignment Checkpoint

- The roadmap's top-level external blocker table now names the same required evidence chain as the validators: package verification evidence first, PHI-safe field attachments, signed result form, and Windows field evidence JSON referencing `packageVerification.evidencePath`.
- `scripts/roadmap-completion-audit.mjs` now guards that top-level roadmap wording so the source-of-truth blocker table cannot drift back to field-script-only evidence.

## 2026-06-06 Primary Roadmap Evidence Chain Alignment Checkpoint

- `docs/PRODUCT-COMPLETION-ROADMAP.md` now describes the Windows field blocker as missing package verification evidence plus Windows field evidence JSON referencing `packageVerification.evidencePath`.
- The Phase 3 field checklist now includes the package verification evidence prerequisite before operator field steps and requires the EXEC-16 sign-off to be followed by Windows field evidence JSON.
- The production-readiness status line now names the broader commercial evidence chain: support, distribution, pricing, marketing, license, go-live, and pilot evidence in addition to signing, installer, and update proof.
- `scripts/roadmap-completion-audit.mjs` now guards those primary-roadmap strings so the authoritative product roadmap stays aligned with the stricter validators.

## 2026-06-06 Handoff Evidence Chain Alignment Checkpoint

- A sidecar read-only audit found remaining handoff/start-page shorthand that could imply a generic field run, issue note, or go-live JSON shape was enough.
- `docs/PILOT-HANDOFF-PACK.md` now asks whether package verification evidence and Windows field evidence JSON are filed, and describes sponsor sign-off as following validated package verification plus filed Windows field evidence.
- `docs/FIELD-TEST-START-HERE.md` now says commercial validators are used after package verification evidence and Windows field evidence JSON are filed and validated.
- `docs/PILOT-START-HERE.md` now describes `pnpm pilot:go-live-evidence` as validating referenced package, field, clinic pilot, support, and commercial readiness evidence files.
- `scripts/roadmap-completion-audit.mjs` now guards these handoff/start-page strings.

## 2026-06-06 Package Verification Completion Gate Checkpoint

- `scripts/roadmap-completion-audit.mjs` now treats Windows package verification as a first-class completion gate instead of only discovering it through field evidence reference validation.
- Completion output now includes `package_verification=ready|blocked`, validates any non-template `qa-runs/*windows-package-verify-evidence*.json`, and reports a specific blocker when no completed package verification evidence JSON is filed.
- `scripts/pilot-release-artifacts.test.mjs` now asserts roadmap completion stays blocked on missing package verification evidence alongside missing Windows field and commercial readiness evidence.

## 2026-06-06 Local Audit Package Gate Visibility Checkpoint

- `scripts/roadmap-local-audit.mjs` and `scripts/roadmap-local-audit.sh` now require `pnpm roadmap:completion-audit` output to include `package_verification=blocked`, so the local audit proves the package gate remains visible.
- `scripts/README.md` now documents `pnpm roadmap:completion-audit` as checking explicit package verification, Windows field evidence, and commercial readiness gates.

## 2026-06-06 Quick-Start Completion Gate Visibility Checkpoint

- `docs/PILOT-START-HERE.md` now describes `pnpm roadmap:completion-audit` as blocked until non-template package verification, Windows field, and commercial readiness evidence are filed.
- The final quick-start command checklist now says completion audit checks explicit package verification, Windows field evidence, commercial readiness, and nested offline license signature verification.
- `scripts/roadmap-completion-audit.mjs` now guards those quick-start completion-gate strings.

## 2026-06-06 Evidence Coordinator Three-Gate Wording Checkpoint

- `docs/evidence-collection-packet.md`, `docs/commercial-readiness-evidence.md`, and `docs/PILOT-START-HERE.md` now describe the coordinated evidence run as package-verification, field, and commercial evidence rather than the older field/commercial shorthand.
- `scripts/evidence-filing-plan.mjs`, `scripts/roadmap-local-audit.mjs`, and `scripts/roadmap-local-audit.sh` now use the same three-gate wording in comments.

## 2026-06-06 Completion Audit Ready-Path Coverage Checkpoint

- `scripts/roadmap-completion-audit.mjs` now exports `REQUIRED_LOCAL_EVIDENCE` so tests can construct a minimal temporary repo with the same local evidence requirements the real audit uses.
- `scripts/pilot-release-artifacts.test.mjs` now adds a ready-path regression test: it writes minimal local evidence plus a complete synthetic package verification, Windows field, commercial readiness, go-live, and supporting evidence bundle in a temp repo, then proves `auditRoadmapCompletion()` returns `READY`.
- `pnpm roadmap:completion-audit -- --json --repo-root <path> --public-key <key>` now supports alternate repo roots, and the test suite proves the actual CLI returns ready JSON for a complete synthetic evidence bundle.
- The signed offline license fixture now retries generated Ed25519 signatures that accidentally contain validator-forbidden placeholder tokens, avoiding flaky false failures while preserving the PHI/placeholder guard.
- `PATH="$(pwd):$PATH" corepack pnpm test:pilot-artifacts` passed with 138 tests after adding the ready-path completion audit coverage.

## 2026-06-06 Completion Audit Alternate-Root Documentation Checkpoint

- `scripts/README.md` and `docs/PILOT-START-HERE.md` now document `--repo-root` for `pnpm roadmap:completion-audit`, making clear it is only for auditing an alternate checkout/evidence bundle.
- `scripts/roadmap-completion-audit.mjs` now guards the command index and quick-start docs for `--repo-root` discoverability.

## 2026-06-06 Evidence Status Alternate-Root CLI Checkpoint

- `pnpm pilot:commercial-evidence-status -- --json --repo-root <path> --public-key <key>` now supports alternate checkout/evidence bundle scans, matching the completion audit workflow.
- `pnpm pilot:evidence-filing-plan -- --json --repo-root <path> --public-key <key>` now supports alternate checkout/evidence bundle planning.
- `scripts/pilot-release-artifacts.test.mjs` now proves both CLIs return ready JSON against a complete synthetic evidence bundle.
- `scripts/README.md`, `docs/PILOT-START-HERE.md`, and `scripts/roadmap-completion-audit.mjs` now document/guard those alternate-root status and filing-plan workflows.

## 2026-06-06 Commercial Readiness Alternate-Root CLI Checkpoint

- `pnpm pilot:commercial-readiness -- qa-runs/YYYY-MM-DD-commercial-readiness-evidence.json --repo-root <path> --public-key <key>` now resolves relative evidence paths against the alternate repo root while preserving cross-report path matching.
- `scripts/pilot-release-artifacts.test.mjs` proves the commercial-readiness CLI returns ready output for a complete synthetic alternate checkout/evidence bundle.
- `scripts/README.md`, `docs/PILOT-START-HERE.md`, `docs/commercial-readiness-evidence.md`, and `scripts/roadmap-completion-audit.mjs` now document/guard the commercial-readiness alternate-root workflow.

## 2026-06-06 Field And Go-Live Alternate-Root CLI Checkpoint

- `pnpm pilot:field-evidence -- qa-runs/YYYY-MM-DD-windows-field-evidence-CLINIC-PC-01.json --repo-root <path>` now resolves relative field evidence paths against an alternate repo root and validates referenced package/attachment evidence from the same bundle.
- `pnpm pilot:go-live-evidence -- qa-runs/YYYY-MM-DD-go-live-evidence.json --repo-root <path>` now resolves relative go-live evidence paths against an alternate repo root and validates referenced package, field, clinic pilot, support, and commercial readiness evidence from the same bundle.
- `scripts/pilot-release-artifacts.test.mjs` proves both CLIs return ready output for complete synthetic alternate checkout/evidence bundles.
- `scripts/README.md`, `docs/PILOT-START-HERE.md`, `docs/windows-field-evidence-report.md`, `docs/go-live-evidence.md`, and `scripts/roadmap-completion-audit.mjs` now document/guard these alternate-root evidence workflows.

## 2026-06-06 Foundational Evidence Alternate-Root CLI Checkpoint

- `pnpm pilot:package-verify-evidence -- qa-runs/YYYY-MM-DD-windows-package-verify-evidence-CLINIC-PC-01.json --repo-root <path>` now resolves relative package verification evidence paths against an alternate checkout/evidence bundle.
- `pnpm pilot:attachment-manifest -- qa-runs/YYYY-MM-DD-evidence-attachment-manifest-CLINIC-PC-01.json --repo-root <path>` now resolves relative attachment manifest paths against an alternate checkout/evidence bundle.
- `pnpm license:validate -- qa-runs/YYYY-MM-DD-offline-license-CLINIC-PC-01.json --repo-root <path> --public-key keys/microdent-license-public.pem` now resolves both the relative license path and relative public-key path against the alternate checkout/evidence bundle.
- `scripts/pilot-release-artifacts.test.mjs` proves all three foundational CLIs return ready output for complete synthetic alternate checkout/evidence bundles.
- `scripts/README.md`, `docs/PILOT-START-HERE.md`, `docs/windows-package-verify-evidence.md`, `docs/evidence-attachment-manifest.md`, `docs/offline-license-mechanism.md`, `docs/licensing-readiness.md`, and `scripts/roadmap-completion-audit.mjs` now document/guard these foundational alternate-root workflows.

## 2026-06-06 Production Evidence Alternate-Root CLI Checkpoint

- `pnpm pilot:windows-compatibility -- qa-runs/YYYY-MM-DD-windows-compatibility-evidence.json --repo-root <path>` now resolves relative compatibility evidence paths against an alternate checkout/evidence bundle.
- `pnpm pilot:signed-artifacts -- qa-runs/YYYY-MM-DD-signed-artifact-evidence.json --repo-root <path>` now resolves relative signing evidence paths against an alternate checkout/evidence bundle.
- `pnpm pilot:installer-evidence -- qa-runs/YYYY-MM-DD-installer-evidence.json --repo-root <path>` now resolves relative installer evidence paths against an alternate checkout/evidence bundle.
- `pnpm pilot:auto-update-evidence -- qa-runs/YYYY-MM-DD-auto-update-evidence.json --repo-root <path>` now resolves relative update evidence paths against an alternate checkout/evidence bundle.
- `scripts/pilot-release-artifacts.test.mjs` proves all four production evidence CLIs return ready output for complete synthetic alternate checkout/evidence bundles.
- `scripts/README.md`, `docs/PILOT-START-HERE.md`, `docs/windows-compatibility-evidence.md`, `docs/signed-artifact-evidence.md`, `docs/installer-evidence.md`, `docs/auto-update-evidence.md`, and `scripts/roadmap-completion-audit.mjs` now document/guard these production evidence alternate-root workflows.

## 2026-06-06 Commercial Operations Alternate-Root CLI Checkpoint

- `pnpm pilot:clinic-report -- qa-runs/YYYY-MM-DD-clinic-pilot-report-CLINIC-PC-01.json --repo-root <path>` now resolves relative clinic pilot report evidence paths against an alternate checkout/evidence bundle.
- `pnpm pilot:support-readiness -- qa-runs/YYYY-MM-DD-support-readiness-evidence.json --repo-root <path>` now resolves relative support readiness evidence paths against an alternate checkout/evidence bundle.
- `pnpm pilot:distribution-evidence -- qa-runs/YYYY-MM-DD-distribution-evidence.json --repo-root <path>` now resolves relative distribution evidence paths against an alternate checkout/evidence bundle.
- `pnpm pilot:pricing-evidence -- qa-runs/YYYY-MM-DD-pricing-evidence.json --repo-root <path>` now resolves relative pricing evidence paths against an alternate checkout/evidence bundle.
- `pnpm pilot:marketing-evidence -- qa-runs/YYYY-MM-DD-marketing-evidence.json --repo-root <path>` now resolves relative marketing evidence paths against an alternate checkout/evidence bundle.
- `scripts/pilot-release-artifacts.test.mjs` proves all five commercial operations CLIs return ready output for complete synthetic alternate checkout/evidence bundles.
- `scripts/README.md`, `docs/PILOT-START-HERE.md`, `docs/clinic-pilot-report-evidence.md`, `docs/support-readiness-evidence.md`, `docs/distribution-evidence.md`, `docs/pricing-evidence.md`, `docs/marketing-evidence.md`, and `scripts/roadmap-completion-audit.mjs` now document/guard these commercial operations alternate-root workflows.

## 2026-06-06 Evidence CLI Alternate-Root Meta-Guard Checkpoint

- `scripts/pilot-release-artifacts.test.mjs` now has an `evidence CLI alternate-root support` regression test that checks every filed-evidence/final-gate command is wired to the expected Node script, exposes `--repo-root`, and is present in both `scripts/README.md` and `docs/PILOT-START-HERE.md`.
- `scripts/roadmap-completion-audit.mjs` now guards that meta-test text so the alternate-root evidence bundle workflow cannot silently regress as more evidence commands are added.

## 2026-06-06 Exact Staged Template Set Audit Checkpoint

- `pnpm roadmap:local-audit` now compares the source `qa-runs/TEMPLATE-*` filenames with the staged release `qa-runs/TEMPLATE-*` filenames exactly, instead of only checking the final count.
- The audit fails on either missing staged templates or unexpected staged templates, and still verifies the source and staged template counts are both 23.
- `scripts/pilot-release-artifacts.test.mjs` and `scripts/roadmap-completion-audit.mjs` now guard those exact-set failure strings so the staged evidence-template check cannot quietly regress.

## 2026-06-06 Bash Local Audit Parity Checkpoint

- `scripts/roadmap-local-audit.sh` now mirrors the Node local audit by generating the evidence collection packet, running `pnpm pilot:staged-link-audit`, and comparing source/staged `qa-runs/TEMPLATE-*` filenames exactly.
- `scripts/pilot-release-artifacts.test.mjs` now checks both the Node and Bash local audit entrypoints for the evidence packet, staged link audit, exact template-set failure strings, and visible package-verification blocker.
- `scripts/roadmap-completion-audit.mjs` now guards the Bash fallback parity strings so the fallback cannot silently become weaker than the default Node audit.

## 2026-06-06 Filing Plan Package Blocker Clarity Checkpoint

- `scripts/evidence-filing-plan.mjs` now uses the strict roadmap completion audit's package-verification evidence candidates for the first filing-plan item, so a missing first-gate JSON reports `no completed non-template windows package verification evidence is filed under qa-runs/`.
- `scripts/pilot-release-artifacts.test.mjs` now proves both JSON and Markdown filing plans surface that explicit package-verification blocker before field/commercial evidence can proceed.
- `scripts/roadmap-completion-audit.mjs` now guards the filing-plan package blocker wording so the operator checklist stays aligned with the strict completion gate.

## 2026-06-06 Alternate-Root Public-Key Resolution Checkpoint

- `scripts/evidence-filing-plan.mjs`, `scripts/commercial-evidence-status.mjs`, `scripts/commercial-readiness-audit.mjs`, and `scripts/roadmap-completion-audit.mjs` now resolve relative `--public-key` paths against `--repo-root` after parsing all arguments, so `--repo-root <bundle> --public-key keys/microdent-license-public.pem` works regardless of flag order.
- `scripts/pilot-release-artifacts.test.mjs` now runs the complete alternate-root CLI ready-path tests with relative `keys/microdent-license-public.pem` public-key arguments instead of absolute temp paths.
- `scripts/roadmap-completion-audit.mjs` now guards the public-key resolution helper strings so the documented alternate checkout/evidence bundle flow cannot regress quietly.

## 2026-06-06 Alternate-Root Filing Plan Write Checkpoint

- `pnpm pilot:evidence-filing-plan -- --repo-root <bundle> --write qa-runs/YYYY-MM-DD-evidence-filing-plan.md` now writes relative Markdown output under the alternate repo root instead of the caller's current working directory.
- `scripts/pilot-release-artifacts.test.mjs` now proves a blocked alternate-root filing plan writes the Markdown checklist into the temp evidence bundle and does not create the same relative file in the working checkout.
- `scripts/roadmap-completion-audit.mjs` now guards the filing-plan `writeOutputPath` behavior so the alternate checkout/evidence bundle workflow remains safe for real evidence collection.

## 2026-06-06 Master Evidence Packet Write Root Checkpoint

- `pnpm pilot:evidence-collection-packet -- --write qa-runs/YYYY-MM-DD-evidence-collection-packet-CLINIC-PC-01.md` now writes relative Markdown output under the repository root even if the command is invoked from another current working directory.
- `scripts/pilot-release-artifacts.test.mjs` now invokes `scripts/evidence-collection-packet.mjs` from a temporary directory and proves the packet lands in the checkout `qa-runs/` path, not in the caller's directory.
- `scripts/roadmap-completion-audit.mjs` now guards the master packet `writeOutputPath` behavior so the top-level evidence collection command cannot scatter output outside the repo checkout.

## 2026-06-06 Evidence Packet Absolute Write Checkpoint

- The package verification, Windows field, installer readiness, auto-update readiness, commercial launch, go-live, and master evidence packet generators now honor absolute `--write` paths exactly while continuing to anchor relative output paths under the repo checkout.
- `scripts/pilot-release-artifacts.test.mjs` now runs every evidence packet CLI with an absolute temporary output path and proves each packet writes to that path instead of accidentally nesting it under the repository.
- `scripts/roadmap-completion-audit.mjs` now guards the absolute-write path handling and regression-test text so external evidence coordinators can safely write packets into temp bundles or handoff folders without losing files.

## 2026-06-06 Filing Plan Default Write Root Checkpoint

- `pnpm pilot:evidence-filing-plan -- --write qa-runs/YYYY-MM-DD-evidence-filing-plan.md` now writes relative Markdown output under the repository root when no `--repo-root` is supplied, matching the packet generators and avoiding caller-current-directory drift.
- The alternate-root behavior remains intact: `--repo-root <bundle> --write qa-runs/...` still writes into the alternate checkout/evidence bundle.
- `scripts/pilot-release-artifacts.test.mjs` now invokes `scripts/evidence-filing-plan.mjs` from a temporary directory without `--repo-root` and proves the plan lands in the checkout `qa-runs/` path, not in the caller's directory.
- `scripts/roadmap-completion-audit.mjs` now guards this default write-root behavior so field coordinators get predictable filing-plan output before real package, field, and commercial evidence is filed.

## 2026-06-06 Default Public-Key Root Checkpoint

- `pnpm pilot:commercial-evidence-status`, `pnpm pilot:commercial-readiness`, `pnpm pilot:evidence-filing-plan`, `pnpm license:validate`, and `pnpm roadmap:completion-audit` now resolve relative `--public-key` paths against the repository root when no `--repo-root` is supplied.
- Alternate evidence bundles still use `--repo-root <bundle> --public-key keys/...` to resolve the key inside the bundle.
- `scripts/pilot-release-artifacts.test.mjs` now guards the checkout-root default for these public-key coordinators, and `scripts/roadmap-completion-audit.mjs` requires the same behavior.
- The artifact test also guards repeated operator-doc command-table wording counts so the repo-root public-key guidance cannot drift down to a single partially documented row.
