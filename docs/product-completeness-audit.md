# Product completeness audit — clinic app UX batch

**Purpose:** Gap report for the Mac clinic-app UX batch (Wave 1 complete; Wave 2 shell/CSS/safety in progress). Guides the next batch without expanding write scope.

**Reviewed:** `packages/app/src/` after Wave 1 (A–G) and Wave 2 (H–K). Wave 3 checkpoint (L) run 2026-05-21 — see `qa-runs/2026-05-27-clinic-app-ux-completion-batch-report.md`.

**Related guardrails:** [out-of-scope-guardrails.md](./out-of-scope-guardrails.md) · **Windows field test entry:** [FIELD-TEST-START-HERE.md](./FIELD-TEST-START-HERE.md)

**Tier status:** Mac-side UX is substantially usable for daily read workflows. **Clinic go-live remains BLOCKED** until Tier 3 Windows field execution completes per [FIELD-TEST-START-HERE.md](./FIELD-TEST-START-HERE.md).

---

## Executive summary

| Area | Daily-use ready? | Notes |
| --- | --- | --- |
| **Today** | Yes (connected bridge) | Live schedule, next appointment, status strip, open-patient from rows |
| **Patients** | Yes | Search + 6-tab profile; demographics write is sandbox-gated only |
| **Schedule** | Yes | Week/day nav, room filter, keyboard shortcuts; 3 write pilots when enabled |
| **Settings** | Yes | Operator control center with readiness strip, 8-item checklist, masked paths |
| **Writes (4 routes)** | Sandbox + pilot flag only | Never production legacy |
| **Payments / memos / clinical writes** | Blocked by design | See [out-of-scope-guardrails.md](./out-of-scope-guardrails.md) |
| **Windows clinic PC** | Not yet run | Deferred — Mac checkpoint ≠ clinic acceptance |

---

## What works now (by module)

### Today (`today-dashboard.tsx` + shell wiring)

When the bridge is **connected**:

- **Today's appointments** card — sorted list with time, safe patient headline/chart, room/duration/provider/procedure meta, status badges, “Note hidden” / missed indicators, inline **Open patient record** when `patId !== "0"`.
- **Status strip (aside)** — appointment count card + **Data freshness** card driven by `mirrorStatus` (active / stale / DBF fallback / offline).
- **Next appointment** card — upcoming visit today with CTAs; empty/offline/error paths use shared readonly-state copy.
- **Selected patient** card — when shell has `selectedPatientId`, shows name/chart and **Open record** → Patients module.
- **Quick actions** — Search patient, Open schedule, Open settings; disabled **Record payment** with honest tooltip; pilot-readiness hint copy.
- **Reminders** — explicit “not available in pilot” copy (no fake data).
- **Refresh today** — reloads today's schedule without leaving the page.
- **Mirror stale advisory** — copy-only banner on the schedule card when import is stale.
- **Empty / offline / error** — dedicated empty state, bridge-offline messaging, retry on load failure.

Shell passes `onOpenPatient`, mirror props, and selected-patient summary from `AppShell.tsx`. Top bar shows **open-record chip** when a patient is selected (`PatientSearchBar` + `selectedDisplayName`).

**Dev only:** legacy catalog and fixture connection panels.

### Patients (`PatientSearchBar.tsx`, `PatientProfilePanel.tsx`)

**Search (top bar + Patients page):**

- Debounced combobox (2+ chars), labeled field, status hierarchy (idle / searching / no match / error).
- **ArrowUp / ArrowDown / Enter** keyboard navigation with WAI-ARIA listbox pattern; Escape and outside-click dismiss.
- Topbar **open-record chip** when shell passes `selectedDisplayName`.
- Page empty state with lede, example hint (“search by name or chart”), privacy note.
- **Change patient** flow with `clearSelectionOnQueryChange={false}` on embedded search.

**Profile (when a record is open):**

- **Header strip** — display name, chart, provider label, active status, record id (safe fields only).
- **Six tabs** — Summary, Appointments, Medical, Treatments, Chart, Ledger preview; one-line tab descriptions under tab list.
- **Unified readonly states** — loading / error / empty per tab via `.app-readonly-state` patterns and shared copy constants.
- **Appointments tab** — `Intl.DateTimeFormat` day headers (not raw ISO); range presets; refresh toolbar.
- **Clinical tabs** — section headers, truncated-list banners (`TRUNCATED_LIST_BANNER`), sensitive medical banner, ledger “amounts hidden” copy; no payment amounts in DOM.
- **Sandbox demographics (pilot)** — on Summary when `VITE_SANDBOX_WRITE_PILOT` + bridge sandbox ready; preview → confirm → commit with backup/audit feedback; profile refresh after commit.

Navigation: **Back to Today**, clear patient, change-patient search.

### Schedule (`SchedulePanel.tsx`)

- **Week / day** granularity toggle with prev/next navigation, **Today** button with active emphasis, formatted range heading.
- **Room filter** — all rooms + per-room options with loading-safe empty UX.
- **Appointment rows** — duration, patient primary/chart, provider/procedure labels, status/missed/note-hidden badges, grouped by day and room.
- **Keyboard shortcuts** — ← → range nav, **T** jumps to today (hint copy in toolbar).
- **Empty / error / offline** — `EmptyState`, retry via refresh, connect messaging when offline.
- **Footer create** — `defaultDate={rangeFrom}` tracks navigation range.
- **Back to Today** footer action.

**Sandbox write pilots** (per row, collapsed `<details>` by default):

- Status update and time move via `AppointmentWriteActionsPanel`.
- Footer **appointment create** via `AppointmentCreateWriteAction`.
- Unified preview → confirm → commit UI, blocked notices when pilot off / write mode off / sandbox invalid.
- Schedule-level sandbox banner when pilots are active.

**Dev only:** per-row dry-run diagnostics when `writeDiagnosticsActions` + DEV.

### Settings (`SettingsPanel.tsx`, `settings-status.ts`)

- **Pilot readiness strip** — bridge, read-only vs writes-active, mirror state, sandbox/backup chips, **Windows execution: Deferred / not yet run**, field-test doc hint.
- **8-item pilot checklist** — bridge, DATA_ROOT, mirror, backup, write mode, sandbox, pilot UI flag, Windows field test; each with tone + next-step copy.
- **Danger banners** — mirror stale, write mode, sandbox warnings (deduped with shell banners on Settings page).
- **11 operator cards** — bridge, data paths (masked), write mode chip, sandbox validity, backup, pilot flag, pilot build metadata fetch, SQLite mirror, mirror import runs table, desktop context, refresh control.
- **Mirror Refresh status** — fetches `GET /v1/mirror/status`; stale callout when import age exceeds threshold.
- Paths masked via `maskOperatorPath`; raw `DATA_ROOT` never in production markup.

### App shell (`AppShell.tsx`)

- Four-module sidebar: Today, Patients, Schedule, Settings (payments/reports/chart modules **not** in sidebar; hint points to Patients tabs).
- Global read-only banner + conditional shell status banners (mirror / write mode / sandbox).
- Bridge health probe + Refresh; optional dev diagnostics (gated `import.meta.env.DEV`).
- Module **page ledes** under h2 heading per active module.
- Selected patient flows: search select → Patients; Today open-patient → sets selection + navigates.

---

## What this batch improved (Wave 1)

| Workstream | User-visible improvement |
| --- | --- |
| **A — Today** | Status strip cards, selected patient card, open-patient from rows, refresh today, honest reminders, quick actions incl. settings, mirror freshness labels |
| **B — Search** | Keyboard nav, clearer labels/status, page empty state, topbar open-record chip |
| **C — Profile** | Header strip, tab descriptions, formatted appt dates, demographics pilot gating + post-commit refresh |
| **D — Schedule** | Toolbar polish, Today emphasis, row readability, empty/error states, create date sync |
| **E — Writes** | Unified sandbox banners, preview/confirm/commit feedback, blocked states, `sandbox-write-pilot` helpers |
| **F — Clinical tabs** | Shared truncated banners, section headers, forbidden-token test parity, ledger amounts hidden |
| **G — Settings** | Readiness strip + checklist, danger banners, mirror stale, refresh, pilot build metadata, Windows deferred chip |

**Wave 2 (complete):** shell nav (H), `app-shell.css` pass (I), forbidden-token regression (K). **Wave 3 checkpoint (L):** staging/manifest/sandbox QA passed; root `pnpm test` failed one bridge privacy assertion (UUID `/555/` false positive) — Mac signoff blocked until fixed.

---

## What still feels rough

These are **UX gaps**, not safety blockers:

1. **Dual search inputs** — top bar and Patients page search are separate DOM instances; query text does not fully sync (selection/name chip helps top bar only).
2. **Selected patient on Today** — shows shell summary until profile load on Patients; no inline profile fetch on Today.
3. **Reminders / payments** — intentionally absent; disabled buttons may still feel like “missing product” to front desk staff.
4. **Mirror lag after writes** — commits update DBF; SQLite mirror does not auto-refresh; operators must CLI import + Settings refresh (documented, easy to forget).
5. **Write pilots hidden by default** — require `VITE_SANDBOX_WRITE_PILOT=true` **and** enabled sandbox on bridge; Settings explains but first-time operators may not find row-level `<details>` panels.
6. **No sidebar modules for Reports / Payments** — by design, but power users may expect top-level nav.
7. **CSS cohesion** — Wave 2 UX polish (I) not finalized; some cards/spacing may still feel uneven across modules.
8. **Windows packaging** — desktop build exists; real clinic PC validation not done ([FIELD-TEST-START-HERE.md](./FIELD-TEST-START-HERE.md)).
9. **No installer / NSIS** — portable staged tree only; IT handoff gaps documented elsewhere.

---

## Intentionally blocked

Per [out-of-scope-guardrails.md](./out-of-scope-guardrails.md) — **do not implement** without a new scope decision:

| Domain | UI signal | Backend |
| --- | --- | --- |
| **Payments / ledger writes** | Disabled “Record payment”; ledger tab read-only, amounts hidden | No write routes; `AMOUNT` / `SAMOUNT` rejected |
| **Treatment / procedure memos** | Treatments tab read-only; truncated lists | Out of scope |
| **Chart / odontogram writes** | Chart tab read-only | Out of scope |
| **Medical summary writes** | Medical tab read-only; sensitive banner | Out of scope |
| **Memos / comments** | “Note hidden” badges; `COMMENT`/`NOTE`/`DESCRIPT` blocked on schedule writes | `findBlockedScheduleBodyKeys` + strict Zod |
| **In-app mirror import** | Settings shows CLI command + Refresh status only | No shell exec |
| **Production legacy DATA_ROOT** | Settings danger paths; sandbox guardrails | Never `Microdent-Legacy` |

**Allowed sandbox writes only (four):**

1. `appointment.statusUpdate`
2. `appointment.timeMove`
3. `appointment.create`
4. `patient.demographics.update` (allowlisted name fields)

---

## Read-only vs sandbox-only vs Windows-test-needed

| Capability | Classification | Requirements |
| --- | --- | --- |
| Today schedule list | **Read-only** | Bridge connected + schedule read route |
| Patient search & profile tabs | **Read-only** | Mirror or DBF fallback |
| Schedule view & filters | **Read-only** | Same as above |
| Settings status cards | **Read-only** | Bridge + optional mirror/write capability endpoints |
| Appointment status / time / create | **Sandbox-only** | `writeMode: enabled`, valid sandbox, `BACKUP_DIR`, `VITE_SANDBOX_WRITE_PILOT`, `pnpm qa:sandbox` proof |
| Demographics update | **Sandbox-only** | Same gates as schedule writes |
| Dry-run dev diagnostics | **Dev-only** | `import.meta.env.DEV` + host flag |
| Desktop supervisor + bridge spawn | **Windows-test-needed** | Mac build green ≠ clinic PC paths/permissions |
| Field execution EXEC-01–16 | **Windows-test-needed** | [FIELD-TEST-START-HERE.md](./FIELD-TEST-START-HERE.md) |
| Clinic go-live / production writes | **Blocked** | Tier 3 field log + go/no-go; see guardrails MF5–MF6 |

**Privacy:** All read surfaces use safe DTOs + display helpers; `assertNoForbiddenDomTokens` in tests guards PHI/payment literals in DOM.

---

## Future data / write support needs

Ordered by likely next batches — **not committed work**:

### Tier 3 — Windows field execution (next strategic gate)

- Run [FIELD-TEST-START-HERE.md](./FIELD-TEST-START-HERE.md) on a clinic PC; file PHI-safe result in `qa-runs/`.
- Validate desktop first-run paths, supervisor, bridge health, read-only smoke, optional sandbox writes on Windows.
- Resolve packaging/path permission issues from [windows-pilot-permission-and-path-risks.md](./windows-pilot-permission-and-path-risks.md).

### Product UX (no new write domains)

- Optional search query sync between topbar and Patients page (display-only).
- Stronger cross-module patient context (e.g. open schedule from profile appt row).
- Reminders/notifications product decision — integrate or permanently remove placeholder card.
- Post-write operator prompt to refresh mirror status (copy-only nudge, not in-app import).

### Data / mirror

- Operator workflow doc for “after sandbox commit → mirror import → Refresh status” (partially in Settings next-steps).
- Stale-mirror UX on Schedule module (Today already has advisory).

### Write scope expansion (requires new guardrail review)

If clinic demands beyond four routes, each domain needs: route inventory test, blocked-key audit, UI forbidden-token tests, `pnpm qa:sandbox` extension, and explicit [out-of-scope-guardrails.md](./out-of-scope-guardrails.md) amendment. **Do not ad-hoc.**

Likely future domains (currently out of scope): ledger/payments, treatment lines, chart notes, medical free text, schedule memos.

### Packaging / distribution

- Windows installer decision ([windows-pilot-installer-decision-record.md](./windows-pilot-installer-decision-record.md)).
- Staged release verification already gated by `pnpm pilot:verify-release` + manifest — still needs real-machine sign-off.

---

## Test coverage snapshot (Wave 1)

Vitest files touched by the batch (representative, not exhaustive):

| File | Focus |
| --- | --- |
| `today-dashboard.test.tsx` | Status strip, mirror stale, selected patient, open-patient, refresh, forbidden tokens |
| `patient-search-bar.test.tsx` | Keyboard a11y, open-record chip, select/clear flows |
| `patient-profile-panel.test.tsx` | Header strip, tabs, clinical bodies, demographics gating |
| `schedule-panel.test.tsx` | Nav, filters, create footer, write panels |
| `settings-panel.test.tsx` | Danger banners, checklist, mirror stale, refresh, pilot build |
| `sandbox-write-pilot.test.ts` | Gating helpers |

Wave 2 **K** extends forbidden-token coverage and read-only flow smoke (Chart + Ledger paths).

---

## Recommended next batch

1. **Fix bridge test** — `services/bridge/src/patient-demographics-write.test.ts` forbidden `/555/` guard (false positive on `operationId` UUID); re-run green `pnpm test`.
2. **Mac signoff** — `pnpm pilot:release-signoff` after tests green; commit only if explicitly instructed.
3. **Windows field execution batch** — single consolidated clinic PC run using [FIELD-TEST-START-HERE.md](./FIELD-TEST-START-HERE.md); Tier 3 remains final clinic gate.

---

## Quick reference links

- **Scope lock:** [out-of-scope-guardrails.md](./out-of-scope-guardrails.md)
- **Windows field test:** [FIELD-TEST-START-HERE.md](./FIELD-TEST-START-HERE.md)
- **Pilot handoff:** [PILOT-START-HERE.md](./PILOT-START-HERE.md)
- **Sandbox QA:** [phase-7-sandbox-pilot-qa-runbook.md](./phase-7-sandbox-pilot-qa-runbook.md)
- **Backup/restore after writes:** [pilot-backup-restore-audit.md](./pilot-backup-restore-audit.md)

---

*Audit authors: Agent ProductAudit (J); checkpoint narrative updated by Agent FinalReport (L), 2026-05-21.*
