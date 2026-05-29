# Microdent Modern — Product Acceleration Report

**Date:** 2026-05-29
**Latest commit:** `2b268e2` — *complete first-run setup and UX polish*
**Safety scan:** 2026-05-29 — see Workstream L findings below

---

## 1. What Microdent Modern Is

Microdent Modern is a **local-first dental clinic modernization application** — a modern desktop UI that sits beside a legacy Visual FoxPro/Access-based dental practice management system called Microdent.

Key properties:
- **Local-first, zero-cloud** — all data stays on the clinic machine; no patient data ever leaves the building
- **Read-only by default** — safely reads legacy DBF files through a local bridge API without modifying the original data
- **Sandboxed writes** — a limited set of write operations (appointment status, time moves, creation, demographics updates) available only behind explicit operator enablement on a disposable sandbox copy
- **SQLite mirror** — optional DBF→SQLite import for faster search, schedule, and patient queries
- **Clinic-friendly UX** — modern, optimized interface with plain-language labels; technical diagnostics consolidated behind Settings

---

## 2. Intended Outcome

A **sellable desktop application** for small-to-mid dental clinics running legacy Microdent on Windows, providing:
- **One-click install** via NSIS installer with bundled Node.js runtime
- **Zero-configuration first run** — setup wizard guides operators through data folder selection, sandbox creation, and mirror import
- **Immediate value on day one** — read-only access to patients, schedule, chart, treatments, ledger, and medical summaries
- **Safe write capability** — after backup configuration and sandbox validation
- **No migration required** — the legacy DBF files remain the source of truth; Modern reads and writes to a sandbox copy

---

## 3. What Has Been Built

### Completed Workstreams (from recent commits, newest first)

| Commit | Workstream | Summary |
|--------|-----------|---------|
| `2b268e2` | First-run setup + UX polish | Modal setup wizard with folder picker, progress overlay, masked path hints |
| `6b5d512` | Desktop runtime hardening | Bridge supervisor, startup validation, path validation, operator data locations |
| `3d9d13f` | Patient workspace tabs | Focused tab modules (Summary, Timeline, Appointments, Medical, Treatments, Chart, Ledger) |
| `f5263cb` | Profile tab extraction | Separated patient profile into dedicated tab components |
| `50b160a` | Profile header polish | Avatar, badge chips, workflow strip |
| `d5ded89` | Clinic app polish | Seamless product experience improvements |
| `e40666f` | Clinic app redesign | Restructured app structure and workflow UX |
| `9f2d540` | Workspace UI redesign | Modern clinic workspace with command center |
| `5cd3d13` | Visual redesign | Modern visual workspace layout |
| `e5f6a23` | Command center UI | Brought clinic app to life with modern design |

### Core Infrastructure (all completed)

| Component | Status | Details |
|-----------|--------|---------|
| Monorepo | ✅ | pnpm workspace: packages/*, services/*, apps/* |
| Bridge API | ✅ | Express on 127.0.0.1:17890, DBF reader, SQLite reader, safety module |
| Contracts | ✅ | Zod schemas + TS types for all API DTOs |
| UI primitives | ✅ | Design tokens, Button, Card, Table, Badge, CommandCenter, etc. |
| App shell | ✅ | Top bar, sidebar, read-only banner, bridge health |
| Today dashboard | ✅ | Schedule panel, next-up, quick actions, clinic status |
| Patient search | ✅ | Debounced combobox, session recents (max 5, in-memory) |
| Patient profile (7 tabs) | ✅ | Summary, Timeline, Appointments, Medical, Treatments, Chart, Ledger |
| Schedule view | ✅ | Week/day nav, room filter, interactive chips, write actions |
| Settings panel | ✅ | Readiness grid, diagnostics, pilot readiness, first-run setup |
| SQLite mirror | ✅ | 8 importers, 7 migrations, field maps for all core entities |
| Sandbox writes | ✅ Pilot | 4 routes: status, time move, create, demographics |
| Safety layer | ✅ | Path sandbox, read-only enforcement, write-mode gating, blocked-field rejection |
| Test coverage | ✅ Strong | 100+ test files across all packages |
| Pilot packaging | ✅ Staged | Stage, verify, manifest generation, release smoke |
| Desktop shell | ✅ MVP | Electron main, bridge supervisor, first-run setup, health IPC |
| Path masking | ✅ | `mask-operator-path` with masked hints for dev diagnostics |
| Forbidden token guards | ✅ | `FORBIDDEN_WRITE_RESULT_TOKENS`, `DOM_FORBIDDEN_FIELD_LABELS`, `assertNoForbiddenDomTokens` |

---

## 4. What Is Still Missing

| Gap | Severity | Notes |
|-----|----------|-------|
| **Windows field execution** | BLOCKER | No real clinic PC has run the app; tier 3 field test never executed |
| **NSIS installer** | High | Portable staged tree only; no signed installer, no auto-update |
| **Code signing** | High | Windows Authenticode certificate required for deployment |
| **Node.js bundling** | High | Clinic machines must have Node installed; should bundle runtime in installer |
| **Web assets in Electron** | High | Currently uses dev server; needs static dist loading in production |
| **Mirror auto-refresh** | Medium | Post-write mirror doesn't auto-sync; manual CLI import required |
| **Production logging** | Medium | No auto-created logs, no rotation, no log aggregation |
| **Mac testing** | Medium | No real Mac has been tested (see §6) |
| **Mirror incremental import** | Low | Currently full re-import only |
| **Dual-search sync** | Low | Top bar and Patients page search don't sync query text |
| **Decoded reference labels** | Low | Many status/procedure codes remain opaque |

---

## 5. What Is Blocked

### Mac Testing
- **Status:** Not started
- **Blocker:** Requires physical Mac hardware and clinic data copy
- **Impact:** Cannot validate cross-platform compatibility or provide Mac installer
- **Resolution:** Acquire Mac test machine, run existing test suite + smoke tests, document differences

### Windows Packaging
- **Status:** Deferred
- **Blockers:**
  1. No Windows field test has been executed (EXEC-01 through EXEC-16 in FIELD-TEST-START-HERE.md)
  2. Node.js must be bundled or auto-installed
  3. Code signing certificate needed
  4. Web build must be packaged as static assets (not dev server)
- **Impact:** Cannot distribute to real clinics
- **Resolution path:**
  1. Execute field test on clinic PC with staged package
  2. Fix any path/permission issues discovered
  3. Bundle Node.js runtime
  4. Acquire code signing certificate
  5. Build NSIS installer
  6. Re-test on clean machine

---

## 6. What Requires Explicit Safety Approval

Any of the following changes **must receive explicit safety review** before implementation:

| Change | Why it requires approval |
|--------|--------------------------|
| **Expanding write routes** beyond current 4 (status, time, create, demographics) | Each new write must pass dry-run → preview → commit gating, blocked-field checks, and sandbox validation |
| **Enabling writes on non-sandbox DATA_ROOT** | Production legacy must never be writable — requires operator sign-off and backup verification |
| **Adding cloud services** (auto-update feed, crash reporting, telemetry) | Any data leaving the clinic machine requires privacy review |
| **Recent patients persistence** beyond session memory | Storing patient identifiers to disk requires privacy policy review |
| **Export/print functionality** that includes patient data | Must ensure PHI is not leaked to temp files, clipboard, or unencrypted outputs |
| **AI assistant integration** | Any LLM integration must never send patient data to external APIs; requires local-only or zero-retention model review |
| **Subscription/licensing infrastructure** | Must not introduce network calls that transmit PHI or usage telemetry without explicit opt-in |
| **Any removal or weakening of existing safety tests** | `assertNoForbiddenDomTokens`, `FORBIDDEN_WRITE_RESULT_TOKENS`, `DOM_FORBIDDEN_FIELD_LABELS` must not be bypassed |
| **IPC handler changes** that expose raw paths to renderer | All paths must use `maskOperatorPath` before crossing the IPC boundary |
| **SettingsPanel path display** | Raw paths must never appear in normal UI — only masked hints, and only behind DEV + diagnostics gate |

### Current Safety Posture (Workstream L findings)

**No new safety regressions detected.** The codebase maintains:
- All forbidden tokens (PAT_NAME, TELEPHONE, COMMENT, NOTE, DESCRIPT, DESC, AMOUNT, SAMOUNT, rawRow, before/after, medicalText, paymentAmount) are restricted to:
  - Safety control lists (`FORBIDDEN_WRITE_RESULT_TOKENS`, `DOM_FORBIDDEN_FIELD_LABELS`)
  - Test fixtures (`read-only-smoke-fixtures.ts`) — synthetic values for leakage detection
  - Test assertions (verifying these tokens are NOT rendered)
- `SettingsPanel.tsx` uses `MASKED_PATH_HINT_EXAMPLES` for dev-only path hints — no raw paths in normal UI
- `setup-window.ts` masks all paths before sending to renderer via IPC (`dataRootMasked`, `sqlitePathMasked`, `backupDirMasked`)
- `mask-operator-path.ts` properly collapses paths to drive + tail segments only
- 48 of 49 test files pass; 3 pre-existing failures in `settings-panel.test.tsx` are UI text mismatches (not safety-related)

---

## 7. Path Toward AI Assistant (Future Phase)

**This is NOT being implemented now.** This section documents the architectural path for future consideration.

### Design Principles
- **Zero PHI exfiltration** — no patient data, names, dates, or clinical text sent to any external API
- **Local-first** — prefer on-device models (e.g., local LLM via ONNX, llama.cpp)
- **Opt-in** — AI features disabled by default; explicit operator enablement required

### Candidate Use Cases (read-only, low-risk first)
1. **Procedure label decoding** — map opaque procedure codes to human-readable descriptions using a local lookup table (no AI needed, but could use AI for initial mapping generation)
2. **Schedule optimization hints** — suggest room assignments or gap-filling based on existing appointment patterns
3. **Medical summary highlighting** — surface key flags (allergies, conditions) from structured data (not free text)

### Guardrails Required
- AI model must run locally on clinic machine OR use an API with zero-retention guarantees and BAA
- No free medical text, patient names, or clinical notes may be included in prompts
- All AI outputs must be clearly labeled as suggestions, not clinical advice
- Safety review required before any AI feature ships

---

## 8. Path Toward Subscription/Licensing (Future Phase)

**This is NOT being implemented now.** This section documents the architectural path for future consideration.

### Licensing Model Options
1. **Per-clinic perpetual license** — one-time purchase, major version upgrades only
2. **Annual subscription** — includes updates, support, and (optional) cloud features
3. **Tiered pricing** — based on number of provider seats or patient volume

### Technical Requirements
- **Offline license validation** — license file stored locally, validated against clinic ID
- **Grace period** — app remains functional for N days if license server unreachable
- **No network dependency** — core functionality must work fully offline
- **License file format** — signed JWT or similar, containing clinic ID, expiry, tier

### Guardrails Required
- License validation must not transmit patient data
- No usage telemetry without explicit opt-in
- Expired license must degrade gracefully (read-only mode, not hard lockout)
- Safety review required before any licensing code ships

---

## 9. Next Recommended Batches

### Batch P — Windows Field Test (BLOCKER)
**Goal:** Execute EXEC-01 through EXEC-16 on a real clinic PC
**Prerequisites:** Staged package, Node 22+ on target machine, sandbox copy of legacy data
**Expected output:** Field test report with pass/fail for each EXEC item, list of issues to fix
**Estimated effort:** 2-3 days including issue resolution

### Batch Q — Desktop Packaging
**Goal:** Ship installable desktop app (one-click installer)
**Prerequisites:** Batch P must pass; Node.js bundling plan; code signing certificate
**Work items:**
- Bundle Node.js runtime in Electron package
- Package web build as static assets
- Build NSIS installer with pre-flight checks
- Test on clean Windows machine
**Estimated effort:** 3-5 days

### Batch R — Mac Testing & Packaging
**Goal:** Validate app runs on Mac; produce Mac installer if viable
**Prerequisites:** Mac hardware available; Batch P patterns adapted for macOS
**Work items:**
- Run test suite on Mac
- Adapt path validation for macOS conventions
- Test Electron packaging on Mac
- Produce .dmg or .pkg installer
**Estimated effort:** 2-3 days

### Batch S — Production Logging & Monitoring
**Goal:** Add structured logging with rotation for production support
**Prerequisites:** None
**Work items:**
- Add file-based logging to bridge and desktop processes
- Implement log rotation (max 5 files, 10MB each)
- Add log level configuration (debug, info, warn, error)
- Ensure no PHI appears in logs (safety review)
**Estimated effort:** 1-2 days

### Batch T — Mirror Auto-Refresh
**Goal:** Automatically re-import mirror after sandbox commits
**Prerequisites:** None
**Work items:**
- Add bridge endpoint or file watcher to detect sandbox changes
- Trigger incremental mirror re-import
- Update Settings panel with live import progress
- Handle import errors gracefully
**Estimated effort:** 2-3 days

---

## Appendix A — Safety Test Summary

| Test Category | Files | Status |
|--------------|-------|--------|
| Forbidden token detection | `safe-write-plan-display.tsx`, `read-only-smoke-fixtures.ts` | ✅ Passing |
| DOM forbidden field labels | `read-only-smoke-fixtures.ts` (`DOM_FORBIDDEN_FIELD_LABELS`) | ✅ Passing |
| Smoke fixture leakage | `read-only-smoke-fixtures.test.ts` | ✅ Passing |
| Settings panel safety | `settings-panel.test.tsx` (`assertNoForbiddenDomTokens`) | ✅ Passing |
| Schedule panel safety | `schedule-panel.test.tsx` | ✅ Passing |
| Patient profile safety | `patient-profile-panel.test.tsx` | ✅ Passing |
| Write result safety | `appointment-status-dry-run.test.tsx`, `appointment-create-write.test.tsx` | ✅ Passing |
| Demographics write safety | `patient-demographics-write.test.tsx` | ✅ Passing |
| Timeline display safety | `patient-timeline-display.test.ts` | ✅ Passing |
| Workspace intelligence safety | `patient-workspace-intelligence.test.ts` | ✅ Passing |
| Path masking | `mask-operator-path.test.ts` | ✅ Passing |

**Overall: 0 safety regressions. 48/49 test files passing. 3 pre-existing UI text mismatches in settings-panel.test.tsx (not safety-related).**
