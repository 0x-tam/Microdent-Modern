# Product completeness audit — clinic workflow intelligence batch

**Purpose:** Gap report after the **clinic workflow intelligence and polish** batch (Workstreams A–M). Guides the next batch without expanding write scope.

**Reviewed:** `packages/app/src/` after NavRestore, PatientJourney, ScheduleToday, ClinicalLabels, WritePolish, SettingsUI, UICohesion, SafetyRegression, and full Mac checkpoint.

**Baseline:** `68ee401` — `feat: enrich clinic workflows with safe reference context`

**Related guardrails:** [out-of-scope-guardrails.md](./out-of-scope-guardrails.md) · **Windows field test entry:** [FIELD-TEST-START-HERE.md](./FIELD-TEST-START-HERE.md)

**Tier status:** Mac-side read workflows and patient workspace continuity are substantially complete for operator demo. **Clinic go-live remains BLOCKED** until Tier 3 Windows field execution completes per [FIELD-TEST-START-HERE.md](./FIELD-TEST-START-HERE.md).

---

## Executive summary

| Area | Daily-use ready? | Notes |
| --- | --- | --- |
| **Today** | Yes (connected bridge) | Recent patients re-open (session list, max 5), Open schedule with today pre-selected, at-a-glance cards, status mix |
| **Patients** | Yes | Timeline kind filters, Summary↔Timeline connection, appointments status-mix/current/clear-filters, honest legacy labels |
| **Schedule** | Yes | AppShell nav restored (`initialDate`, `onOpenPatient`, `mirrorStatus`); operational summary + clear filters + rooms-in-use |
| **Settings** | Yes | Readiness strip, QA hints, Windows **Deferred / Not yet run** |
| **Writes (4 routes)** | Sandbox + pilot flag only | Demographics doctor `<select>` parity with create flow; refresh nudge after commit |
| **Windows clinic PC** | **Not yet run — deferred** | **Next strategic gate** |

---

## What now feels complete

- **AppShell navigation restore** — `recentPatients`, schedule `initialDate`, profile→schedule and schedule→profile handoff, Today recent re-open
- **Patient journey continuity** — Timeline kind filter chips, Summary mini-card event count, cross-tabs include Timeline, room label parity on timeline appointments
- **Appointments power UX** — Status mix toolbar, current row highlight, clear filters, room display names, this-year cap banner
- **Schedule operational intelligence** — Status/provider clear filters, rooms-in-use count, open patient record label consistency
- **Honest reference labels** — `Legacy … code N (unmapped)` and `Unknown provider/procedure` fallbacks via shared `legacyCodeLabel`
- **Clinical tab toolbars** — Clear filters on treatments, chart, ledger; existing empty-filter states retained
- **Write UX** — Demographics provider select; post-commit refresh nudge copy

---

## Remaining rough edges

- Dual search (topbar vs Patients page) not query-synced — intentional
- Session recent patients not persisted (`localStorage` deferred)
- Mirror refresh remains manual (no auto import after writes)
- Summary Timeline mini-card count is approximate until Timeline tab loaded (appointments + related counts)
- Decoded status/chart/ledger catalogs still blocked pending Windows field log

---

## Intentionally unsupported / read-only / sandbox-only

- Payments, memos, clinical writes, odontogram — per [out-of-scope-guardrails.md](./out-of-scope-guardrails.md)
- Sandbox writes only when pilot flag + bridge capability permit
- No PHI/raw rows in UI surfaces

---

## Next recommended batch

**Tier 3 — Windows field execution:** single clinic PC run per [FIELD-TEST-START-HERE.md](./FIELD-TEST-START-HERE.md) + [qa-runs/TEMPLATE-windows-field-run.md](../qa-runs/TEMPLATE-windows-field-run.md). Optional post-field: decoded status/chart/ledger catalogs **only if** field log confirms safe mappings.

**Mac-side app functionality after this batch:** Substantially complete for daily read workflows + sandbox-gated writes; suitable for operator demo on Mac.

**Windows execution status:** **Deferred / Not yet run**.
