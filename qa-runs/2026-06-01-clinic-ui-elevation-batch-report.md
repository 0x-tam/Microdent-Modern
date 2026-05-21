# Clinic UI elevation batch report — 2026-06-01

**Baseline:** `5a46479` — `feat: advance clinic app toward full workflow completion`  
**Batch:** Workstreams A–Q (clinic app UI/UX elevation)  
**Windows execution:** **Deferred / Not yet run**

---

## UX improvements by page

| Page | Changes |
| --- | --- |
| **Shell** | Banner tier: primary read-only + compact secondary status row; sticky selected-patient bar; dev diagnostics in `<details>`; `.app-page-header` main head; sidebar hint shortened + Settings link |
| **Today** | Metric row on primary list (count, status mix, mirror label, schedule readiness); merged **Now** card (next + selected patient); clinic overview compact; reminders → footnote; `EmptyState` on next-empty |
| **Patients / Search** | Search-first empty hero preserved; phone mask removed from result rows; stronger focus-within styling via shared tokens; `.app-recent-list` alignment |
| **Profile** | `.app-patient-hero` header chips; summary at-a-glance → `.app-metric-row`; tab arrow-key navigation; hidden-fields → `.app-info-callout` |
| **Timeline** | Sticky filter bar; metric summary chips; consolidated limitations callout; `EmptyState` for range/filter/undated |
| **Schedule** | `.app-filter-bar` toolbar; operational summary as metric chips; sandbox write zone styling preserved |
| **Write panels** | Unified `.app-sandbox-write-zone`; single `WRITE_POST_COMMIT_COMBINED_NUDGE`; plan labels in copy module; duplicate refresh nudges removed |
| **Settings** | **Open Today overview** button; readiness strip hierarchy unchanged |

---

## Design system changes

- **New doc:** `docs/clinic-ui-design-direction.md`
- **Tokens promoted:** `--ui-bg-muted`, `--ui-bg-surface-raised`, `--ui-border-warning`, `--ui-bg-warning-subtle`, `--ui-border-danger`, `--ui-bg-danger-subtle`
- **App patterns:** `.app-page-header`, `.app-metric-row`, `.app-filter-bar`, `.app-recent-list`, `.app-sandbox-write-zone`, `.app-info-callout`, `.app-patient-hero`, `.app-patient-context-bar`
- **Typography:** `--app-text-title` added alongside existing `--app-text-lede` / `--app-text-meta`

---

## Accessibility changes

- Profile tablist: Arrow Left/Right roving focus + `tabIndex`
- Write action tablist: same keyboard pattern
- Timeline / schedule filter chips: existing `aria-pressed` preserved; schedule granularity chips unchanged
- Sticky patient context: `role="status"` with labelled chip

---

## Checkpoint results (Node 22)

| Gate | Result |
| --- | --- |
| `pnpm test` | PASS |
| `pnpm test:pilot-artifacts` | PASS |
| `pnpm build:web` | PASS |
| `pnpm --filter @microdent/bridge run build` | PASS |
| `pnpm --filter @microdent/desktop run build` | PASS |
| `pnpm --filter @microdent/desktop run test` | PASS |
| `pnpm --filter @microdent/desktop run release-smoke` | PASS |
| `pnpm stage:pilot-release` | PASS |
| `pnpm pilot:verify-release` | PASS |
| `pnpm pilot:verify-manifest` | PASS |
| `pnpm qa:sandbox` (explicit env) | PASS — 4 workflows |
| `pnpm pilot:mac-release-status` | Tier 3 Deferred |

---

## Commit

See git log for hash after auto-commit: `feat: elevate clinic app UI and workflow experience`

**Commit hash:** `bb11ae2`

---

## Unsafe files (not staged)

Per git hygiene protocol, these were **not** added:

- `packages/.DS_Store`
- `packages/app/dist/**` (build artifacts)
- `packages/app/node_modules/**`

---

## UX risks

- Mirror stale detail text no longer in a dedicated aside card (label-only metric chip); advisory still shows in primary column when stale
- Selected patient context moved from main head to sticky bar — may affect muscle memory
- Phone mask removed from search results (privacy-positive; operators use chart/record id)

---

## Next batch

**Tier 3 — Windows field execution** per `docs/FIELD-TEST-START-HERE.md`. Mac-side UI ROI exhausted for polish; remaining work is field-gated.

---

## Mac status

- **Mac-side app:** Near-complete + professionally polished for demo
- **Windows execution:** **Deferred / Not yet run**
- **Clinic go-live:** **BLOCKED** until Tier 3
