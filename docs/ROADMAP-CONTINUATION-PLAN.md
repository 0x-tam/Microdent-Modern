# Microdent Modern — Continuation Plan to Reach Product Completion

**Baseline:** commit `0f400e4` (`docs: update roadmap handoff checkpoint`) on 2026-06-06.  
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
| Windows field execution `EXEC-01` through `EXEC-16` | The app has not been proven on a real clinic Windows PC. | Completed field script, screenshots/logs without PHI, signed result form. |
| Windows 10/11 validation | Commercial target is Windows clinics. | Test matrix results on Windows 10 and 11. |
| Antivirus/endpoint validation | Clinic environments commonly lock local apps, Node, SQLite, or DBF files. | AV test notes and any required exclusions. |
| Code signing certificate | Unsigned Electron apps trigger SmartScreen and are not commercially acceptable. | Authenticode certificate, signed executable verification. |
| Signed installer | Current release is staged portable output, not a professional install flow. | Signed NSIS/MSI installer with install/uninstall proof. |
| Auto-update feed | Production support needs safe update distribution. | Update channel decision and working update test. |
| Real clinic pilot | Sellable status needs clinical feedback and operational proof. | 1-3 clinic pilot reports and issue triage. |

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
3. Run first-run setup.
4. Choose copied clinic data folder and derived paths.
5. Confirm automatic local-copy import.
6. Read-only smoke: Today, Patients, Schedule, Settings.
7. Verify clinic service health.
8. Enable sandbox writes only in disposable sandbox.
9. Test appointment status update.
10. Test appointment time move.
11. Test appointment creation.
12. Test demographics update.
13. Verify backup before writes.
14. Verify DBF readback proof.
15. Verify restore workflow.
16. Complete field result form and sign-off.

Do not mark the roadmap complete until this evidence exists.

## 7. Commercial Launch Track

After field execution:

- Clinical pilot with 1-3 clinics.
- Feedback collection system.
- Issue triage workflow.
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
```

Use `pnpm pilot:release-signoff` only when sandbox environment paths are configured for the strict signoff gate.

## 10. Completion Rules

Do not mark the roadmap complete until:

- Every unchecked roadmap item is either completed with evidence or formally deferred with a decision record.
- Windows field execution has passed.
- Installer/signing/update decisions are implemented or explicitly deferred for a non-commercial pilot.
- No primary UI exposes bridge/DBF/SQLite/`DATA_ROOT`/`SQLITE_PATH` internals to normal operators.
- Support exports/log previews remain PHI-safe.
- Dental chart/tooth visuals remain unchanged unless validated replacement assets/design exist.
- Full release verification passes from a clean checkout.
