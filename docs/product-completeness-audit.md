# Product completeness audit — clinic workflow completion batch

**Purpose:** Gap report after the **clinic workflow completion** batch (Workstreams A–O). Guides the next batch without expanding write scope.

**Reviewed:** `packages/app/src/` after PatientWorkspace, ScheduleOps, WriteCompletion, ClinicalIntel, SearchToday, LabelsSettings, UXCohesion, SafetyRegression, and full Mac checkpoint.

**Baseline:** `929b662` — `feat: elevate clinic app UI and workflow experience`  
**Post-restructure:** clinic workspace UI batch — full-width shell, CSS split, compact status system

**Related guardrails:** [out-of-scope-guardrails.md](./out-of-scope-guardrails.md) · **Windows field test entry:** [FIELD-TEST-START-HERE.md](./FIELD-TEST-START-HERE.md) · **Design spec:** [clinic-workspace-design-spec.md](./clinic-workspace-design-spec.md)

**Tier status:** Mac-side UI restructure is **complete** for operator demo. **Clinic go-live remains BLOCKED** until Tier 3 Windows field execution completes.

---

## Executive summary (post workspace restructure)

| Area | Daily-use ready? | Notes |
| --- | --- | --- |
| **Shell** | Yes | Rail + workspace column; patient in rail; read-only pill; compact status strip |
| **Today** | Yes | Full-width grid; page hero; operations aside consolidated |
| **Patients** | Yes | Search hero empty state; rail patient slot |
| **Profile** | Yes | Page hero; existing hero band + tabs; data-list patterns available |
| **Schedule** | Yes | Full-width; page hero with date range; unified toolbar |
| **Settings** | Yes | Page hero; 2-column card grid preserved |
| **Writes (4 routes)** | Unchanged | Layout refresh via write.css; no new domains |
| **Windows clinic PC** | **Not yet run — deferred** | **Next strategic gate** |

---

## Mac-side ROI assessment

Mac-side UI restructure ROI is **exhausted** after this batch. Further Mac work should be **bugfix-only** unless Windows field execution surfaces new requirements.

---

## Prior audit (clinic workflow completion batch)

| Area | Daily-use ready? | Notes |
| --- | --- | --- |
| **Today** | Yes (connected bridge) | At-a-glance overview rows, backup configured, schedule readiness, selected-patient quick actions |
| **Patients** | Yes | Summary at-a-glance strip, timeline temporal sections + summary bar, patient-switch filter reset, per-tab reload |
| **Schedule** | Yes | Clear filters includes room; operational summary (shown/total, provider/room mix, filter state) |
| **Settings** | Yes | Today cross-link hint, next-action prominence, Windows **Deferred / Not yet run** |
| **Writes (4 routes)** | Sandbox + pilot flag only | Refresh nudge parity on create/move/status; room select; patient pre-fill on create |
| **Windows clinic PC** | **Not yet run — deferred** | **Next strategic gate** |

---

## What this batch completes

- **Patient workspace at-a-glance** — Safe status/count strip below Summary mini-cards (upcoming/recent visit, treatment/chart/ledger counts, screening state)
- **Timeline temporal view** — Upcoming / Recent (30d) / Older sections, summary bar, limitations copy, kind-filter reset on patient switch
- **Timeline count honesty** — Mini-card shows “About N events” until Timeline tab loads exact count
- **Schedule operational summary** — Shown vs total, status mix, provider/room mix, active filter label; clear filters resets room
- **Write parity** — Room `<select>` from schedule rooms, patient context pre-fill, move context panel, `WRITE_REFRESH_NUDGE` on all write routes
- **Medical toolbar parity** — Flagged-count + section count line matching treatments/chart/ledger
- **Search recent CSS** — Styled recent session list mirroring Today dashboard; keyboard roving focus
- **Front desk command center (v2)** — Stat strip + command grid on Today; contextual status resolver; full-width schedule/profile/patients; board/ops panels replace Card soup for stats. Mac UI layout ROI **exhausted** — bugfix-only until Windows field execution.
- **Front desk command center** — Backup row, schedule readiness, open schedule for today / open patient appointments
- **UX cohesion** — Shared filter chip tokens, write form spacing, readonly empty-state hierarchy

---

## Mac-side ROI assessment

Mac-side UI polish ROI is **likely exhausted** after the **clinic UI elevation** batch (`feat: elevate clinic app UI and workflow experience`). Further Mac work should be bugfix-only unless Windows field execution surfaces new requirements.

---

## UX polish (clinic UI elevation batch)

### What now feels professional

- **Shell** — Primary read-only banner + compact secondary status row; sticky selected-patient strip; dev diagnostics behind disclosure
- **Today** — Dominant appointment list with metric chips; merged “Now” aside (next + selected patient); reminders de-emphasized to footnote
- **Patients** — Search-first empty hero; patient hero header with calm chips; summary at-a-glance as metric row
- **Timeline** — Sticky kind filters; metric summary chips; `EmptyState` for range/filter/undated variants; consolidated limitations callout
- **Schedule** — Unified filter bar; operational summary as metric chips; scannable row hierarchy preserved
- **Write panels** — Unified `.app-sandbox-write-zone`; single post-commit nudge; plan labels in copy module
- **Settings** — “Open Today overview” button; readiness strip hierarchy unchanged but clearer cross-link

### Remaining visual rough edges

- Dual search (topbar vs Patients page) not query-synced — intentional
- Collapsible schedule filters on narrow viewports use existing toolbar wrap (no `<details>` yet)
- Some clinical tab filter chips still use button variant instead of explicit `aria-pressed` on every chip

---

## Remaining rough edges

- Dual search (topbar vs Patients page) not query-synced — intentional
- Session recent patients not persisted (`localStorage` deferred)
- Mirror refresh remains manual (no auto import after writes)
- Decoded status/chart/ledger catalogs still blocked pending Windows field log

---

## Intentionally unsupported / read-only / sandbox-only

- Payments, memos, clinical writes, odontogram — per [out-of-scope-guardrails.md](./out-of-scope-guardrails.md)
- Sandbox writes only when pilot flag + bridge capability permit
- No PHI/raw rows in UI surfaces

---

## Next recommended batch

**Tier 3 — Windows field execution:** single clinic PC run per [FIELD-TEST-START-HERE.md](./FIELD-TEST-START-HERE.md) + [qa-runs/TEMPLATE-windows-field-run.md](../qa-runs/TEMPLATE-windows-field-run.md). Optional post-field: decoded status/chart/ledger catalogs **only if** field log confirms safe mappings.

**Mac-side app functionality after this batch:** Near-complete for daily clinic demo on Mac.

**Windows execution status:** **Deferred / Not yet run**.
