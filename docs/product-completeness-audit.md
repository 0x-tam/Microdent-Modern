# Product completeness audit — reference context enrichment batch

**Purpose:** Gap report after the **safe reference context & timeline enrichment** batch (Wave 1 complete; Wave 2 safety/audit in progress). Guides the next batch without expanding write scope.

**Reviewed:** `packages/app/src/` after Wave 1 agents (ReferenceLabels, PatientTimeline, ScheduleApptFilters, ClinicalEnrich, WriteOverview) and partial Wave 2 (SafetyRegression in progress). Checkpoint / auto-commit (Workstream N) **not yet run** at audit time.

**Baseline:** `229a79a` — prior clinic-app deepening batch (mini-cards, clinical filters/grouping, schedule status breakdown display, Clinic at a glance, session recent patients, write UX unify).

**Related guardrails:** [out-of-scope-guardrails.md](./out-of-scope-guardrails.md) · **Windows field test entry:** [FIELD-TEST-START-HERE.md](./FIELD-TEST-START-HERE.md)

**Tier status:** Mac-side read workflows and patient workspace depth are substantially usable. **Clinic go-live remains BLOCKED** until Tier 3 Windows field execution completes per [FIELD-TEST-START-HERE.md](./FIELD-TEST-START-HERE.md). Mac checkpoint ≠ clinic acceptance.

---

## Executive summary

| Area | Daily-use ready? | Notes |
| --- | --- | --- |
| **Today** | Yes (connected bridge) | Unified visit meta (room names, provider, procedure), current/next highlights, Clinic at a glance with sandbox pilot + session recent + status mix rows, Open Settings link |
| **Patients** | Yes | **Seven tabs** including Timeline; unified labels; interactive appointment filters; clinical tab intelligence; summary refresh fix; cross-tab navigation from timeline |
| **Schedule** | Yes | **Interactive** status/provider filter chips, per-day counts, current-appointment highlight, room names, write-mode chip, open-patient + `initialDate` preserved |
| **Settings** | Yes | Operator control center (unchanged scope); Windows execution still **Deferred / not yet run** |
| **Writes (4 routes)** | Sandbox + pilot flag only | Doctor `<select>` from reference on create; discoverability hint above write panels; preview invalidation; blocked notice; mirror lag nudge |
| **Payments / memos / clinical writes** | Blocked by design | See [out-of-scope-guardrails.md](./out-of-scope-guardrails.md) |
| **Windows clinic PC** | **Not yet run — deferred** | **Next strategic gate**; no NSIS until field log exists |

---

## What works now (by module)

### Today (`today-dashboard.tsx` + shell wiring)

When the bridge is **connected**:

- **Today's appointments** — sorted list with time, safe patient headline/chart, **unified visit meta** via `appointmentVisitMeta()` (room name from `GET /v1/schedule/rooms` when loaded, duration, provider, procedure), status badges with human `semanticLabel`, **current** / **next** row emphasis, **Open patient record** when `patId !== "0"`.
- **Status strip (aside)** — count card with **status mix** via `formatAppointmentStatusMix`; **Data freshness** card from `mirrorStatus`.
- **Clinic at a glance** — extended `resolveFrontDeskOverview()` rows: bridge, mirror, write mode, **sandbox pilot on/off**, today count, **optional status mix one-liner**, **session recent patient count** (when &gt; 0), selected patient; **Open Settings** text link (module switch); connect guidance when offline.
- **Next appointment** — upcoming visit today with unified meta; empty/offline/error paths use shared readonly copy.
- **Selected patient** — when shell has selection, name/chart + **Open record** → Patients.
- **Quick actions** — Search patient, Open schedule, Open settings; disabled **Record payment**; pilot-readiness hint.
- **Reminders** — honest pilot placeholder (no fake data).
- **Refresh today** — reloads today's schedule in place.
- **Mirror stale advisory** — copy-only on schedule card when import is stale.

### Patients (`PatientSearchBar.tsx`, `PatientProfilePanel.tsx`, `patient-summary-mini-cards.tsx`, `patient-timeline.tsx`)

**Search:**

- Debounced combobox (2+ chars), keyboard navigation, topbar open-record chip.
- **Session recent patients** (max 5, in-memory only): footer in search dropdown when query &lt; 2 chars; also on Patients page empty state — `{patientId, displayName, chartNumber}` only (no phone, no `localStorage`).

**Profile:**

- **Header strip** — display name, chart, provider (`Doctor {id}` when set, `—` when null), status, record id.
- **Seven tabs** with one-line descriptions: Summary, **Timeline**, Appointments, Medical, Treatments, Chart, Ledger preview.
- **Summary workspace** — mini-card grid below `ProfileSummaryCard`: appointments (±90 count + next upcoming **with provider/procedure meta**), medical screening status, treatments/chart/ledger entry counts, **Timeline** mini-card; skeleton → loaded → empty/error; **click card** → tab; cross-tab action row; **Last refreshed** on toolbar; **toolbar Refresh bumps `summaryRefreshNonce`** so mini-cards reload.
- **Timeline tab (new)** — `patient-timeline-display.ts` merges safe dated events (appointments ±365 default, treatments, ledger, medical snapshot, profile anchor) plus undated **chart snapshot** row; month/day grouping, truncated + range banners; row click → source tab (+ optional chart tooth filter from treatment rows); parallel fetch on tab active.
- **Appointments tab** — Default ±90 preset, Past/Upcoming presets and toggle, **interactive status chips**, **provider filter chips** (when multiple `docId` in range), room filter with **room display names**, range count line, unified visit meta, **Open in Schedule** per row.
- **Treatments** — month grouping; year / provider / procedure-code filters; **procedure category** from reference when label is code-only; **top-3 provider stats** toolbar line; optional **tooth filter** chips; descriptions hidden.
- **Chart** — **tooth summary strip** (treated vs not treated, unique teeth); tooth grouping; treated-only filter; optional **chart-type filter** chips (`Type N` opaque codes only); expanded read-only explainer (no odontogram).
- **Medical** — **General screening** vs **Additional markers** sections; `Intl` questionnaire dates with last-updated prominence; flagged-count vs visible-flags copy when `med1/med2/aids` omitted; improved sensitive-path bullet copy; offline parity.
- **Ledger preview** — month grouping with **entry count per month**; **type distribution** summary (e.g. “3 charges · 1 payment” — counts only); entry-type filter; amounts-hidden chip; truncated banners.
- **Sandbox demographics (pilot)** — Summary when `VITE_SANDBOX_WRITE_PILOT` + sandbox ready; preview → confirm → commit.

Navigation: **Back to Today**, clear patient, change-patient search, recent-patient picks.

### Schedule (`SchedulePanel.tsx`)

- Week/day nav, room filter, grouped rows, keyboard shortcuts, empty/error/offline.
- **Summary header** — **interactive status breakdown chips** (toggle client-side status filter), **provider filter chips** when multiple providers in range, room filter context with display names, mirror stale advisory (extended when filters active).
- **Per-day headers** — `N appointments` count on each day card.
- **Current appointment highlight** — `--current` row when visible range includes today (`findCurrentAppointmentInRange`).
- **Unified visit meta** on rows; status badges use human semantic labels.
- **Open patient** on rows when `patId !== "0"`.
- **`initialDate`** — applied from profile “Open in Schedule”; resets range to that day; preserved after filter changes.
- **Write-mode/sandbox chip** near footer; discoverability hint above write `<details>`: “Expand row for sandbox write actions (pilot env required).”
- **Sandbox write pilots** — status, time move, create with doctor `<select>` from reference doctors; unified preview/confirm; `SandboxWriteBlockedNotice` inside open panel when blocked.

### Settings (`SettingsPanel.tsx`, `settings-status.ts`)

Unchanged product scope from prior UX batch: readiness strip, 8-item checklist, masked paths, mirror refresh status, **Windows execution: Deferred / not yet run**.

`resolveFrontDeskOverview()` lives in `settings-status.ts` but renders on **Today**, not Settings.

### App shell (`AppShell.tsx`)

- Four-module sidebar; global/shell banners.
- **Session recent patients** state (`pushSessionRecentPatient`, cap 5) on search select; count surfaced on Today overview.
- Schedule `initialDate` + `handleOpenScheduleAtDate` from profile.
- `onOpenPatient` from Today and Schedule.

---

## What this batch added (Wave 1 — Workstreams A–K)

| Workstream | User-visible improvement |
| --- | --- |
| **A — Reference labels** | `appointmentVisitMeta()`, `roomDisplayLabel()`, unified status `semanticLabel`, `procClassDisplayLabel` category fallback, profile provider fallback, treatment procedure reference join; wired on Today, Schedule, Profile, mini-cards |
| **B — Patient timeline** | New Timeline tab; `patient-timeline-display.ts` + `patient-timeline.tsx`; merge/sort/group safe events; chart snapshot row; truncated + range banners |
| **C — Interactive filters** | Provider filter on Appointments + Schedule; **clickable** schedule status breakdown chips; daily appointment counts on schedule day headers |
| **D — Schedule intelligence** | Current-appointment highlight in visible range; write-mode chip; mirror stale copy when filters active |
| **E — Treatments intelligence** | Procedure category from reference; provider stats (top 3); optional tooth filter chips |
| **F — Chart intelligence** | Tooth summary strip; chart-type filter chips; expanded limitation explainer |
| **G — Ledger intelligence** | Type distribution counts; month headers with entry counts |
| **H — Medical clarity** | General vs additional screening sections; improved sensitive-path copy; clearer questionnaire dates |
| **I — Cross-navigation** | Summary refresh fix; timeline row → tab (+ tooth filter hint); Timeline mini-card; treatment → Chart cross-link |
| **J — Write refinement** | Doctor `<select>` on create from reference; schedule write discoverability hint; mirror nudge parity on status/move/create |
| **K — Overview extension** | Sandbox pilot row, session recent count, status mix one-liner on Today; Open Settings link |

**Prior deepening batch (229a79a):** mini-cards, clinical filters/grouping, static schedule status breakdown display, Clinic at a glance foundation, session recent patients, write UX unify — see `qa-runs/2026-05-27-clinic-app-ux-completion-batch-report.md`.

**Wave 2 (in progress at audit time):**

| Workstream | Status |
| --- | --- |
| **L — Safety regression** | Forbidden-token tests + smoke extensions for timeline, reference labels, interactive filters, ledger distribution, overview rows — in flight |
| **M — Product audit** | This document |
| **N — Checkpoint** | Pending: full `pnpm test` / build / `qa:sandbox` / batch report; auto-commit only if green per plan |

---

## What still feels rough

UX gaps, not safety blockers:

1. **Dual search inputs** — top bar and Patients page remain separate; recent patients help re-entry but **query text does not sync** between instances.
2. **Recent patients policy** — session-only by design; no product decision on optional safe persistence (would need explicit privacy review).
3. **Selected patient on Today** — shell summary only until profile load on Patients; no inline profile fetch on Today.
4. **Reminders / payments** — intentionally absent; disabled controls may still feel like missing product to front desk.
5. **Mirror lag after writes** — copy nudge added; SQLite mirror still does not auto-refresh; operators must CLI import + Settings refresh.
6. **Write pilots still gated** — `VITE_SANDBOX_WRITE_PILOT` + sandbox + row-level `<details>`; hint added but env flag remains required.
7. **Decoded status/chart/ledger catalogs deferred** — numeric status codes and opaque procedure/chart codes remain; **post–Windows field log only** if mappings confirm safe (see plan). Category fallback helps treatments; full decode not shipped.
8. **No odontogram** — chart is grouped list preview only; **out of scope**.
9. **Timeline window honesty** — default ±365-day appointment window; truncated lists show banners but not full history.
10. **Opaque chart types** — filter chips use `Type N` only; no clinical decode without field validation.
11. **Filter scope limits** — provider/status filters apply to **loaded range only**; changing week/day may reset filter context unexpectedly for some operators.
12. **CSS cohesion** — `app-shell.css` touched in batch; minor chip/card variance may remain across modules.
13. **Windows packaging** — desktop Mac build green ≠ clinic PC validation ([FIELD-TEST-START-HERE.md](./FIELD-TEST-START-HERE.md)).
14. **No installer / NSIS** — portable staged tree only until Tier 3 field log.

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
| Patient search, profile tabs (incl. Timeline), mini-cards, filters | **Read-only** | Mirror or DBF fallback |
| Schedule view, interactive status/provider filters, open patient | **Read-only** | Same |
| Session recent patients | **Read-only (session)** | In-memory only; cleared on reload |
| Settings status cards | **Read-only** | Bridge + capability endpoints |
| Appointment status / time / create | **Sandbox-only** | `writeMode: enabled`, valid sandbox, `BACKUP_DIR`, `VITE_SANDBOX_WRITE_PILOT`, `pnpm qa:sandbox` |
| Demographics update | **Sandbox-only** | Same gates |
| Dry-run dev diagnostics | **Dev-only** | `import.meta.env.DEV` |
| Desktop supervisor + bridge on clinic PC | **Windows-test-needed** | [FIELD-TEST-START-HERE.md](./FIELD-TEST-START-HERE.md) |
| Field execution EXEC-01–16 | **Windows-test-needed** | Tier 3 gate |
| Clinic go-live / production writes | **Blocked** | Tier 3 field log + go/no-go |

**Privacy:** Safe DTOs + display helpers; forbidden-token tests on timeline, reference-enriched labels, interactive filters, ledger type distribution, overview rows (Wave 2 L extending coverage).

---

## Future data / write support needs

Ordered by likely next work — **not committed**:

### Tier 3 — Windows field execution (**next batch — primary gate**)

- Single clinic PC run via [FIELD-TEST-START-HERE.md](./FIELD-TEST-START-HERE.md) + [`qa-runs/TEMPLATE-windows-field-run.md`](../qa-runs/TEMPLATE-windows-field-run.md).
- Validate desktop first-run, supervisor, bridge health, read-only smoke, optional sandbox writes on Windows.
- Resolve path/permission issues from [windows-pilot-permission-and-path-risks.md](./windows-pilot-permission-and-path-risks.md).
- **No NSIS/installer** until field log exists.

### After field log (optional Mac polish — no new write domains)

- **Decoded procedure/status/chart/ledger reference labels** — only if field log confirms safe mappings (currently deferred).
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
| `patient-timeline-display.test.ts` | Timeline merge, sort, group, chart snapshot, range/truncated banners |
| `patient-timeline.tsx` | Timeline render (via profile panel tests) |
| `patient-appointments-display.test.ts` | `appointmentVisitMeta`, room labels, interactive status/provider filters, current-in-range, per-day count |
| `doctor-labels.test.ts` | Provider display labels |
| `procedure-reference.test.ts` | Category fallback, `procClassDisplayLabel` |
| `patient-profile-panel.test.tsx` | Timeline tab, cross-nav, summary refresh, provider filters, clinical bodies |
| `patient-treatments-display.test.ts` | Category label, provider stats, tooth filter |
| `patient-chart-display.test.ts` | Summary stats, chart-type filter |
| `patient-ledger-display.test.ts` | Type distribution, month entry counts |
| `patient-medical-summary-display.test.ts` | Screening sections, dates, sensitive copy |
| `patient-summary-mini-cards.tsx` | Timeline card, visit meta on appointments card |
| `today-dashboard.test.tsx` | Extended overview rows, Open Settings, unified meta |
| `schedule-panel.test.tsx` | Interactive status/provider filters, per-day counts, current highlight, write hint |
| `settings-status.test.ts` | Sandbox pilot, session recent, status mix in overview |
| `appointment-create-write.test.tsx` | Doctor select from reference |
| `read-only-flow-smoke.test.tsx` | Timeline navigation, schedule filter interaction (Wave 2 L extending) |

Prior deepening batch tests (`patient-summary-mini-cards`, session recent, write invalidation, etc.) remain valid.

---

## Recommended next batch

1. **Complete Wave 2** — safety regression (L); this audit (M).
2. **Wave 3 checkpoint (N)** — full test/build/stage/`qa:sandbox`/batch report; auto-commit only if plan conditions green.
3. **Windows field execution batch (Tier 3)** — **primary go-live gate**; consolidated clinic PC run using [FIELD-TEST-START-HERE.md](./FIELD-TEST-START-HERE.md).

Optional follow-ups **after field log:** decoded status/chart/ledger catalogs (if mappings validated), recent-patients policy, odontogram — only with explicit scope.

---

## Quick reference links

- **Scope lock:** [out-of-scope-guardrails.md](./out-of-scope-guardrails.md)
- **Windows field test:** [FIELD-TEST-START-HERE.md](./FIELD-TEST-START-HERE.md)
- **Pilot handoff:** [PILOT-START-HERE.md](./PILOT-START-HERE.md)
- **Sandbox QA:** [phase-7-sandbox-pilot-qa-runbook.md](./phase-7-sandbox-pilot-qa-runbook.md)
- **Reference context plan:** `.cursor/plans/reference_context_enrichment_01ced259.plan.md` (local)
- **Prior deepening plan:** `.cursor/plans/clinic_app_deepening_batch_6eb1da3a.plan.md` (local)

---

*Audit author: Agent ProductAudit (Workstream M). Update after Wave 3 checkpoint if readiness narrative changes.*
