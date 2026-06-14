# Microdent Modern — Product Completion Roadmap

**Purpose:** Single authoritative guide for continuing Microdent Modern toward a sellable, clinic-ready product. Covers what exists, what's missing, how the system works, and what it takes to ship.

**Current commit:** working tree after `a96131b` — roadmap/productization hardening and local strict signoff evidence in progress

**Baseline date:** 2026-06-03 (latest QA batch: `clinic-workspace-ui-batch-report`)

---

## 1. Product Vision

Microdent Modern is a **modern, local-first desktop clinic application** that sits **beside** a legacy Visual FoxPro/Access-based dental practice management system called Microdent. It must feel like a polished clinic product, not a developer tool or DBF viewer. It provides:

- **Read-only access** to clinic FoxPro DBF data (patients, schedule, chart, treatments, ledger, medical summaries) through an internal local clinic service
- **Modern UI** with clinic-optimized workflows — Today dashboard, patient search/profile, schedule grid, and settings diagnostics
- **Safe sandbox writes** for a limited set of operations (appointment status, time moves, creation, demographics updates) — only when explicitly enabled
- **SQLite mirror** for faster, query-friendly access to imported data
- **Zero cloud dependency** — everything runs locally on the clinic machine, no patient data leaves the building
- **One-click commercial target** — double-click the app, complete first-run setup if needed, then the clinic service, local copy, mirror, and backups are managed automatically

**Target customer:** Small-to-mid dental clinics running legacy Microdent on Windows, needing a modern interface without migrating their legacy database or risking data integrity.

**Product philosophy:**
- **Safety first** — read-only by default, writes gated by sandbox, backups required
- **Local-only** — no cloud services, no external APIs, no PHI in logs
- **Invisible internals** — operators must never manually start a bridge, run `pnpm`, set environment variables, or understand DBF, SQLite, localhost, `DATA_ROOT`, `SQLITE_PATH`, or `BACKUP_DIR`
- **Clinic-friendly language** — no technical jargon on primary screens; technical diagnostics stay in Settings and docs
- **Premium UI / UX** — calm, fast, dental-clinic-specific workflows; avoid generic SaaS patterns, card soup, and admin-dashboard feel
- **Keep the current dental chart/tooth representation** until real tooth assets or a validated odontogram design is available

---

## 2. Current State Assessment

### 2.1 What's Built

| Area | Status | Notes |
|------|--------|-------|
| **Monorepo** | ✅ Complete | pnpm workspace: `packages/*`, `services/*`, `apps/*` |
| **Bridge API** | ✅ Complete | Express server on `127.0.0.1:17890`, DBF reader, SQLite reader, safety module, rate limiting, CORS for dev |
| **Contracts** | ✅ Complete | Zod schemas + TS types for all API DTOs (`@microdent/contracts`) |
| **UI primitives** | ✅ Complete | Design tokens, Button, Card, Table, CommandCenter, etc. (`@microdent/ui`) |
| **App shell** | ✅ Complete | Top bar, sidebar, read-only banner, bridge health (`@microdent/app`) |
| **Today dashboard** | ✅ Complete | Schedule panel, next-up, quick actions, clinic status compact, continue strip |
| **Patient search** | ✅ Complete | Debounced combobox, session recents (max 5, in-memory) |
| **Patient profile** | ✅ Complete | 7 tabs: Summary, Timeline, Appointments, Medical, Treatments, Chart, Ledger |
| **Schedule view** | ✅ Complete | Week/day nav, room filter, interactive status/provider chips, current highlight |
| **Settings panel** | ✅ Complete | Readiness grid, diagnostics grouped, pilot readiness |
| **Desktop shell** | ✅ MVP+ | Electron main process, clinic-service supervisor, static web loading, first-run setup, automatic local-copy preparation, health IPC |
| **SQLite mirror** | ✅ Complete | Import CLI, migrations, field maps for patients, appointments, treatments, medical, doctors, procedures, rooms, write audit |
| **Sandbox writes** | ✅ Pilot | 4 routes: status update, time move, create, demographics — dry-run → preview → commit |
| **Safety** | ✅ Complete | Path sandbox, read-only enforcement, write-mode gating, blocked-field rejection |
| **Test coverage** | ✅ Strong | 100+ test files across all packages (vitest) |
| **Pilot packaging** | ✅ Staged | `stage-pilot-release`, `verify-pilot-release`, manifest generation, release smoke |
| **Documentation** | ✅ Extensive | 80+ phase/docs files, QA runbooks, operator guides, field test scripts |

### 2.2 What's Missing for a Sellable Product

| Gap | Severity | Owner Phase | Notes |
|-----|----------|-------------|-------|
| **Windows field execution** | BLOCKER | Phase 4 | No real clinic PC has filed package verification evidence plus Windows field evidence JSON referencing `packageVerification.evidencePath`; tier 3 field test never executed |
| **One-click setup/import** | PARTIAL BLOCKER | Phase 4-5 | First-run now validates a copied clinic folder, derives safe local-copy/backup/log paths, runs automatic local-copy import, and blocks on core-table failure; still needs Windows field execution and production installer proof |
| **Invisible clinic service** | PARTIAL BLOCKER | Phase 4-5 | Desktop starts/supervises the internal service, primary UI calls it the clinic service, and Settings includes restart/port diagnostic/policy quick fixes; remaining work is Windows field proof and production installer integration |
| **NSIS installer** | High | Phase 4-5 | Portable staged tree only; no signed installer, no auto-update |
| **Code signing** | High | Phase 4-5 | Required for Windows deployment on clinic machines |
| **Mirror auto-refresh** | Medium | Phase 5 | Settings can refresh the local copy without CLI; post-write UI now warns that the local copy may need refresh instead of auto-running risky imports; remaining work is Windows field proof |
| **Node.js bundling** | High | Phase 4 | Staging can validate and include a pre-downloaded Node 22.5+ runtime via `MICRODENT_NODE_RUNTIME_DIR`, writes a support-safe runtime manifest, and desktop prefers packaged Node; signing/installer integration remains open |
| **Production logging** | Medium | Phase 5 | Desktop now auto-creates PHI-safe rotating operational logs, exports sanitized support logs, configures local-only crash dumps, and shows support-safe diagnostics plus capped log/crash metadata previews; opt-in telemetry and aggregation are still not implemented |
| **Dual-search sync** | Low | Phase 6 | Top bar and Patients page search don't sync query text |
| **Decoded reference labels** | Low | Phase 6+ | Many status codes, procedure codes remain opaque (`Type N` etc.) |
| **Reminders/notifications** | Low | Phase 7+ | No appointment reminders; intentionally deferred |
| **Odontogram / tooth images** | N/A | Preserve current | Keep current dental chart/tooth representation until real assets exist |
| **Payment/ledger writes** | N/A | Out of scope | Intentionally blocked |

---

## 3. Completed Work Inventory

### 3.1 Package Inventory

#### `@microdent/contracts` (packages/contracts/)
Zod schemas + TypeScript types — single source of truth for API DTOs.

| Module | Exports |
|--------|---------|
| `health.ts` | `HealthResponse` — `{ ok, version }` |
| `write-mode.ts` | `WriteMode` (`"disabled" \| "enabled"`), `BridgeDevStatusResponse`, `WriteCapabilityResponse` |
| `mirror-status.ts` | `MirrorStatusResponse`, `MirrorImportRunSummary` |
| `write-audit-recent.ts` | `WriteAuditRecentResponse`, `WriteAuditRecentEntry` |
| `api-error.ts` | `ApiErrorBody` — `{ error: { code, message } }` |
| `meta-tables.ts` | `TablesListResponse`, `TableListItem` |
| `table-schema.ts` | `TableSchemaResponse`, `TableFieldSchema` |
| `table-rows.ts` | `TableRowsResponse`, `TableRow` |
| `legacy-catalog.ts` | `LegacyCatalogResponse`, `LegacyCatalogTableItem` |
| `patient-search.ts` | `PatientSearchQueryParams`, `PatientSearchResponse`, `SafePatientSummary` |
| `patient-profile.ts` | `PatientProfileResponse`, `PatientProfilePathParams` |
| `patient-medical-summary.ts` | `PatientMedicalSummaryResponse`, `MedicalConditionFlags` |
| `patient-treatments.ts` | `PatientTreatmentsResponse`, `PatientTreatmentItem` |
| `patient-ledger.ts` | `PatientLedgerResponse`, `LedgerEntryV1` |
| `patient-chart.ts` | `PatientChartResponse`, `PatientChartEntry` |
| `reference-doctors.ts` | `ReferenceDoctorsResponse`, `ReferenceDoctorItem` |
| `reference-procedures.ts` | `ReferenceProceduresResponse`, `ReferenceProcedureItem` |
| `schedule.ts` | `ScheduleRoomsResponse`, `ScheduleAppointmentsResponse`, `PatientAppointmentsQuery` |
| `safe-write-plan.ts` | `SafeWritePlan`, `SafeWritePlanFieldChange`, `SafeWritePlanWarning` |
| `appointment-status-write.ts` | `AppointmentStatusUpdateBody` |
| `appointment-time-move-write.ts` | `AppointmentTimeMoveBody` |
| `appointment-create-write.ts` | `AppointmentCreateBody` |
| `schedule-write-blocked.ts` | `SCHEDULE_BLOCKED_WRITE_FIELD_NAMES` (COMMENT, PAT_NAME, TELEPHONE, CASENUM) |
| `patient-demographics-write.ts` | `PatientDemographicsUpdateBody`, `PATIENT_DEMOGRAPHICS_WRITABLE_FIELDS` |

#### `@microdent/ui` (packages/ui/)
Design tokens and hand-built React primitives (no Tailwind).

| Component | File | Purpose |
|-----------|------|---------|
| Tokens | `tokens.css` | CSS variables: neutrals, primary teal, semantic colors, typography, spacing |
| Button | `Button.tsx` | Primary, secondary, ghost variants |
| Card | `Card.tsx` | Card, CardHeader, CardTitle, CardBody, CardFooter |
| Table | `Table.tsx` | Semantic table with header/body |
| Badge | `Badge.tsx` | Status badges |
| Input | `Input.tsx` | Text input with label |
| CommandCenter | `CommandCenter.tsx` | Search/toolbar component |
| EmptyState | `EmptyState.tsx` | Friendly empty-state messages |
| ErrorState | `ErrorState.tsx` | Error display with retry |
| LoadingState | `LoadingState.tsx` | Loading skeleton |
| PatientQuickCard | `PatientQuickCard.tsx` | Compact patient card |
| ReadOnlyBanner | `ReadOnlyBanner.tsx` | Global read-only warning |
| classNames | `util/classNames.ts` | Conditional class merging |

#### `@microdent/app` (packages/app/)
Routes, TanStack Query hooks, feature modules.

| Component/Module | File | Purpose |
|-------------------|------|---------|
| AppShell | `AppShell.tsx` | Top bar, sidebar, outlet, banners, session recent state |
| TodayDashboard | `today-dashboard.tsx` | Schedule panel, next-up, quick actions, clinic status |
| SchedulePanel | `SchedulePanel.tsx` | Week/day grid, room filter, interactive chips, write actions |
| PatientSearchBar | `PatientSearchBar.tsx` | Debounced combobox, keyboard nav, recent patients |
| PatientProfilePanel | `PatientProfilePanel.tsx` | 7-tab workspace, header hero, workflow strip |
| PatientSummaryTab | `PatientSummaryTab.tsx` | Mini-card grid, refresh nonce |
| PatientTimelineTab | `PatientTimelineTab.tsx` | Merged event timeline with month grouping |
| PatientAppointmentsTab | `PatientAppointmentsTab.tsx` | Range filter, status/provider chips, room labels |
| PatientMedicalTab | `PatientMedicalTab.tsx` | Screening flags, questionnaire dates |
| PatientTreatmentsTab | `PatientTreatmentsTab.tsx` | Month grouping, provider stats, tooth filters |
| PatientChartTab | `PatientChartTab.tsx` | Tooth summary strip, treated/not-treated counts |
| PatientLedgerTab | `PatientLedgerTab.tsx` | Month grouping, type distribution, amounts-hidden |
| AppointmentWriteActions | `AppointmentWriteActionsPanel.tsx` | Sandbox write pilots (status, time, create) |
| DemographicsWrite | `PatientDemographicsWritePanel.tsx` | Sandbox demographics update |
| SettingsPanel | `SettingsPanel.tsx` | Readiness grid, diagnostics, mirror/write/backup status |
| Display helpers | `patient-*-display.ts` | Data transformation, safe DTO formatting |
| Safety helpers | `clinic-friendly-copy.ts`, `mask-operator-path.ts` | Jargon-free copy, path redaction |

#### `@microdent/bridge-client` (packages/bridge-client/)
Typed HTTP client for the bridge API.
- `getHealth()`, `getMirrorStatus()`, `getWriteAuditRecent()`
- Patient search, profile, medical, treatments, chart, ledger
- Schedule appointments, rooms
- Reference doctors, procedures
- Legacy catalog, meta tables
- Zod-validated responses with error shape handling

#### `@microdent/sqlite-mirror` (services/sqlite-mirror/)
DBF → SQLite import engine.

| Importer | File | Tables |
|----------|------|--------|
| Patients | `import-patients.ts` | `PATIENT`, `PAT1` → `patients` |
| Appointments | `import-appointments.ts` | `SCHEDULE` → `appointments` |
| Treatments | `import-treatments.ts` | `OPERTBL` → `treatments` |
| Medical summary | `import-medical-summary.ts` | Medical DBFs → `medical_flags` |
| Doctors | `import-doctors.ts` | Reference doctors → `reference_doctors` |
| Procedures | `import-procedures.ts` | Reference procedures → `reference_procedures` |
| Schedule rooms | `import-schedule-rooms.ts` | `SC_ROOM` → `schedule_rooms` |
| Write audit | `write-audit.ts` | JSONL audit → `write_audit` |

Migrations: `001_initial.sql` through `007_write_audit.sql`

#### `@microdent/desktop` (apps/desktop/)
Electron MVP desktop shell.
- `main.ts` — spawns bridge, loads web dist, health IPC
- `bridge-supervisor.ts` — bridge lifecycle management, restart on crash
- `config.ts` — desktop config persistence (`%AppData%\Microdent\config.json`)
- `setup-window.ts` — first-run setup wizard
- `startup-validation.ts` / `startup-failure.ts` — Node version checks, fatal error dialogs
- `path-validation.ts` — sandbox path safety
- `operator-data-locations.ts` — Windows-specific path resolution
- `runtime-install-root.ts` — install root detection (dev vs packaged)

#### `@microdent/bridge` (services/bridge/)
Express HTTP API — the only component that reads DBF files.

| Route Group | Method | File | Notes |
|-------------|--------|------|-------|
| `/health` | GET | `app.ts` | Always available |
| `/` | GET | `app.ts` | Service info |
| `/v1/meta/tables` | GET | `v1.ts` | Table registry listing |
| `/v1/tables/:id/schema` | GET | `v1.ts` | Schema introspection |
| `/v1/tables/:id/rows` | GET | `v1.ts` | Paginated rows (max 100) |
| `/v1/catalog` | GET | `v1.ts` | Legacy catalog listing |
| `/v1/patients/search` | GET | `v1.ts` | Search with normalization |
| `/v1/patients/:id/profile` | GET | `v1.ts` | DBF or SQLite |
| `/v1/patients/:id/medical` | GET | `v1.ts` | DBF or SQLite |
| `/v1/patients/:id/treatments` | GET | `v1.ts` | DBF or SQLite |
| `/v1/patients/:id/chart` | GET | `v1.ts` | DBF only |
| `/v1/patients/:id/ledger` | GET | `v1.ts` | DBF only |
| `/v1/reference/doctors` | GET | `v1.ts` | DBF or SQLite |
| `/v1/reference/procedures` | GET | `v1.ts` | DBF or SQLite |
| `/v1/schedule/rooms` | GET | `v1.ts` | DBF or SQLite |
| `/v1/schedule/appointments` | GET | `v1.ts` | DBF or SQLite |
| `/v1/mirror/status` | GET | `v1.ts` | Mirror metadata |
| `/v1/write-audit/recent` | GET | `v1.ts` | Recent audit entries |
| `/v1/appointments/:id/status/dry-run` | POST | `v1.ts` | Sandbox preview |
| `/v1/appointments/:id/status` | PATCH | `v1.ts` | Sandbox commit |
| `/v1/appointments/:id/time/dry-run` | POST | `v1.ts` | Sandbox preview |
| `/v1/appointments/:id/time` | PATCH | `v1.ts` | Sandbox commit |
| `/v1/appointments/create/dry-run` | POST | `v1.ts` | Sandbox preview |
| `/v1/appointments/create` | POST | `v1.ts` | Sandbox commit |
| `/v1/patients/:id/demographics/dry-run` | POST | `v1.ts` | Sandbox preview |
| `/v1/patients/:id/demographics` | PATCH | `v1.ts` | Sandbox commit |

### 3.2 Scripts Inventory

| Script | Purpose |
|--------|---------|
| `dev:bridge` | Start bridge in dev mode (tsx watch) |
| `dev:web` | Start Vite dev server |
| `dev:ports` | Show what's listening on bridge/web ports |
| `dev:kill-ports` | SIGTERM stale processes |
| `mirror:import-safe` | Run SQLite mirror import CLI |
| `legacy:backup` | Backup legacy DATA tree |
| `legacy:create-sandbox` | Create disposable write sandbox |
| `legacy:restore` | Restore from backup |
| `legacy:backup-verify` | Verify backup integrity |
| `sandbox:validate` | Validate sandbox environment |
| `qa:sandbox` | Run full sandbox QA (4 workflows, DBF readback) |
| `pilot-checkpoint` | Quick dev gate: test + build + smoke |
| `pilot:full-checkpoint` | Full gate including sandbox QA |
| `pilot:distribution-checkpoint` | Distribution RC: test + stage + verify |
| `pilot:release-signoff` | Strict signoff: requires sandbox env |
| `pilot:release-check` | Non-strict release check |
| `stage:pilot-release` | Stage artifacts to `dist/pilot-release/` |
| `pilot:verify-release` | Verify staged tree (no DBF/sqlite/Legacy) |
| `pilot:verify-manifest` | Hash check on RELEASE-MANIFEST.json |
| `desktop:release-smoke` | Build + test + verify desktop dist |
| `test:pilot-artifacts` | Synthetic artifact tests |

### 3.3 QA Runs

21 QA batch reports in `qa-runs/` spanning from 2026-05-18 to 2026-06-03, covering:
- E2E orchestration, hardening, product UI
- Clinic UX, Windows MVP, pilot packaging
- Visual identity, command center, workspace redesign
- Reference context, workflow intelligence
- Clinic structure/workflow, UI elevation

---

## 4. Remaining Phases with Action Items

### Phase 2 — Mirror Completion & Read Routes

**Status:** Mostly complete. SQLite mirror importers exist for all core entities. Bridge SQLite read routes are implemented as fallbacks.

**Remaining items:**
- [x] Post-write refresh-needed state after sandbox commits (Settings can refresh manually; automatic full refresh remains deferred pending field proof)
- [x] Add first-run local-copy import progress indicators during setup
- [x] Add Settings local-copy refresh progress indicators (desktop progress events and operator-safe status copy)
- [x] Implement table-level incremental mirror re-import for low-risk reference tables; full refresh remains fallback for core clinical tables
- [x] Handle mirror staleness detection with age-based stale UI plus copied-file-change-since-import metadata
- [x] Add error handling for corrupt/incomplete mirror imports
- [x] Document mirror troubleshooting in operator guide

### Phase 3 — Write Safety & Desktop Packaging

**Status:** Core safety infrastructure complete. 4 sandbox write routes with dry-run → preview → commit flow. Desktop Electron MVP built.

**Remaining items:**
- [ ] **Windows field execution (EXEC-01 through EXEC-16)** — see [FIELD-TEST-START-HERE.md](./FIELD-TEST-START-HERE.md)
  - [ ] Evidence prerequisite: file and validate `qa-runs/YYYY-MM-DD-windows-package-verify-evidence-CLINIC-PC-01.json` with `pnpm pilot:package-verify-evidence` before operator field steps
  - [ ] EXEC-01: Verify bundled Node 22+ or fallback Node 22+ on clinic PC
  - [ ] EXEC-02: Extract staged package, verify structure
  - [x] EXEC-03: First-run setup wizard implemented in desktop shell
  - [x] EXEC-04: First-run chooses copied clinic data folder and derives local-copy/backup paths
  - [x] EXEC-05: Automatic local-copy import during first-run setup
  - [ ] EXEC-06: Read-only smoke (Today, Patients, Schedule, Settings)
  - [ ] EXEC-07: Verify bridge health in desktop shell
  - [ ] EXEC-08: Enable sandbox writes
  - [ ] EXEC-09: Test appointment status update
  - [ ] EXEC-10: Test appointment time move
  - [ ] EXEC-11: Test appointment create
  - [ ] EXEC-12: Test demographics update
  - [ ] EXEC-13: Verify backup created before writes
  - [ ] EXEC-14: Verify DBF readback proof
  - [ ] EXEC-15: Verify restore workflow
  - [ ] EXEC-16: Field result form + sign-off, then file Windows field evidence JSON with `packageVerification.evidencePath`
- [x] Add PHI-safe machine-readable field evidence validator (`pnpm pilot:field-evidence`) and JSON template so completed Windows runs can be checked against EXEC-01 through EXEC-16 without over-claiming read-only evidence
- [x] Prefer packaged Node.js runtime in desktop package when `node/` is staged
- [x] Add repeatable Windows Node runtime validation/staging to release process (`pnpm pilot:node-runtime-check`; still uses pre-downloaded runtime)
- [ ] Add signed installer-integrated Windows Node runtime acquisition/download step
- [x] Package web build as static assets loaded by Electron
- [ ] Implement auto-update mechanism (electron-builder Squirrel or custom feed)
- [x] Add desktop production logging (PHI-safe file output, rotation, log levels)
- [x] Add support-safe log export from Settings
- [x] Add local-only crash dump capture
- [x] Add support-safe diagnostics summary viewer in Settings
- [x] Add capped support-safe log file preview in Settings
- [x] Add richer support crash file metadata preview

### Phase 4 — Windows Operator Workflow

**Status:** Local operator workflow and support documentation are materially stronger, but no real-world Windows execution is complete.

**Reference docs:**
- [phase-4-mirror-import-operator.md](./phase-4-mirror-import-operator.md)
- [phase-4-windows-operator-quickstart.md](./phase-4-windows-operator-quickstart.md)

**Remaining items:**
- [ ] Execute full operator workflow on clinic PC
- [ ] Resolve any path/permission issues discovered during field test
- [x] Create operator training materials baseline with [operator-manual.md](./operator-manual.md), pilot start/handoff links, and Settings-first troubleshooting
- [x] Implement operator-friendly error messages for common failure modes; primary UI maps service, local-copy, support-export, port, permission, and write-blocked cases to clinic actions without raw paths or environment-variable jargon
- [x] Add Settings quick-fix button for clinic-service restart in the desktop app
- [x] Add Settings quick-fix button for local-copy refresh in the desktop app
- [x] Add Settings quick-fix support for support-safe log export
- [x] Add Settings quick-fix support for safe port diagnostics
- [x] Add Settings quick-fix support for safe port cleanup policy
- [ ] Test on multiple Windows versions (10, 11, potentially older)
- [ ] Test with various antivirus configurations (common clinic environment)

### Phase 5 — Production Readiness

**Status:** Local readiness work has started and several pilot-ready safeguards are implemented. Commercial production readiness still depends on package-linked Windows field proof, signing, installer, update, support, distribution, pricing, marketing, license, go-live, and pilot evidence.

**Remaining items:**
- [ ] Code signing certificate (Windows Authenticode)
- [ ] NSIS installer with:
  - [ ] Pre-flight checks (Node version, disk space, permissions)
  - [ ] Node.js bundled or auto-installed
  - [ ] Desktop shortcut
  - [ ] Uninstaller
  - [ ] Install location picker (default: `C:\Program Files\Microdent Modern\`)
  - [ ] Data directory outside install tree (`%ProgramData%\MicrodentModern\` or user choice)
- [ ] Auto-update feed (Squirrel, GitHub releases, or custom)
- [x] Crash reporting: local crash dump capture with upload disabled
- [x] Optional opt-in telemetry/upload decision recorded as deferred/off by default in [telemetry-deferral-decision-record.md](./telemetry-deferral-decision-record.md)
- [x] Desktop log rotation and PHI-safe operational event management
- [x] Desktop local-copy refresh action from Settings (no operator CLI needed)
- [x] Support-safe log export workflow
- [x] Support-safe diagnostics summary viewer workflow
- [x] Support-safe log file preview workflow
- [x] Support-safe crash metadata preview workflow
- [x] Performance profiling on clinic-scale synthetic datasets (5,000+ patients, 50,000+ appointments) with baseline report in [2026-06-06-synthetic-performance-baseline.md](../qa-runs/2026-06-06-synthetic-performance-baseline.md)
- [x] Accessibility audit baseline (WCAG 2.2 AA-oriented local checklist) in [accessibility-audit-checklist.md](./accessibility-audit-checklist.md); NVDA/Windows validation remains field-track work
- [x] Operator manual / help documentation in [operator-manual.md](./operator-manual.md)
- [x] Data privacy review for local-only pilot storage and support boundaries in [data-privacy-review.md](./data-privacy-review.md)

### Phase 6 — Feature Enrichment (Post-Field-Test)

**Status:** Deferred until Windows field test completes and guardrails are reviewed.

**Candidate features (not committed):**
- [ ] Decoded procedure/status/chart reference labels (if field test confirms safe mappings)
- [ ] Search query sync between top bar and Patients page
- [ ] Recent patients persistence policy (currently session-only; requires privacy review)
- [ ] Mirror auto-refresh on app launch or timer
- [ ] Dashboard metrics (patient count, today's appointments, revenue summary — read-only)
- [ ] Export/print functionality (patient summaries, schedules — read-only)
- [ ] Multi-operator support (configurable per-user settings)
- [ ] Backup scheduling (automated daily backup of sandbox)

**Explicitly NOT in scope (per [out-of-scope-guardrails.md](./out-of-scope-guardrails.md)):**
- Payment/ledger writes
- Treatment/procedure memo writes
- Chart/odontogram writes
- Medical summary writes
- Free-text comment fields on any write route
- Manual shell-driven mirror import as the normal operator flow; desktop first-run local-copy preparation is allowed and required
- Production legacy DATA_ROOT (never Microdent-Legacy)

### Phase 7 — Pilot & Commercial Launch

**Status:** Not started.

**Remaining items:**
- [ ] Clinical pilot with 1–3 real clinics
- [ ] Pilot feedback collection system
- [ ] Issue tracking and prioritization
- [x] Support knowledge base, pilot feedback triage workflow, and support readiness checklist added for PHI-safe commercial-readiness evidence
- [x] Licensing/pricing readiness guardrails added for offline/no-PHI commercial evidence
- [ ] Licensing infrastructure
- [ ] Support documentation (knowledge base, FAQ)
- [x] Pricing and marketing readiness guardrails added for no-telemetry pricing and truthful launch claims
- [ ] Website / marketing materials implementation
- [x] Distribution readiness and marketing-claim review guardrails added for commercial evidence
- [ ] Distribution channel implementation (direct download, partner network)

---

## 5. Architecture Overview

### 5.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Desktop Shell (Electron)                 │
│                                                              │
│  ┌──────────────┐   ┌─────────────────┐   ┌───────────────┐ │
│  │  Setup UI    │──▶│  Main Process   │──▶│ BrowserWindow │ │
│  │  (first-run) │   │  (bridge spawn) │   │  (web dist)   │ │
│  └──────────────┘   └────────┬────────┘   └───────┬───────┘ │
│                              │                     │         │
│                    IPC: health, config             │         │
│                              │                     │         │
└──────────────────────────────┼─────────────────────┼─────────┘
                               │                     │
                    ┌──────────▼─────────┐           │
                    │   Bridge Service   │           │
                    │   (Express, :17890)│           │
                    │                     │           │
                    │  ┌───────────────┐ │           │
                    │  │  Safety Layer │ │           │
                    │  │  - Path sandbox│ │           │
                    │  │  - Read-only  │ │           │
                    │  │  - Write mode │ │           │
                    │  │  - Rate limit │ │           │
                    │  └───────┬───────┘ │           │
                    │          │         │           │
                    │  ┌───────▼───────┐ │           │
                    │  │   DBF Reader  │ │           │
                    │  │  (dbffile)    │ │           │
                    │  └───────┬───────┘ │           │
                    │          │         │           │
                    │  ┌───────▼───────┐ │           │
                    │  │ SQLite Mirror │ │           │
                    │  │  (node:sqlite)│ │           │
                    │  └───────────────┘ │           │
                    └──────────┬──────────┘           │
                               │ HTTP (loopback)      │
                    ┌──────────▼──────────────────────┘
                    │  Bridge Client (bridge-client) │
                    │  (Zod-validated HTTP client)   │
                    └──────────┬─────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   React App (app)   │
                    │  - TanStack Query   │
                    │  - Feature modules  │
                    │  - AppShell         │
                    └─────────────────────┘
```

### 5.2 Package Dependency Graph

```
apps/web ────────────────┐
                         │
apps/desktop ────────────┤
                         ├──▶ packages/app ──────┐
services/bridge ─────────┤                       │
                         │                       ▼
services/sqlite-mirror ──┤              packages/ui
                         │                       ▲
packages/bridge-client ──┤                       │
                         │                       │
packages/contracts ──────┘───────────────────────┘
```

All packages depend on `@microdent/contracts`. `@microdent/app` depends on `@microdent/ui` and `@microdent/bridge-client`. The bridge and sqlite-mirror depend on contracts. The desktop shell orchestrates everything.

### 5.3 Data Flow

```
Legacy DBF files (Microdent-Legacy-Copy/DATA/)
        │
        │  (read-only, path-sandboxed)
        ▼
Bridge DBF Reader ──────────┐
        │                    │
        │ (direct read)      │ (import via CLI)
        ▼                    ▼
  Bridge API routes     SQLite Mirror
        │                    │
        │ (read)             │ (read)
        ▼                    ▼
  ┌──────────────────────────────┐
  │     Route Selection Logic     │
  │  (SQLite preferred if usable, │
  │   fallback to DBF read)       │
  └──────────────┬───────────────┘
                 │
                 ▼
  Bridge Client (Zod-validated)
                 │
                 ▼
  React App (TanStack Query)
                 │
                 ▼
  User Interface (Today, Patients, Schedule, Settings)
```

### 5.4 Write Flow (Sandbox Only)

```
UI: User opens write panel in Schedule row
        │
        ▼
Client: POST /v1/appointments/:id/status/dry-run
        │
        ▼
Bridge: Validates write mode (must be "enabled")
        │
        ├── If disabled → 403 WRITE_MODE_DISABLED
        │
        ▼
Bridge: Creates dry-run plan (SafeWritePlan)
        │  - Validates fields against Zod schema
        │  - Rejects blocked keys (COMMENT, PAT_NAME, etc.)
        │  - Shows field changes without applying
        │
        ▼
UI: Shows plan to user, requires confirmation
        │
        ▼
Client: PATCH /v1/appointments/:id/status (commit)
        │
        ▼
Bridge: Pre-commit checks
        ├── Validates sandbox is ready
        ├── Verifies backup exists
        └── Validates write intent
        │
        ▼
Bridge: Commits to DBF
        │
        ├── Creates backup if not exists
        ├── Writes to DBF (dbffile)
        ├── Logs audit entry
        └── Returns success
        │
        ▼
UI: Shows success notification, invalidates queries
        │
        ▼
Operator: Runs mirror import CLI to refresh SQLite
```

### 5.5 Extracted Component Pattern

The codebase uses a **shared component extraction** pattern:

1. **`packages/ui/`** — Low-level presentational components (Button, Card, Table)
2. **`packages/app/src/`** — Feature-specific components (PatientProfilePanel, SchedulePanel)
3. **Display helpers** (e.g., `patient-timeline-display.ts`) — Pure functions that transform API responses into UI-ready data
4. **Safety helpers** (e.g., `clinic-friendly-copy.ts`) — Jargon-free message generation

This ensures:
- No raw hex in JSX (CSS variables only)
- Business logic is testable without React
- Display logic is separated from fetch logic
- Safety checks are centralized

---

## 6. Safety Model

### 6.1 Design Principles

1. **Read-only by default** — The bridge starts with no write capability
2. **Fail closed** — Unknown/missing config values disable writes
3. **Path sandboxing** — All file operations confined to configured roots
4. **Explicit enablement** — Writes require `WRITE_MODE=enabled` + valid sandbox
5. **Backup before write** — Commits require a verified backup
6. **Audit trail** — Every write is logged with operation ID, timestamp, hash
7. **No PHI in logs** — Only paths, statuses, counts, error codes
8. **Local-only** — Bridge binds to `127.0.0.1`; CORS restricted to loopback

### 6.2 Path Safety

| Path | Treatment |
|------|-----------|
| `DATA_ROOT` | Must be absolute; relative paths throw at startup |
| `DATA_ROOT` resolution | `realpathSync` for canonical path |
| `..` segments | Rejected by path sandbox |
| Symlink escape | Detected and rejected (policy per OS) |
| `Microdent-Legacy` | Forbidden path — never allowed as DATA_ROOT |
| Write sandbox | Must be under `Microdent-Write-Sandbox/` |
| Backup directory | Configured separately; never inside install folder |
| SQLite path | Configured separately; never inside install folder |

**Implementation:** `services/bridge/src/safety/` — `path-sandbox.ts`, `read-only-file.ts`, `open-under-data-root.ts`

### 6.3 Write Safety Layers

| Layer | Location | Enforcement |
|-------|----------|-------------|
| Config | `config.ts` | `writesPermitted()` checks writeMode |
| Route guard | `write-route-guards.ts` | Returns 403 if write mode disabled |
| Zod schema | `contracts/` | Strict bodies reject extra keys |
| Blocked keys | `reject-blocked-body-keys.ts` | COMMENT, PAT_NAME, TELEPHONE, CASENUM rejected |
| Field allowlist | `patient-demographics-write.ts` | Only allowlisted name fields |
| Sandbox validation | `validate-writable-sandbox.ts` | Verifies sandbox directory exists and contains expected DBF files |
| Backup requirement | `appointment-*-commit.ts` | Verifies backup exists before commit |
| Route inventory test | `write-route-inventory.test.ts` | Proves exactly 4 PATCH/POST routes, no DELETE/PUT |

### 6.4 Allowed Writes (Only 4)

| # | Route | Operation | Target Table | Fields |
|---|-------|-----------|-------------|--------|
| 1 | `PATCH /v1/appointments/:id/status` | Status update | SCHEDULE.DBF | `STATUS` |
| 2 | `PATCH /v1/appointments/:id/time` | Time/room move | SCHEDULE.DBF | `DATE`, `TIME`, `ROOM`, `DOCTOR` |
| 3 | `POST /v1/appointments/create` | New appointment | SCHEDULE.DBF | `DATE`, `TIME`, `ROOM`, `DOCTOR`, `PATIENT`, `STATUS` |
| 4 | `PATCH /v1/patients/:id/demographics` | Demographics update | PATIENT.DBF | `FIRSTNAME`, `MIDDLENAME`, `LASTNAME` (allowlisted only) |

### 6.5 What's Blocked

| Domain | Reason | Implementation |
|--------|--------|---------------|
| Payments/ledger | Financial integrity risk | Zod strict body + blocked field check |
| Treatment memos | Unstructured text risk | Out of scope per guardrails |
| Chart notes | Clinical integrity risk | Out of scope per guardrails |
| Medical summary | Sensitive data risk | Out of scope per guardrails |
| Free-text comments | Arbitrary write risk | `findBlockedScheduleBodyKeys` rejects COMMENT, NOTE, DESCRIPT |
| Schedule fields | PAT_NAME, TELEPHONE, CASENUM blocked | `SCHEDULE_BLOCKED_WRITE_FIELD_NAMES` |
| DELETE/PUT routes | Too destructive | No such routes in v1.ts |

### 6.6 Logging Policy

| Allowed in Logs | Never in Logs |
|-----------------|---------------|
| HTTP status codes | Patient names |
| Latency | Phone numbers |
| Row counts | Addresses |
| Error codes (WRITE_MODE_DISABLED, etc.) | Medical flags |
| Operation IDs | Payment amounts |
| File paths (redacted) | Chart notes |
| Backup basenames | Full DBF row bodies |
| Hash prefixes | Treatment descriptions |

---

## 7. Commercial Path

### 7.1 Target Market

- **Primary:** Small-to-mid dental clinics (1–10 chairs) running legacy Microdent on Windows
- **Secondary:** Dental consultants who manage multiple Microdent installations
- **Geography:** Currently Mexico/Latin America (Spanish-language UI consideration), expandable globally

### 7.2 Value Proposition

1. **Modern UI without data migration risk** — reads existing DBF files directly
2. **Zero cloud dependency** — everything local, HIPAA-friendly by design
3. **Safe sandbox writes** — backup-first approach with audit trail
4. **No legacy lock-in** — operators can use Modern alongside legacy app
5. **Fast setup** — first-run wizard, no IT infrastructure needed

### 7.3 Proposed Pricing Model

| Tier | Price | Features |
|------|-------|----------|
| **Read-Only Free** | $0/month | Full read access, patient search, schedule view, profile tabs |
| **Sandbox Pro** | $49–99/month | Read-only + 4 sandbox write routes + mirror import + auto-refresh |
| **Clinic Enterprise** | Custom | Multiple workstations, priority support, custom integrations |

### 7.4 Licensing Infrastructure (Not Yet Implemented)

Required for commercial release:
- [ ] License key validation (offline, local-only — no activation server)
- [ ] Feature gating based on license tier
- [ ] License expiration handling
- [ ] License file format (encrypted JSON or similar)
- [ ] License transfer / revocation process
- [ ] Trial mode (30-day full access)

### 7.5 Installer Strategy

| Milestone | Deliverable |
|-----------|-------------|
| **Phase 3** | Portable staged tree (current approach) |
| **Phase 4** | NSIS installer with Node bundled |
| **Phase 5** | Signed installer with auto-update |
| **Phase 7** | Commercial distribution (website download, partner channels) |

**Current packaging pipeline:**
1. `pnpm pilot-checkpoint` — test + build + smoke
2. `pnpm stage:pilot-release` — stage to `dist/pilot-release/MicrodentModern/`
3. `pnpm pilot:verify-release` — verify no PHI, DBF, sqlite, or Legacy paths in staged tree
4. `pnpm pilot:release-signoff` — strict gate with sandbox env required

---

## 8. Future AI Vision

### 8.1 Guiding Principles

- **Local-first** — AI runs on the clinic machine; no patient data sent to cloud
- **Safe context** — AI operates only on data the operator can already see (no hidden data access)
- **Opt-in** — AI features are disabled by default; operator enables explicitly
- **Transparent** — AI suggestions are clearly labeled; operator always makes final decisions
- **No write authority** — AI never executes writes directly; only generates plans for operator review

### 8.2 Candidate AI Features

| Feature | Description | Data Source | Local/Cloud |
|---------|-------------|-------------|-------------|
| **Smart scheduling suggestions** | Recommend optimal appointment times based on patterns | Schedule data, provider availability | Local |
| **Patient history summarization** | Generate human-readable summaries from chart/treatment data | Patient profile tabs | Local |
| **Medical flag alerts** | Highlight relevant medical conditions for upcoming procedures | Medical summary + procedure reference | Local |
| **Coding assistant** | Suggest procedure codes from treatment descriptions | Reference procedures | Local or hybrid |
| **Revenue analytics** | Identify billing patterns, outstanding balances | Ledger data (read-only) | Local |
| **Predictive scheduling** | Forecast no-show risk based on historical patterns | Schedule + patient history | Local |

### 8.3 Technical Architecture for AI

```
┌─────────────────────────────────────────────┐
│              AI Runtime (Local)              │
│                                             │
│  ┌──────────────┐   ┌──────────────────┐   │
│  │ Model Runner │──▶│ Prompt Builder   │   │
│  │ (local LLM)  │   │ (safe context)   │   │
│  └──────────────┘   └────────┬─────────┘   │
│                              │             │
│                    ┌─────────▼──────────┐  │
│                    │  Context Extractor │  │
│                    │  (from SQLite/DBF) │  │
│                    └────────────────────┘  │
│                                             │
│  Output: Suggestions only (never direct     │
│  writes). All suggestions flow through      │
│  existing dry-run → preview → commit.       │
└─────────────────────────────────────────────┘
```

### 8.4 Implementation Phases

1. **Phase A — Infrastructure** (post-Phase 5): Local model runtime, context extraction framework
2. **Phase B — Read-only AI**: Summarization, alerts, analytics (no writes)
3. **Phase C — Assisted writes**: AI generates dry-run plans for operator review
4. **Phase D — Learning**: Pattern recognition across operators (opt-in, anonymized)

### 8.5 Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Model hallucination | All AI output reviewed by operator; dry-run preview before any action |
| Data exposure | Local-only processing; no network calls for patient data |
| Performance | Async processing; cached results; model size appropriate for clinic hardware |
| Regulatory | Explicit opt-in; audit trail includes AI-generated actions; no autonomous writes |

---

## 9. Windows Deployment Plan

### 9.1 Current State

- **Desktop shell:** Electron MVP built and tested on macOS
- **Packaging:** Portable staged tree via `stage-pilot-release`
- **Node requirement:** Staged packages can include `node/`; otherwise Node 22+ must be installed or `MICRODENT_NODE_BINARY` set
- **No installer:** Operators extract staged tree to target directory
- **No code signing:** Unsigned Electron app triggers Windows SmartScreen warnings
- **No auto-update:** Manual re-stage and extract for updates

### 9.2 Target State

- **NSIS installer:** Signed, professional install experience
- **Bundled Node:** Portable Node.js included or auto-installed
- **SmartScreen compliance:** Code-signed executable
- **Auto-update:** Seamless updates without manual extraction
- **Per-machine or per-user install:** Configurable
- **Clean uninstall:** Removes app files but preserves data directories

### 9.3 Step-by-Step Deployment Plan

#### Step 1: Prepare Build Machine
```bash
# Ensure clean build
pnpm install
pnpm pilot-checkpoint

# Build all packages
pnpm --filter @microdent/contracts run build
pnpm --filter @microdent/bridge run build
pnpm --filter @microdent/bridge-client run build
pnpm --filter @microdent/ui run build
pnpm --filter @microdent/app run build
pnpm --filter @microdent/web run build
pnpm --filter @microdent/desktop run build
```

#### Step 2: Add electron-builder
```bash
# Add to apps/desktop/package.json
"devDependencies": {
  "electron-builder": "^25.0.0"
}

# Add build configuration:
"build": {
  "appId": "com.microdent.modern",
  "productName": "Microdent Modern",
  "directories": { "output": "release" },
  "win": {
    "target": ["nsis"],
    "icon": "build/icon.ico"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true,
    "shortcutName": "Microdent Modern"
  }
}
```

#### Step 3: Bundle Node.js
Options:
- **Option A:** Use `pkg` to bundle bridge into a single binary
- **Option B:** Include portable Node.js in installer/staged `node/`
- **Option C:** Check for Node at install time and download if missing

**Current implementation:** staged releases validate a pre-downloaded Node 22.5+ runtime with `pnpm pilot:node-runtime-check -- --runtime-dir <path>` or `MICRODENT_NODE_RUNTIME_DIR`, copy it into `MicrodentModern/node/`, and write `node/RUNTIME-MANIFEST.json`; desktop startup and first-run import prefer that packaged runtime before falling back to an override or `process.execPath`.

**Recommendation:** keep Option B, but add a signed installer-integrated Windows Node runtime download/acquisition step before commercial release.

#### Step 4: Code Signing
```bash
# Acquire Authenticode certificate (from Sectigo, DigiCert, etc.)
# Store in CI/CD secrets
# Configure electron-builder:
"win": {
  "certificateFile": "path/to/cert.pfx",
  "certificatePassword": "${env:CERT_PASSWORD}"
}
```

#### Step 5: Auto-Update
```bash
# Option: electron-updater with GitHub Releases or custom server
"build": {
  "publish": {
    "provider": "github",
    "owner": "your-org",
    "repo": "microdent-modern"
  }
}
```

#### Step 6: Data Directory Strategy
| Directory | Location | Purpose |
|-----------|----------|---------|
| Install | `C:\Program Files\Microdent Modern\` | App binaries, bundled Node, web dist, bridge dist |
| Config | `%AppData%\Microdent\config.json` | User settings (DATA_ROOT, sqlitePath, writeMode) |
| Data | `C:\ClinicData\` (operator choice) | Sandbox DATA_ROOT (disposable copy) |
| Mirror | `%ProgramData%\MicrodentModern\mirror\` | SQLite mirror file |
| Backup | `%ProgramData%\MicrodentModern\backups\` | Pre-write backups |
| Logs | `%AppData%\Microdent\logs\` | Application logs |

#### Step 7: Field Execution
Follow [FIELD-TEST-START-HERE.md](./FIELD-TEST-START-HERE.md) → [windows-pilot-field-execution-script.md](./windows-pilot-field-execution-script.md) EXEC-01 through EXEC-16.

#### Step 8: Sign-Off
Follow [windows-pilot-go-no-go-checklist.md](./windows-pilot-go-no-go-checklist.md).

---

## 10. Testing Strategy

### 10.1 Test Pyramid

```
         ┌─────────────┐
         │  E2E / QA   │  ← Manual + scripted (qa:sandbox, pilot runs)
         └─────────────┘
        ┌───────────────┐
        │ Integration   │  ← Bridge + DBF fixture, bridge + SQLite
        └───────────────┘
       ┌─────────────────┐
       │    Unit Tests   │  ← Vitest: contracts, safety, display, UI
       └─────────────────┘
```

### 10.2 Current Test Coverage

| Package | Test Files | Coverage Focus |
|---------|-----------|----------------|
| `@microdent/contracts` | 1 file | Safe write plan schema |
| `@microdent/bridge` | 40+ files | Routes, DBF reads, SQLite reads, safety, writes, backup, sandbox |
| `@microdent/bridge-client` | 1 file | Client error handling |
| `@microdent/ui` | 1 file | Component primitives |
| `@microdent/app` | 30+ files | Display helpers, profile panel, schedule panel, settings, shell, write actions |
| `@microdent/desktop` | 6+ files | Config, bridge supervisor, startup validation, path validation |
| `@microdent/sqlite-mirror` | 15+ files | Importers, migrations, field maps, write audit |

### 10.3 Test Verification by Phase

| Phase | Verification Method | Gate |
|-------|-------------------|------|
| **1 (Read-only)** | `pnpm test` — all unit + integration tests green | Must pass before merge |
| **2 (Mirror)** | `pnpm mirror:import-safe` against fixture data | Manual + scripted |
| **3 (Writes)** | `pnpm qa:sandbox` — 4 workflows, DBF readback | Exit code 0 required |
| **3 (Desktop)** | `pnpm desktop:release-smoke` — build + test + verify dist | Must pass |
| **4 (Windows)** | EXEC-01 through EXEC-16 on real clinic PC | Field log required |
| **5 (Production)** | Performance tests, accessibility audit, security review | Sign-off required |
| **6+ (Features)** | Feature-specific tests + regression suite | Per-feature gate |

### 10.4 Checkpoint Commands

| Command | What It Checks | When to Run |
|---------|---------------|-------------|
| `pnpm test` | All unit + integration tests | After every code change |
| `pnpm build:web` | Web bundle builds without errors | Before every release |
| `pnpm desktop:release-smoke` | Desktop dist integrity | Before packaging |
| `pnpm pilot-checkpoint` | Test + build + smoke (quick) | Before merging to main |
| `pnpm pilot:full-checkpoint` | Full gate with sandbox | Before staging release |
| `pnpm pilot:distribution-checkpoint` | Test + stage + verify | Before IT handoff |
| `pnpm pilot:release-signoff` | Strict signoff (requires sandbox) | Final release gate |

### 10.5 Test Categories by Module

#### Safety Tests
- `path-sandbox.test.ts` — Path traversal rejection
- `safety.test.ts` — Read-only enforcement, path validation
- `write-safety.test.ts` — Write mode gating
- `write-route-safety-band.test.ts` — Safety band validation
- `write-route-inventory.test.ts` — Exactly 4 write routes, no DELETE/PUT
- `forbidden-path.ts` — Legacy path rejection

#### DBF Read Tests
- `read-table.test.ts` — Pagination, encoding, schema
- `patient-chart.test.ts` — Chart data extraction
- `read-legacy-catalog.test.ts` — Catalog registry

#### Write Tests
- `appointment-status-write.test.ts` — Dry-run + commit
- `appointment-time-move-write.test.ts` — Time change validation
- `appointment-create-write.test.ts` — New appointment creation
- `patient-demographics-write.test.ts` — Demographics update
- `write-schedule-create.test.ts` — Schedule creation

#### Backup/Restore Tests
- `legacy-backup.test.ts` — Backup creation
- `legacy-restore.test.ts` — Restore from backup
- `verify-legacy-backup.test.ts` — Backup integrity check

#### UI Tests
- `clinic-components.test.tsx` — UI primitives rendering
- `clinic-page.test.tsx` — Page layout
- `patient-profile-panel.test.tsx` — Profile workspace
- `schedule-panel.test.tsx` — Schedule interactions
- `today-dashboard.test.tsx` — Today module
- `settings-panel.test.tsx` — Settings diagnostics
- `read-only-flow-smoke.test.tsx` — End-to-end read flows

#### Display Helper Tests
- `patient-timeline-display.test.ts` — Timeline merge/group
- `patient-appointments-display.test.ts` — Visit metadata
- `patient-treatments-display.test.ts` — Treatment display
- `patient-chart-display.test.ts` — Chart display
- `patient-ledger-display.test.ts` — Ledger display
- `patient-medical-summary-display.test.ts` — Medical summary
- `doctor-labels.test.ts` — Provider labels
- `procedure-reference.test.ts` — Procedure categories

#### Forbidden Token Tests
- `clinic-friendly-copy.test.ts` — No jargon on clinic surfaces
- `mask-operator-path.test.ts` — Path redaction
- `legacy-code-label.test.ts` — Opaque code handling

### 10.6 Test Execution Order

```
1. pnpm test
   ├── @microdent/contracts build
   ├── @microdent/bridge build + test
   ├── @microdent/sqlite-mirror build + test
   ├── @microdent/bridge-client build + test
   ├── @microdent/ui build + test
   ├── @microdent/app build + test
   └── @microdent/desktop build + test

2. pnpm build:web (production bundle)

3. pnpm desktop:release-smoke (dist verification)

4. (Optional) pnpm qa:sandbox (write workflows, requires env)

5. (Optional) pnpm pilot:distribution-checkpoint (full release gate)
```

### 10.7 Missing Test Coverage

| Area | Gap | Priority |
|------|-----|----------|
| E2E browser tests | No Playwright/Cypress integration tests | Medium |
| Windows-specific tests | No tests running on actual Windows | High (Phase 4) |
| Performance tests | No load testing on large datasets | Medium |
| Accessibility tests | No automated a11y testing (axe-core) | Medium |
| Memory leak tests | No long-running stability tests | Low |
| Network failure tests | No bridge disconnect/reconnect testing | Low |
| Installer tests | No automated installer validation | Medium (Phase 5) |

---

## Appendix A: File Structure Reference

```
Microdent-Modern/
├── apps/
│   ├── desktop/           # Electron shell
│   │   ├── src/
│   │   │   ├── main.ts              # Electron main entry
│   │   │   ├── bridge-supervisor.ts # Bridge lifecycle
│   │   │   ├── config.ts            # Desktop config persistence
│   │   │   ├── setup/               # First-run setup wizard
│   │   │   └── *.ts                 # Validation, paths, install root
│   │   └── package.json
│   └── web/               # Vite dev host
│       ├── src/
│       │   ├── main.tsx             # React entry
│       │   └── vite-env.d.ts
│       └── package.json
├── packages/
│   ├── app/               # Feature modules
│   │   └── src/
│   │       ├── AppShell.tsx         # Main shell
│   │       ├── today-dashboard.tsx  # Today module
│   │       ├── SchedulePanel.tsx    # Schedule
│   │       ├── PatientProfilePanel.tsx
│   │       ├── SettingsPanel.tsx
│   │       └── styles/              # CSS modules
│   ├── bridge-client/     # Typed HTTP client
│   │   └── src/client.ts
│   ├── contracts/         # Zod schemas
│   │   └── src/
│   ├── ui/                # Design system
│   │   └── src/
│   │       ├── tokens.css           # CSS variables
│   │       ├── components.css       # Component styles
│   │       └── components/          # React components
│   └── ...
├── services/
│   ├── bridge/            # Express API
│   │   └── src/
│   │       ├── app.ts               # Express app factory
│   │       ├── routes/v1.ts         # All API routes
│   │       ├── dbf/                 # DBF reader
│   │       ├── sqlite/              # SQLite reader
│   │       ├── safety/              # Path sandbox, read-only
│   │       ├── write/               # Write handlers
│   │       ├── write-safety/        # Write validation
│   │       ├── backup/              # Backup/restore
│   │       └── sandbox/             # Sandbox management
│   └── sqlite-mirror/     # DBF→SQLite import
│       └── src/
│           ├── import-*.ts          # Importers
│           └── sql/migrations/      # Schema migrations
├── docs/                  # Phase docs, runbooks, guides
├── qa-runs/               # QA batch reports
├── scripts/               # Dev, release, QA scripts
├── package.json           # Workspace root
├── pnpm-workspace.yaml
└── vitest.config.mjs
```

---

## Appendix B: Key Decision Records

| Decision | Rationale | Status |
|----------|-----------|--------|
| **Electron over Tauri** | Bridge is Node/Express; Electron ships Node naturally | Implemented |
| **No Tailwind** | Reduces supply-chain surface, keeps CSS semantic | Implemented |
| **DBF direct reads (not migration)** | Avoids data migration risk; read-only is safe | Phase 1 implemented |
| **SQLite mirror (not Postgres)** | Zero-infrastructure; single file; local-only | Phase 2 implemented |
| **Sandbox writes only (no direct legacy writes)** | Protects production data | Phase 3 implemented |
| **4 write routes only** | Minimal risk surface; schedule operations only | Phase 3 implemented |
| **No odontogram** | Clinical complexity; out of scope for MVP | Decision |
| **No payment writes** | Financial integrity; out of scope | Decision |
| **No cloud** | HIPAA/local compliance; clinic preference | Architecture |

---

## Appendix C: Quick Reference

| Need | Document |
|------|----------|
| Full build plan | [master-build-plan.md](./master-build-plan.md) |
| System architecture | [legacy-system-map.md](./legacy-system-map.md) |
| UI design | [clinic-visual-identity.md](./clinic-visual-identity.md) |
| Design system | [design-system.md](./design-system.md) |
| Scope guardrails | [out-of-scope-guardrails.md](./out-of-scope-guardrails.md) |
| Windows field test | [FIELD-TEST-START-HERE.md](./FIELD-TEST-START-HERE.md) |
| Pilot start | [PILOT-START-HERE.md](./PILOT-START-HERE.md) |
| Pilot handoff | [PILOT-HANDOFF-PACK.md](./PILOT-HANDOFF-PACK.md) |
| Windows runbook | [windows-pilot-runbook.md](./windows-pilot-runbook.md) |
| Sandbox QA | [phase-7-sandbox-pilot-qa-runbook.md](./phase-7-sandbox-pilot-qa-runbook.md) |
| Go/no-go | [windows-pilot-go-no-go-checklist.md](./windows-pilot-go-no-go-checklist.md) |
| Data locations | [windows-pilot-data-locations.md](./windows-pilot-data-locations.md) |
| Permission risks | [windows-pilot-permission-and-path-risks.md](./windows-pilot-permission-and-path-risks.md) |
| Product audit | [product-completeness-audit.md](./product-completeness-audit.md) |

---

*Document created: 2026-06-03. Current commit: 3d9d13f. This document is a living roadmap — update as phases complete.*
