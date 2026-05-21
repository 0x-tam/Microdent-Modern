# Clinic Visual Redesign — Batch Report (Wave 4)

**Date:** 2026-06-03 (browser proof 2026-05-21)  
**Baseline:** `2a6f9a1` — `docs: record visual identity batch commit hash in QA report`  
**Commit target:** `feat: redesign clinic app into modern visual workspace`  
**Node:** v22.22.3  
**Agents:** Wave 0–3 (complete) + **Wave 4 (P+Q+R)**

---

## Root cause of previous weak visual pass

The prior visual-identity batch ([`qa-runs/2026-06-03-visual-identity-batch-report.md`](2026-06-03-visual-identity-batch-report.md)) scoped **color + surface hierarchy only — no layout DOM changes**. Visible impact stayed weak because:

| Root cause | Effect |
| --- | --- |
| Subtle `color-mix` token deltas | Washes barely perceptible on screen |
| ~850 lines of hub CSS in `app-shell.css` | Legacy rules flattened new tokens |
| Today “Clinic at a glance” as `<dl>` rows | Read as text table, not status UI |
| 280px rail + 11–13px chrome | Sidebar felt like admin panel |
| No last-import redesign layer | Page CSS and hub won specificity wars |

**This batch:** structural TSX (metric tiles, status grid, hero bands), `workspace-redesign.css` imported **last**, 300px rail, bolder v2 tokens, and **mandatory browser proof** before commit.

---

## Workstream P — Browser visual proof

**Dev stack:** `pnpm dev:web` @ http://127.0.0.1:5173 + bridge `DATA_ROOT=/Users/Tamam/Desktop/Microdent/Microdent-Legacy-Copy/DATA` @ :17890.

**Screenshots captured (browser MCP):** Today, Patients, Schedule, Settings, Patient Profile (DAOUK ASMA, Summary tab).

| Check | Result |
| --- | --- |
| `.app-hero-band` present (Today, Profile, Settings) | **yes** |
| `.app-metric-tile` / `.app-metric-tile-grid` present | **yes** |
| `.app-status-grid` present (Today clinic glance, Settings uses metric hero) | **yes** |
| Rail width @ 1400px viewport | **~300px** (`--app-rail-w: 300px`; main content starts ~300px from left) |
| Warm workspace canvas vs flat gray admin | **yes** |
| Teal rail brand band + elevated search | **yes** |

**`browser_visibly_changed: true`**

Visible changes by page:

| Page | What users should notice |
| --- | --- |
| **Shell** | Wider teal rail, brand kicker, 48px search, status pills |
| **Today** | Hero band + metric grid always visible; rich empty state; status chips not `<dl>` |
| **Patients** | Elevated search hero card; recent session cards |
| **Schedule** | Date header band, pill filters, card-style empty panel |
| **Profile** | Display-name hero, metric summary tiles, 44px teal pill tabs |
| **Settings** | Five status hero metric tiles + severity-accent section cards |

---

## Workstream Q — Safety regression

- Exported `DOM_FORBIDDEN_FIELD_LABELS` from `read-only-smoke-fixtures.ts`
- Added `\bpaymentAmount\b` guard to `assertNoForbiddenDomTokens`
- New `read-only-smoke-fixtures.test.ts` — blocked labels + leaked mock values + `"before"`/`"after"`
- `app-metric-tile.test.tsx` / `app-status-grid.test.tsx` — forbidden-token asserts on safe copy
- `read-only-flow-smoke.test.tsx` — expects `.app-metric-tile-grid` (replaces `.app-stat-strip`)

**Forbidden tokens guarded:** `COMMENT`, `NOTE`, `DESCRIPT`, `DESC`, `AMOUNT`, `SAMOUNT`, `TELEPHONE`, `PAT_NAME`, `rawRow`, `before`, `after`, `address`, `email`, `insurance`, `medicalText`, `paymentAmount`

---

## Workstream R — Checkpoint results

| Gate | Result | Notes |
| --- | --- | --- |
| `pnpm test` | **PASS** | 447 app tests + workspaces |
| `pnpm test:pilot-artifacts` | **PASS** | 13 tests |
| `pnpm build:web` | **PASS** | |
| `pnpm --filter @microdent/bridge run build` | **PASS** | |
| `pnpm --filter @microdent/desktop run build` | **PASS** | |
| `pnpm --filter @microdent/desktop run test` | **PASS** | 67 tests |
| `pnpm --filter @microdent/desktop run release-smoke` | **PASS** | |
| `pnpm stage:pilot-release` | **PASS** | |
| `pnpm pilot:verify-release` | **PASS** | |
| `pnpm pilot:verify-manifest` | **PASS** | |
| `pnpm qa:sandbox` | **PASS** | After stopping stale dev bridge on :17890 |
| `pnpm pilot:mac-release-status` | **INFO** | Tier 3 deferred; signoff not required for visual batch |
| **Browser visibly changed (5 pages)** | **PASS** | Gate 18 |
| Unsafe files in commit scope | **PASS** | No `.env`, credentials, or Legacy paths staged |

**Environmental note:** Stale `dev:bridge` on port 17890 caused first `qa:sandbox` write-capability timeout; resolved by freeing the port.

---

## CSS / components changed for visible impact

- `packages/app/src/styles/workspace-redesign.css` (new, last import)
- `packages/app/src/styles/shell-layout.css` — `--app-rail-w: 300px`
- `packages/app/src/app-metric-tile.tsx`, `app-status-grid.tsx`
- Page TSX: `today-dashboard`, `PatientProfilePanel`, `SchedulePanel`, `SettingsPanel`, `AppShell`, write panels
- `packages/ui/src/tokens.css`, `components.css`
- `docs/visual-qa-checklist.md` — v2 criteria + `browser_visibly_changed`

---

## Commit

**Commit hash:** `3a16588cb7c58939dadedec7285442e7a10be68a`  
**Message:** `feat: redesign clinic app into modern visual workspace`

**Windows execution:** Deferred / Not yet run
