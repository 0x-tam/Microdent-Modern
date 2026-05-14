# Microdent Modern — Master Build Plan

**Purpose:** Single practical implementation plan combining the legacy system map, technical architecture, UI/UX redesign, and design system. This document is the execution spine for humans and Cursor agents.

**Sources:** `docs/legacy-system-map.md`, `docs/architecture-plan.md`, `docs/ui-redesign-plan.md`, `docs/design-system.md`

**Status:** Planning only — no application build implied until phases start.

---

## 1. Vision (one paragraph)

Ship a **modern desktop clinic app** (React + TypeScript + Tailwind) that sits **beside** legacy Microdent: **Phase 1 is read-only** access to FoxPro/VFP **DBF** data via a local **bridge** process. The UI follows the product shell and modules in the UI plan, styled with the documented tokens and patterns. Later phases add import/mirror, modern storage, and writes — only with backups, audit, flags, and dry-run as specified in the architecture plan.

---

## 2. Final architecture

### 2.1 Logical architecture

| Layer | Responsibility |
|-------|----------------|
| **Desktop shell** | Tauri (preferred) or Electron: window chrome, spawns/supervises bridge on loopback, injects `BRIDGE_BASE_URL` (and optional auth token path) into the renderer. |
| **React app** | Routes, TanStack Query, feature modules; **never** opens DBF files directly. |
| **Bridge (local service)** | **Only** component that reads DBF under a configured `DATA_ROOT`. HTTP `GET` only in Phase 1; path sandbox; encoding handling; structured logging without full-row PHI. |
| **Shared contracts** | Zod schemas + TypeScript types for API DTOs — single source of truth for UI and bridge. |
| **UI kit** | Presentational components (tokens, tables, buttons, layout primitives) aligned with `docs/design-system.md`. |
| **Legacy data** | Visual FoxPro-era files: `.DBF` + `.CDX` + `.FPT` + `.DBC` triplets; authoritative semantics from legacy app + `schedule_replacement.py` where documented. |

### 2.2 Phase alignment (technical)

| Phase | Data | Bridge | UI |
|-------|------|--------|-----|
| **1 — Read DBF** | User points `DATA_ROOT` at a copy or read-only share of `DATA/` | `GET` only; localhost bind; rate limits; optional token | Browse/inspect: tables, pagination, schema; global shell + read-only banners |
| **2 — Import / mirror** | ETL DBF → SQLite or Postgres | Ingestion jobs; idempotency fields | Same or richer queries against modern DB |
| **3 — UI on modern DB** | DBF = ingestion source only | Read from SQLite/Postgres | Full module depth per UI plan |
| **4 — Writes** | Modern DB first; legacy DBF writes only if unavoidable | Backups, audit JSONL, feature flags, dry-run | Mutations behind permissions + audit |

### 2.3 Domain priority (from legacy map + safe rebuild order)

Order mirrors risk and dependency: **immutable snapshot → catalog → reference tables → patients/phones → schedule → chart → procedures/plans → ledger/payments → ancillary.**

Core entities: `PATIENT`, `PAT1`, `_patshet`, `PHONETAB`/`PHN_TEL`, `SCHEDULE` (+ `SC_ROOM`, `DICSCHED`), `CHARTDBF`/`CHARTFLG`, `OPERTBL`, `TRETPLAN`, `TRANS`/`_transto`, `IDS` (singleton counters), procedure dictionaries (`PROCINIT`, etc.).

---

## 3. Final folder structure

Target **pnpm/npm workspace** monorepo (adjust package manager in root `package.json` when scaffolded). If the repo already contains legacy `DATA/` or installer artifacts, **do not** assume they are the development `DATA_ROOT`; operators configure an external copy per safety rules.

```text
Microdent-Modern/
├── apps/
│   ├── desktop/                 # Tauri (recommended) or Electron shell
│   │   ├── src/                 # Rust (Tauri) or main/preload (Electron)
│   │   └── ...
│   └── web/                     # Optional: Vite dev shell for React without desktop
│       └── ...
├── packages/
│   ├── ui/                      # Design-system-aligned React + Tailwind components
│   ├── app/                     # Routes, TanStack Query hooks, feature modules
│   ├── bridge-client/           # Typed HTTP client for bridge API
│   └── contracts/               # Zod + shared DTO types for bridge API
├── services/
│   └── bridge/
│       ├── src/
│       │   ├── index.ts         # HTTP bootstrap
│       │   ├── config.ts        # DATA_ROOT, log level, bind, encoding defaults
│       │   ├── dbf/             # Table registry, readers, codecs
│       │   ├── routes/          # One file per resource group
│       │   └── safety/          # Path traversal checks, read-only enforcement
│       └── package.json
├── scripts/                     # e.g. start bridge + web/desktop together
├── docs/
│   ├── master-build-plan.md     # This file
│   ├── architecture-plan.md
│   ├── legacy-system-map.md
│   ├── ui-redesign-plan.md
│   └── design-system.md
├── package.json                 # Workspace root
└── pnpm-workspace.yaml          # Or equivalent
```

**Design tokens:** Implement as CSS variables or Tailwind theme extension in `packages/ui` (semantic names from `docs/design-system.md`, not raw hex in components).

---

## 4. Build phases (practical)

### Phase 0 — Preconditions (no app code)

- Immutable **bit-for-bit** archive of production `DATA` (all `.DBF`, `.CDX`, `.FPT`, `.DBC`, `.DCT`, `.DCX`) with checksum manifest; stored **outside** daily working trees.
- Legal/ops agreement: **no dual-write** to legacy DBFs from two apps; copy-first or maintenance window for reads if legacy FoxPro is running.
- Record open decisions: Tauri vs Electron; live folder vs copy-only; default encoding strategy.

### Phase 1A — Foundation

- Monorepo scaffold, `packages/contracts`, `services/bridge` with `GET /health`.
- Path sandbox + read-only file open for DBF stack; **no** write APIs.
- Table registry: logical id → filename, encoding override per table if needed.
- CI: unit tests (sandbox, pagination), integration test (bridge + fixture DBF), contract tests (Zod round-trip).

### Phase 1B — First vertical slice

- One **low-risk reference or small** table end-to-end: `GET /v1/meta/tables`, `GET /v1/tables/:id/schema`, `GET /v1/tables/:id/rows` with cap (e.g. max 100), cursor/offset documented.
- `apps/web` or minimal desktop loading React; TanStack Query wired to `bridge-client`.
- UI: data browser page — sticky read-only banner, error boundary, bridge-down empty state.

### Phase 1C — Shell + design system baseline

- App shell per UI plan: top bar (title, search placeholder, user menu stub), collapsible left rail (module labels match future modules), main canvas padding per design system.
- Tokens: neutrals, primary teal, semantic status colors; typography and spacing scale; one outline icon set (e.g. Lucide).
- **Patients** list: read-only table with disambiguation columns when wired to `PATIENT` / `PAT1` (DOB, phone fragment, provider if available).

### Phase 1D — Schedule read model

- Bridge routes for `SCHEDULE`, `SC_ROOM`, optional `DICSCHED` labels; validate status codes and field semantics against `schedule_replacement.py` / legacy map.
- UI: week-oriented read-only schedule grid (full-bleed layout); status colors per design system §11; no drag-write until Phase 4.

### Phase 1E — Deeper read modules (incremental)

- Patient profile **read-only** tabs (placeholders where data not mapped).
- Treatment history / ledger **read-only** from `OPERTBL` / `TRANS` when schemas stable.
- Chart: **read-only** tooth grid decoding `CHARTDBF` (hardest domain — dedicated tasks).

### Phase 2+ — As architecture plan

- ETL to SQLite/Postgres; UI reads modern DB; writes with backup + audit + flags + dry-run.

---

## 5. Exact first coding task

**Task:** Create the monorepo workspace skeleton **without** connecting to real patient data:

1. Root `package.json` + workspace config (`pnpm-workspace.yaml` or npm workspaces).
2. `packages/contracts` with Zod schema for `GET /health` response: `{ ok: boolean, version: string }`.
3. `services/bridge` minimal Express (or Fastify) server listening on `127.0.0.1:17890` (or configurable) implementing **only** `GET /health` returning JSON matching the contract; **no** DBF reads yet.
4. One automated test: start server on random port, assert `200` and body passes Zod parse.

**Done when:** `pnpm test` (or npm) passes in CI-local command; no `DATA_ROOT` required for this task.

**Next task after that:** Add `config.ts` + path sandbox unit tests + table registry JSON with **one synthetic tiny `.dbf` fixture** in repo (generated or minimal binary) and `GET /v1/tables/:tableId/rows` for that fixture only.

---

## 6. Safety rules (immutable in Phase 1)

1. **No writes:** No `fs.writeFile`, `appendFile`, `unlink`, or DBF mutation APIs in bridge or UI for legacy files. Bridge exposes **GET** (and optional **HEAD**) only for Phase 1.
2. **Single data root:** Resolve all logical tables under configured `DATA_ROOT`; reject `..`, alternate roots, and symlink escape (policy per OS).
3. **Read-only opens:** OS/library read-only flags for DBF files where supported.
4. **Localhost only** in production builds; optional shared-secret header on every request.
5. **Rate limiting:** Simple in-memory limit per client to prevent accidental load loops.
6. **Logging:** Never log full row contents for tables that may hold PHI; log paths, latencies, row counts, error codes.
7. **Legacy coexistence:** Document: reading **live** files while FoxPro holds locks risks errors or torn reads — **copy-first** strongly recommended for development and pilot.
8. **No legacy EXEs in automation:** Do not script-run `PACK.EXE`, `REINDEX.EXE`, `UPGRADE.EXE`, or scheduler installers against production data.

---

## 7. What not to touch

| Area | Rule |
|------|------|
| **Microdent-Legacy tree** (if separate clone) | **Read-only** for analysis; no edits, no commits inside that repo for Modern work. |
| **Production `DATA` / authoritative DBF set** | No direct development; use verified duplicate + checksum manifest. |
| **DBF + sidecars** | Never copy or backup **only** `.DBF` without paired `.CDX` / `.FPT` / DBC triplets where applicable. |
| **`IDS.DBF`** | Do not “fix” or hand-edit counters without DBA-level process; migration tools must preserve allocation integrity. |
| **Suspect / unparsed DBFs** | Do not assume valid FoxPro DBF for: `ADDRESS.DBF`, `ADJUST.DBF`, `BMONTH.DBF`, `CHARTST.DBF`, `DR_B0.DBF`, `DR_E5.DBF`, `DR_R0.DBF`, `ECF5B.DBF` — investigate on a **copy** before parser investment. |
| **Licensing / NETSENT4** | Do not bypass or duplicate HASP/network license behavior; parallel instances may violate license or fight for exclusive opens. |
| **UI scope creep** | Do not implement write flows, payment posting, or e-sign in Phase 1; use placeholders and disabled actions per UI plan “Phase 1 read-only” callouts. |
| **Design** | No raw hex scattered in components; no neon/marketing-dashboard tropes; no pure `#000` on `#fff` blocks for long prose. |

---

## 8. Risk checklist (pre-flight and ongoing)

Use before each milestone that touches data or distribution.

### Data integrity

- [ ] Working from a **duplicate** of `DATA`, not the sole backup.
- [ ] Checksum manifest recorded for the snapshot in use.
- [ ] Memo/index files present and paired for every table under test.
- [ ] `IDS.DBF` and singleton semantics understood before any future write/import.
- [ ] Unparsed DBF list treated as **out of scope** until manually validated.

### Security & compliance

- [ ] PHI not in git, logs, fixtures, or screenshots in tickets.
- [ ] Bridge not bound to `0.0.0.0` in shipped builds.
- [ ] Token/auth story documented if bridge port is discoverable.

### Technical

- [ ] Encoding (e.g. Windows-1252) tested on French/Arabic field samples **on a copy**.
- [ ] Pagination caps enforced; no unbounded “export all rows” from UI by accident.
- [ ] Chart/tooth/surface decoding reviewed with clinical SME before showing patient-facing chart.

### Product / ops

- [ ] Operators know whether they are on **live** or **copy** data (banner in UI).
- [ ] Cutover / dual-write explicitly **out of scope** until Phase 4 design is signed off.

---

## 9. Cursor agent task breakdown

Tasks are **sequential bands**; each band can be one or more PRs. Agents should not skip safety prerequisites.

| Band | Agent focus | Deliverable |
|------|-------------|-------------|
| **A0** | Docs + repo hygiene | Confirm `docs/master-build-plan.md` is linked from `README.md` when README exists; no PHI in repo. |
| **A1** | Workspace + contracts + health | Monorepo scaffold, Zod contracts, bridge `/health`, first test. |
| **A2** | Safety module | `DATA_ROOT` resolution, traversal rejection tests, read-only open helpers. |
| **A3** | DBF read path | Parser dependency chosen; table registry; one fixture table + `rows` + `schema` routes + tests. |
| **A4** | `bridge-client` + TanStack Query | Typed client, error shape handling, React Query defaults. |
| **A5** | `packages/ui` tokens | Tailwind/CSS variables mapping design system §2–4; Button, Card, Table primitives. |
| **A6** | `packages/app` shell | Top bar, sidebar, outlet region; read-only global banner; error boundary. |
| **A7** | Patients browse | Registry entries for `PATIENT` (and `PAT1` if needed for list); list + detail drawer; masked sensitive fields per policy. |
| **A8** | Schedule read | `SCHEDULE` + `SC_ROOM` routes; read-only week grid; status legend per design system. |
| **A9** | Deeper read models | `TRANS`, `OPERTBL`, `TRETPLAN` read routes in dependency order; read-only ledger view. |
| **A10** | Chart read-only | `CHARTDBF` decoding spike → grid UI; accessibility patterns + non-color-only encodings. |
| **A11** | Desktop packaging | Tauri/Electron wraps web build, spawns bridge, passes env; Windows smoke doc. |
| **A12** | Phase 2 spike (optional) | SQLite import skeleton **read-only** from imported DB — no legacy writes. |

**Agent discipline:** Small PRs, one table or one route per task when possible; always update contracts + tests with API changes; run tests locally before handoff.

---

## 10. UI and design alignment (execution reminders)

- **Information architecture** follows `docs/ui-redesign-plan.md` module list (Dashboard, Patients, Schedule, Chart, Plans, Payments, History, Reports, Settings). Phase 1 may **hide** modules whose backend is missing rather than showing empty shells without explanation.
- **Visual implementation** follows `docs/design-system.md`: semantic tokens, 4 px grid, sidebar ~240–280 px, top bar 56 px, scheduler colors §11, chart tooth tiles §12.
- **Accessibility:** WCAG 2.2 AA target; chart states need non-color encodings; focus rings always visible.

---

## 11. Definition of done (Phase 1)

- Bridge + UI run on Windows x64 against a **configured copy** of `DATA`.
- No write endpoints; no PHI in logs or repo.
- At minimum: health, table list, schema, paginated rows for **patients** and **schedule** reference tables.
- Read-only banner and bridge-down UX visible.
- CI green on unit + integration + contract tests.

---

*Document version: 1.0 — 2026-05-14. Amend when Phase 1 scope or shell choice is finalized.*
