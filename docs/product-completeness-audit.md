# Product completeness audit — clinic app deepening batch

**Purpose:** Gap report after the clinic-app **functionality deepening** batch (Wave 1 complete; Wave 2 integration in progress). Guides the next batch without expanding write scope.

**Reviewed:** `packages/app/src/` after Wave 1 agents (PatientWorkspace, ClinicalReadOnly, ScheduleTodayOverview, NavWrite) and partial Wave 2 (UXPolish, SafetyRegression in progress). Checkpoint / auto-commit (Workstream O) **not yet run** at audit time.

**Related guardrails:** [out-of-scope-guardrails.md](./out-of-scope-guardrails.md) · **Windows field test entry:** [FIELD-TEST-START-HERE.md](./FIELD-TEST-START-HERE.md)

**Tier status:** Mac-side read workflows and patient workspace depth are substantially usable. **Clinic go-live remains BLOCKED** until Tier 3 Windows field execution completes per [FIELD-TEST-START-HERE.md](./FIELD-TEST-START-HERE.md). Mac checkpoint ≠ clinic acceptance.

---

## Executive summary

| Area | Daily-use ready? | Notes |
| --- | --- | --- |
| **Today** | Yes (connected bridge) | Status strip + status mix, current/next row highlights, Clinic at a glance, open-patient from rows, mirror freshness |
| **Patients** | Yes | Summary mini-card hub, appointment filters, clinical tab grouping/filters, session recent list, demographics write sandbox-gated |
| **Schedule** | Yes | Status breakdown header, room context, open-patient on rows, `initialDate` from profile “Open in Schedule” |
| **Settings** | Yes | Operator control center (unchanged scope); Windows execution still **Deferred / not yet run** |
| **Writes (4 routes)** | Sandbox + pilot flag only | Preview invalidation on field change; blocked notice inside open panels; post-commit mirror lag nudge |
| **Payments / memos / clinical writes** | Blocked by design | See [out-of-scope-guardrails.md](./out-of-scope-guardrails.md) |
| **Windows clinic PC** | **Not yet run — deferred** | Next strategic gate; no NSIS until field log exists |

---

## What works now (by module)

### Today (`today-dashboard.tsx` + shell wiring)

When the bridge is **connected**:

- **Today's appointments** — sorted list with time, safe patient headline/chart, room/duration/provider/procedure meta, status badges, **current** / **next** row emphasis (`--current` / `--next`), **Open patient record** when `patId !== "0"`.
- **Status strip (aside)** — count card with **status mix** (e.g. scheduled vs completed) via `formatAppointmentStatusMix`; **Data freshness** card from `mirrorStatus`.
- **Clinic at a glance** — `resolveFrontDeskOverview()` rows: bridge, mirror label, write mode label (no paths), today appointment count, session selected patient name/chart; connect guidance when offline (no fake stats).
- **Next appointment** — upcoming visit today; empty/offline/error paths use shared readonly copy.
- **Selected patient** — when shell has selection, name/chart + **Open record** → Patients.
- **Quick actions** — Search patient, Open schedule, Open settings; disabled **Record payment**; pilot-readiness hint.
- **Reminders** — honest pilot placeholder (no fake data).
- **Refresh today** — reloads today's schedule in place.
- **Mirror stale advisory** — copy-only on schedule card when import is stale.

Shell passes mirror, write capability, selected patient, `onOpenPatient`, and optional **Open in Schedule** with today's date on the next card.

### Patients (`PatientSearchBar.tsx`, `PatientProfilePanel.tsx`, `patient-summary-mini-cards.tsx`)

**Search:**

- Debounced combobox (2+ chars), keyboard navigation, topbar open-record chip.
- **Session recent patients** (max 5, in-memory only): footer in search dropdown when query &lt; 2 chars; also on Patients page empty state — `{patientId, displayName, chartNumber}` only (no phone, no `localStorage`).

**Profile:**

- **Header strip** — display name, chart, provider, status, record id.
- **Six tabs** with one-line descriptions.
- **Summary workspace (Workstream A)** — mini-card grid below `ProfileSummaryCard`: appointments (±90 count + next upcoming), medical screening status, treatments/chart/ledger entry counts; skeleton → loaded → empty/error; **click card** → tab; cross-tab action row; **Last refreshed** on toolbar from successful fetches.
- **Appointments tab (Workstream B)** — Default ±90 preset (visible active state), Past 90 / Upcoming 90 presets, Past/Upcoming toggle, status chips, room filter when rooms present, range count line, **Open in Schedule** per row → shell sets Schedule + `initialDate`.
- **Treatments (C)** — group by month; year / provider / procedure-code filters; entry count + filter summary; descriptions hidden.
- **Chart (D)** — group by tooth; treated-only vs all filter; read-only explainer (no odontogram).
- **Medical (E)** — `Intl` questionnaire dates; flagged-count vs visible-flags copy when `med1/med2/aids` omitted; sensitive banner clarified; offline parity.
- **Ledger (F)** — group by month; entry-type filter (charge/adjustment/payment); amounts-hidden chip; truncated banners.
- **Sandbox demographics (pilot)** — Summary when `VITE_SANDBOX_WRITE_PILOT` + sandbox ready; preview → confirm → commit.

Navigation: **Back to Today**, clear patient, change-patient search, recent-patient picks.

### Schedule (`SchedulePanel.tsx`)

- Week/day nav, room filter, grouped rows, keyboard shortcuts, empty/error/offline.
- **Summary header (G)** — status breakdown chips (count by status), room filter context (“Room N · M appointments”), mirror stale advisory when shell passes `mirrorStatus`.
- **Open patient** on rows when `patId !== "0"` (parity with Today).
- **`initialDate`** — applied when navigating from profile appointment row; resets range to that day.
- **Sandbox write pilots** — status, time move, create; unified preview/confirm; `SandboxWriteBlockedNotice` inside open panel when blocked.

### Settings (`SettingsPanel.tsx`, `settings-status.ts`)

Unchanged product scope from prior UX batch: readiness strip, 8-item checklist, masked paths, mirror refresh status, **Windows execution: Deferred / not yet run**.

`resolveFrontDeskOverview()` lives in `settings-status.ts` but renders on **Today**, not Settings.

### App shell (`AppShell.tsx`)

- Four-module sidebar; global/shell banners.
- **Session recent patients** state (`pushSessionRecentPatient`, cap 5) on search select.
- Schedule `initialDate` + `handleOpenScheduleAtDate` from profile.
- `onOpenPatient` from Today and Schedule.

---

## What this batch deepened (Wave 1 — Workstreams A–K)

| Workstream | User-visible improvement |
| --- | --- |
| **A — Patient workspace** | Summary mini-card grid, cross-tab buttons, prefetch on Summary tab, last-refreshed timestamp |
| **B — Appointments** | Default preset, past/upcoming toggle, status/room filters, range count, Open in Schedule → Schedule date |
| **C — Treatments** | Month grouping, year/provider/procedure filters, toolbar counts |
| **D — Chart** | Tooth grouping, treated-only filter, read-only explainer |
| **E — Medical** | Formatted dates, flagged-count honesty, sensitive/offline copy |
| **F — Ledger** | Month grouping, entry-type filter, amounts-hidden chip |
| **G — Schedule** | Status breakdown chips, room context line, open patient, mirror stale in header |
| **H — Today** | Status mix on count card, current/next highlights, enriched status strip + selected patient (from prior batch, extended) |
| **I — Navigation** | Session recent patients (search footer + Patients empty state), no disk persistence |
| **J — Pilot writes** | Preview invalidation on field change (status/move/create), embedded blocked notice, mirror-lag post-commit nudge, centralized copy |
| **K — Front-desk overview** | “Clinic at a glance” on Today via `resolveFrontDeskOverview()` |

**Prior UX batch (baseline):** Today status strip foundation, profile header/tabs, schedule polish, settings checklist, unified write feedback shell — see `qa-runs/2026-05-27-clinic-app-ux-completion-batch-report.md`.

**Wave 2 (in progress at audit time):**

| Workstream | Status |
| --- | --- |
| **L — UX polish** | `app-shell.css` consistency pass started (mini-cards, filter chips, overview card, responsive breakpoints) — not final |
| **M — Safety regression** | Forbidden-token extensions in flight; `safe-write-plan-display.test.ts` not yet present |
| **N — Product audit** | This document |
| **O — Checkpoint** | Pending: full `pnpm test` / build / `qa:sandbox` / batch report; auto-commit only if green per plan |

---

## What still feels rough

UX gaps, not safety blockers:

1. **Dual search inputs** — top bar and Patients page remain separate; recent patients help re-entry but **query text does not sync** between instances.
2. **Recent patients policy** — session-only by design; no product decision on optional safe persistence (would need explicit privacy review).
3. **Selected patient on Today** — shell summary only until profile load on Patients; no inline profile fetch on Today.
4. **Reminders / payments** — intentionally absent; disabled controls may still feel like missing product to front desk.
5. **Mirror lag after writes** — copy nudge added; SQLite mirror still does not auto-refresh; operators must CLI import + Settings refresh.
6. **Write pilots hidden by default** — `VITE_SANDBOX_WRITE_PILOT` + sandbox + row-level `<details>`; Settings explains but discovery is hard.
7. **Status / procedure labels** — numeric status codes and opaque procedure codes; no decoded reference catalogs in UI (field log may justify later).
8. **No odontogram** — chart is grouped list preview only.
9. **CSS cohesion** — Wave 2 L not finalized; filter chips / mini-cards may still vary slightly across modules.
10. **Windows packaging** — desktop Mac build green ≠ clinic PC validation ([FIELD-TEST-START-HERE.md](./FIELD-TEST-START-HERE.md)).
11. **No installer / NSIS** — portable staged tree only until Tier 3 field log.

---

## Intentionally blocked

Per [out-of-scope-guardrails.md](./out-of-scope-guardrails.md) — **do not implement** without a new scope decision:

| Domain | UI signal | Backend |
| --- | --- | --- |
| **Payments / ledger writes** | Disabled “Record payment”; ledger tab read-only, amounts hidden | No write routes; `AMOUNT` / `SAMOUNT` rejected |
| **Treatment / procedure memos** | Treatments tab read-only; truncated lists | Out of scope |
| **Chart / odontogram writes** | Chart tab read-only preview | Out of scope |
| **Medical summary writes** | Medical tab read-only; sensitive banner | Out of scope |
| **Memos / comments** | “Note hidden” badges; body keys blocked on schedule writes | `findBlockedScheduleBodyKeys` + strict Zod |
| **In-app mirror import** | Settings CLI command + Refresh status only | No shell exec |
| **Production legacy DATA_ROOT** | Settings danger paths | Never `Microdent-Legacy` |

**Allowed sandbox writes only (four):**

1. `appointment.statusUpdate`
2. `appointment.timeMove`
3. `appointment.create`
4. `patient.demographics.update` (allowlisted name fields)

---

## Read-only vs sandbox-only vs Windows-test-needed

| Capability | Classification | Requirements |
| --- | --- | --- |
| Today schedule + status mix + Clinic at a glance | **Read-only** | Bridge connected; safe DTOs |
| Patient search, profile tabs, mini-cards, filters | **Read-only** | Mirror or DBF fallback |
| Schedule view, status breakdown, open patient | **Read-only** | Same |
| Session recent patients | **Read-only (session)** | In-memory only; cleared on reload |
| Settings status cards | **Read-only** | Bridge + capability endpoints |
| Appointment status / time / create | **Sandbox-only** | `writeMode: enabled`, valid sandbox, `BACKUP_DIR`, `VITE_SANDBOX_WRITE_PILOT`, `pnpm qa:sandbox` |
| Demographics update | **Sandbox-only** | Same gates |
| Dry-run dev diagnostics | **Dev-only** | `import.meta.env.DEV` |
| Desktop supervisor + bridge on clinic PC | **Windows-test-needed** | [FIELD-TEST-START-HERE.md](./FIELD-TEST-START-HERE.md) |
| Field execution EXEC-01–16 | **Windows-test-needed** | Tier 3 gate |
| Clinic go-live / production writes | **Blocked** | Tier 3 field log + go/no-go |

**Privacy:** Safe DTOs + display helpers; forbidden-token tests on mini-cards, filters, overview, schedule breakdown, write blocked states (Wave 2 M extending coverage).

---

## Future data / write support needs

Ordered by likely next work — **not committed**:

### Tier 3 — Windows field execution (**next strategic gate**)

- Single clinic PC run via [FIELD-TEST-START-HERE.md](./FIELD-TEST-START-HERE.md) + [`qa-runs/TEMPLATE-windows-field-run.md`](../qa-runs/TEMPLATE-windows-field-run.md).
- Validate desktop first-run, supervisor, bridge health, read-only smoke, optional sandbox writes on Windows.
- Resolve path/permission issues from [windows-pilot-permission-and-path-risks.md](./windows-pilot-permission-and-path-risks.md).
- **No NSIS/installer** until field log exists.

### After field log (optional Mac polish — no new write domains)

- Decoded procedure/status reference labels if field log confirms safe mappings.
- Recent-patients persistence policy (if ever desired — explicit privacy sign-off).
- Visual odontogram (large scope; currently out).
- Stronger search query sync (display-only).
- Reminders product decision — integrate or remove placeholder permanently.

### Data / mirror

- Operator workflow for post-commit → mirror import → Settings refresh (partially documented; copy nudge on writes).

### Write scope expansion

Requires guardrail review, route inventory, blocked-key audit, `qa:sandbox` extension. **Do not ad-hoc.**

---

## Test coverage snapshot

Wave 1 + partial Wave 2 (representative):

| File | Focus |
| --- | --- |
| `patient-summary-mini-cards.tsx` | Mini-card UI module |
| `patient-profile-panel.test.tsx` | Mini-cards, appt filters, last refreshed, Open in Schedule, clinical bodies |
| `patient-appointments-range.test.ts` | Range presets |
| `patient-appointments-display.test.ts` | Past/upcoming, status/room filters, status mix, next upcoming |
| `patient-treatments-display.test.ts` | Month groups, filters |
| `patient-chart-display.test.ts` | Tooth groups, treated filter |
| `patient-medical-summary-display.test.ts` | Flagged count copy, dates |
| `patient-ledger-display.test.ts` | Month groups, type filter |
| `today-dashboard.test.tsx` | Status mix, current/next, Clinic at a glance, mirror |
| `schedule-panel.test.tsx` | Status breakdown, open patient, `initialDate` |
| `settings-status.test.ts` | `resolveFrontDeskOverview` |
| `session-recent-patients.test.ts` | Cap, dedupe, safe meta format |
| `patient-search-bar.test.tsx` | Recent list, no phone |
| `app-shell.test.tsx` | Recent patients not persisted to disk |
| `appointment-*-write.test.tsx` | Preview invalidation, blocked notice |
| Write / smoke (Wave 2 M) | `safe-write-plan-display.test.ts` pending; smoke extensions in flight |

---

## Recommended next batch

1. **Complete Wave 2** — UX polish (L), safety regression (M).
2. **Wave 3 checkpoint (O)** — full test/build/stage/`qa:sandbox`/batch report; auto-commit only if plan conditions green.
3. **Windows field execution batch** — primary go-live gate; consolidated clinic PC run using [FIELD-TEST-START-HERE.md](./FIELD-TEST-START-HERE.md).

Optional follow-ups after field log: decoded catalogs, recent-patients policy, odontogram — only with explicit scope.

---

## Quick reference links

- **Scope lock:** [out-of-scope-guardrails.md](./out-of-scope-guardrails.md)
- **Windows field test:** [FIELD-TEST-START-HERE.md](./FIELD-TEST-START-HERE.md)
- **Pilot handoff:** [PILOT-START-HERE.md](./PILOT-START-HERE.md)
- **Sandbox QA:** [phase-7-sandbox-pilot-qa-runbook.md](./phase-7-sandbox-pilot-qa-runbook.md)
- **Deepening plan:** `.cursor/plans/clinic_app_deepening_batch_6eb1da3a.plan.md` (local)

---

*Audit author: Agent ProductAudit (Workstream N). Update after Wave 3 checkpoint if readiness narrative changes.*
