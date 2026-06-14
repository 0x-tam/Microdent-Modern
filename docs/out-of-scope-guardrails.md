# Out-of-scope guardrails — clinic MVP

**Purpose:** Prevent accidental expansion into dangerous legacy write domains during the Windows clinic MVP batch.

**Related:** [phase-3-write-safe-qa-checklist.md](./phase-3-write-safe-qa-checklist.md), [phase-6-windows-mvp-operator-guide.md](./phase-6-windows-mvp-operator-guide.md), bridge `write-route-inventory.test.ts`.

---

## Never write (product)

| Domain | Examples | Status |
| --- | --- | --- |
| Payments / ledger | `AMOUNT`, `SAMOUNT`, ledger lines, balances | **Out of scope** |
| Treatment / procedures | treatment memos, fee lines | **Out of scope** |
| Chart / odontogram | chart notes, tooth labels | **Out of scope** |
| Medical summary | allergies, clinical notes | **Out of scope** |
| Memos / comments | `COMMENT`, `NOTE`, `DESCRIPT`, free-text fields | **Out of scope** on all pilot routes |

## Allowed sandbox workflows (only four)

1. `appointment.statusUpdate` — numeric status on `SCHEDULE.DBF`
2. `appointment.timeMove` — date/time/room on `SCHEDULE.DBF`
3. `appointment.create` — new schedule row
4. `patient.demographics.update` — allowlisted name fields on `PATIENT.DBF`

## Path guardrails

| Path | Rule |
| --- | --- |
| `Microdent-Legacy` | **Never** set `DATA_ROOT` here |
| `Microdent-Legacy-Copy` | Read-only source for mirror import only |
| `Microdent-Write-Sandbox` | Only disposable tree for commits |

## API guardrails

- `services/bridge/src/routes/v1.ts` exposes **exactly four** `router.patch` / `router.post` write handlers (inventory test).
- Schedule time-move and create routes call `findBlockedScheduleBodyKeys` — `COMMENT`, `PAT_NAME`, `TELEPHONE`, `CASENUM` return `BLOCKED_SCHEDULE_FIELD`.
- Other out-of-scope keys (`NOTE`, `DESCRIPT`, `DESC`, `AMOUNT`, `SAMOUNT`, etc.) are rejected by **strict** Zod bodies as `INVALID_REQUEST_BODY`.
- Mirror SQLite is a **snapshot** — commits do not refresh mirror tables; DBF readback is the write proof.

## QA guardrails

- `pnpm qa:sandbox` proves writes via **DBF readback**, not mirror row queries.
- Logs and docs: HTTP status, workflow, `operationId`, hash prefixes, backup basenames — no PHI or raw row bodies.

## Log sweep (pilot RC batch)

Spot-checked desktop, bridge CLI, and `scripts/qa-sandbox*.sh` — logs use workflow names, HTTP status, `operationId`, and hash prefixes only. No raw DBF row bodies or patient identifiers in scripted output.

---

## Pilot RC checklist (2026-05)

Before treating a build as **Windows pilot RC**:

- [ ] `pnpm --filter @microdent/desktop run release-smoke` passes
- [ ] Desktop setup saves paths with `writeMode: disabled`; supervisor spawns Node `server.js` only
- [ ] Settings **Pilot readiness** answers “safe to use?” without source access
- [ ] Mirror import via CLI only — no in-app shell exec
- [ ] `pnpm qa:sandbox` exit 0 with DBF readback for four workflows
- [ ] Route inventory test: four PATCH/POST handlers; no DELETE/PUT write routes
- [ ] Forbidden-token tests pass on touched UI (Settings, clinic read surfaces)
- [ ] No `Microdent-Legacy` or production paths in `DATA_ROOT`
- [ ] Docs: [windows-pilot-runbook.md](./windows-pilot-runbook.md), [phase-7-sandbox-pilot-qa-runbook.md](./phase-7-sandbox-pilot-qa-runbook.md), [pilot-tester-guide.md](./pilot-tester-guide.md)

**Related pilot docs:** [phase-5-operator-qa-runbook.md](./phase-5-operator-qa-runbook.md), [phase-6-windows-mvp-operator-guide.md](./phase-6-windows-mvp-operator-guide.md), [windows-pilot-packaging-gap-report.md](./windows-pilot-packaging-gap-report.md), [PILOT-START-HERE.md](./PILOT-START-HERE.md).

---

## Pilot handoff sign-off (operator + dev)

Complete before handing a build to clinic staff. Both parties initial the printed copy or ticket comment.

### Operator sign-off

| # | Item | Pass |
| --- | --- | --- |
| O1 | Read [PILOT-START-HERE.md](./PILOT-START-HERE.md) and [windows-pilot-runbook.md](./windows-pilot-runbook.md) | ☐ |
| O2 | Desktop first-run setup saved sandbox paths; **never** live `Microdent-Legacy` as `DATA_ROOT` | ☐ |
| O3 | Settings **Pilot readiness** strip + checklist reviewed — bridge connected, mirror status understood | ☐ |
| O4 | Mirror import run from CLI; Settings mirror table shows import runs | ☐ |
| O5 | Read-only smoke: Today, Patients, Schedule, Profile tabs load without errors | ☐ |
| O6 | (If writes enabled) `BACKUP_DIR` configured; only four sandbox workflows used | ☐ |
| O7 | (If sandbox pilot) `pnpm qa:sandbox` exit 0 or phase-7 manual steps documented | ☐ |
| O8 | Understands unsupported domains (payments, ledger, chart, memos) — this doc | ☐ |

### Developer sign-off

| # | Item | Pass |
| --- | --- | --- |
| D1 | `pnpm pilot-checkpoint` passes on handoff machine (or full checkpoint with sandbox env) | ☐ |
| D2 | `write-route-inventory.test.ts` green — exactly four PATCH/POST write routes; no DELETE/PUT | ☐ |
| D3 | Forbidden-token tests pass on Settings checklist and clinic read surfaces | ☐ |
| D4 | `release-smoke` verifies desktop dist, bridge dist reference, and `apps/web/dist/index.html` | ☐ |
| D5 | No `Microdent-Legacy`, `.sqlite`, or sandbox DATA committed to git | ☐ |
| D6 | [windows-pilot-pre-installer-checklist.md](./windows-pilot-pre-installer-checklist.md) shared with IT | ☐ |
| D7 | Packaging gaps documented — no false promise of installer/signing | ☐ |
| D8 | `pnpm stage:pilot-release` + `pnpm pilot:verify-release` pass — no `.dbf`/`.sqlite`/Legacy in staged tree | ☐ |

---

## Pilot package sign-off (staged release)

Complete when handing a **staged** `dist/pilot-release/` folder (not raw git clone) to IT.

| # | Item | Pass |
| --- | --- | --- |
| P1 | [windows-pilot-release-layout.md](./windows-pilot-release-layout.md) reviewed — shipped vs operator DATA | ☐ |
| P2 | `pnpm stage:pilot-release` after full build chain | ☐ |
| P3 | `pnpm pilot:verify-release` — layout + supervisor guards | ☐ |
| P4 | Staged tree scan: no `SCHEDULE.DBF`, `.sqlite`, `Microdent-Legacy`, or `Write-Sandbox` paths | ☐ |
| P5 | [pilot-acceptance-checklist.md](./pilot-acceptance-checklist.md) for operator IT sign-off | ☐ |
| P6 | Real Windows machine test still required — [windows-dev-dry-run.md](./windows-dev-dry-run.md) is dev-only | ☐ |

---

## Distribution RC sign-off (Windows pilot handoff)

Complete before IT receives a **distribution RC** build (staged tree + docs, not raw git clone). Developer initials each row after the matching command passes.

| # | Gate | Command / artifact | Pass |
| --- | --- | --- | --- |
| R1 | Full test suite green | `pnpm test` (or `pnpm pilot:full-checkpoint` when sandbox env is available) | ☐ |
| R2 | Web + bridge + desktop builds | `pnpm build:web`; bridge `pnpm build`; desktop build per [PILOT-START-HERE.md](./PILOT-START-HERE.md) | ☐ |
| R3 | Staged pilot tree | `pnpm stage:pilot-release` → `dist/pilot-release/MicrodentModern/` | ☐ |
| R4 | Staged tree verification | `pnpm pilot:verify-release` — layout, supervisor argv, no runtime data | ☐ |
| R5 | Release smoke (staged) | `PILOT_STAGED_RELEASE=1 pnpm --filter @microdent/desktop run release-smoke` | ☐ |
| R6 | Write route inventory | `pnpm --filter @microdent/bridge test src/write-safety/write-route-inventory.test.ts` | ☐ |
| R7 | Write-safety band | `pnpm --filter @microdent/bridge test src/write-safety/` | ☐ |
| R8 | Forbidden UI tokens | App vitest on Settings + read surfaces (`assertNoForbiddenDomTokens`) | ☐ |
| R9 | Scope doc reviewed with IT | This file + [pilot-acceptance-checklist.md](./pilot-acceptance-checklist.md) | ☐ |
| R10 | Real Windows validation still required | [windows-dev-dry-run.md](./windows-dev-dry-run.md) is dev-only; clinic machine for acceptance | ☐ |

**Blocked body keys (inventory + UI tests):** `COMMENT`, `NOTE`, `DESCRIPT`, `DESC`, `AMOUNT`, `SAMOUNT`, `TELEPHONE`, `PAT_NAME` — never accepted on pilot write routes or rendered in operator UI.

---

## Release package sign-off (manifest + artifact gates)

Complete before IT receives a **release package** build with cryptographic manifest verification (staged `dist/pilot-release/MicrodentModern/` + `RELEASE-MANIFEST.json`, not raw git clone). Developer initials each row after the matching command passes.

| # | Gate | Command / artifact | Pass |
| --- | --- | --- | --- |
| S1 | Full test suite green | `pnpm test` | ☐ |
| S2 | Web + bridge + desktop builds | `pnpm build:web`; bridge `pnpm build`; desktop build per [PILOT-START-HERE.md](./PILOT-START-HERE.md) | ☐ |
| S3 | Staged pilot tree | `pnpm stage:pilot-release` → `dist/pilot-release/MicrodentModern/` | ☐ |
| S4 | Staged layout verification | `pnpm pilot:verify-release` — layout, supervisor argv, no runtime data | ☐ |
| S5 | Manifest hash verification | `pnpm pilot:verify-manifest` — every staged file matches `RELEASE-MANIFEST.json` | ☐ |
| S6 | Artifact safety tests | `pnpm test:pilot-artifacts` — forbidden extensions, tokens, tamper fixtures | ☐ |
| S7 | Release smoke (staged) | `PILOT_STAGED_RELEASE=1 pnpm --filter @microdent/desktop run release-smoke` | ☐ |
| S8 | Write route inventory | `pnpm --filter @microdent/bridge test src/write-safety/write-route-inventory.test.ts` | ☐ |
| S9 | Write-safety band | `pnpm --filter @microdent/bridge test src/write-safety/` | ☐ |
| S10 | Strict release signoff (sandbox required) | `pnpm pilot:release-signoff` — fails if `DATA_ROOT`/`SQLITE_PATH` missing or sandbox QA not green | ☐ |
| S11 | Scope doc reviewed with IT | This file + [pilot-acceptance-checklist.md](./pilot-acceptance-checklist.md) | ☐ |
| S12 | Real Windows validation still required | [windows-pilot-real-machine-checklist.md](./windows-pilot-real-machine-checklist.md); dev dry-run is not clinic acceptance | ☐ |

**Inventory body keys (never on pilot writes):** `rawRow`, `before`, `after`, plus payment/ledger/treatment/chart/medical/memo domain keys and camelCase PHI/payment keys (`address`, `email`, `insurance`, `medicalText`, `paymentAmount`) — enforced in `write-route-inventory.test.ts`.

---

## Artifact token-scan allowed examples

`pnpm test:pilot-artifacts` and `pnpm pilot:verify-release` scan staged trees via [`scripts/pilot-release-artifact-rules.mjs`](../scripts/pilot-release-artifact-rules.mjs). **Docs and config-templates** may mention guardrail table names (`PAT_NAME`, `TELEPHONE`) and Windows **placeholder** paths. **Compiled trees** (`app/`, `bridge/`, `web/`) must not embed developer machine paths.

| Context | Allowed | Forbidden in compiled output |
| --- | --- | --- |
| Desktop config convention | `%AppData%\Microdent\` | Concrete `C:\Users\…\AppData\…` paths |
| Config templates (staged) | `C:\ClinicData\…`, `C:\Users\Public\MicrodentModern\…` | `/Users/…`, `/home/…`, repo checkout paths, `Microdent-Legacy`, `Microdent-Write-Sandbox` |
| Temp / env | — | `~/`, `/tmp/`, `\Temp\`, `TMP=`, `TEMP=`, `process.env.TMP` / `TEMP` |
| Logs placeholder | `logs/README.txt` only | Non-empty `logs/*.log` |

Manifest JSON must not contain forbidden tokens listed in `FORBIDDEN_MANIFEST_STRINGS` (see artifact-rules module).

---

## Clinic pilot sign-off (portable handoff batch)

Complete before clinic staff receive a **staged** `MicrodentModern/` folder. Developer initials each row after the gate passes; operator rows are for the field lead.

| # | Gate | Artifact / command | Pass |
| --- | --- | --- | --- |
| C1 | First-click handoff | Staged package root **`PILOT-START-HERE.md`** (not only under `docs/`) points to [PILOT-HANDOFF-PACK.md](./PILOT-HANDOFF-PACK.md) | ☐ |
| C2 | Manifest scope lock | `RELEASE-MANIFEST.json` includes **`unsupportedFeatures[]`** (payments, ledger writes, chart writes, in-app mirror import, installer) — no clinic PHI | ☐ |
| C3 | Staged tree integrity | `pnpm pilot:verify-release` and `pnpm pilot:verify-manifest` exit 0 | ☐ |
| C4 | Write route inventory | `pnpm --filter @microdent/bridge test src/write-safety/write-route-inventory.test.ts` — four routes; blocked body keys above | ☐ |
| C5 | Strict release signoff | `pnpm pilot:release-signoff` prints **`PILOT RELEASE SIGNOFF: READY`** (not `BLOCKED`) with sandbox QA green | ☐ |
| C6 | Package verification evidence | [windows-package-verify-evidence.md](./windows-package-verify-evidence.md) filed and validated with `pnpm pilot:package-verify-evidence` before operator field steps | ☐ |
| C7 | Real Windows field test | [windows-pilot-real-machine-checklist.md](./windows-pilot-real-machine-checklist.md) executed on a clinic PC, with field JSON referencing package proof through `packageVerification.evidencePath` — dev macOS checkpoint is not clinic acceptance | ☐ |

**Clinic production readiness:** Tier 1 portable sandbox handoff may be **READY** per C5; **clinic go-live** and **clinic production** (live legacy writes, payments, chart edits) remain **BLOCKED** until tier 3 (C6-C7) shows package verification evidence, completed Windows field evidence referencing that package proof with `packageVerification.evidencePath`, and go/no-go GO — Mac signoff alone is **not** clinic go-live ready.

---

## Mac-first sign-off (build machine — tiers 1–2 only)

Complete on the **Mac build machine** before zipping `MicrodentModern/` for IT. These rows prove **Mac-side release readiness** and **Windows-test readiness** only — **not** clinic go-live.

| # | Gate | Pass |
| --- | --- | --- |
| MF1 | **Tier 1:** `pnpm pilot:release-signoff` prints **`PILOT RELEASE SIGNOFF: READY`** (or distribution checkpoint + verify when sandbox env set) | ☐ |
| MF2 | **Tier 2:** Staged tree includes field pack docs — `FIELD-TEST-START-HERE.md`, execution script, result form, go/no-go, verify-on-Windows | ☐ |
| MF3 | `pnpm pilot:verify-release` + `pnpm pilot:verify-manifest` exit 0 on staged tree | ☐ |
| MF4 | **Tier 3 status documented:** batch reports and Mac-only QA logs state **Windows execution: Deferred / Not yet run** | ☐ |
| MF5 | **No go-live language** in Mac-only batch reports — do not write “clinic go-live ready” without package verification evidence, Windows field evidence referencing `packageVerification.evidencePath`, and go/no-go | ☐ |
| MF6 | **Clinic go-live:** explicitly **BLOCKED** in report status table until tier 3 **Completed** | ☐ |
| MF7 | Installer / NSIS **not** promised — [windows-pilot-installer-decision-record.md](./windows-pilot-installer-decision-record.md) Mac-first checklist reviewed | ☐ |

**Rule:** MF1–MF7 passing does **not** change tier 3 from **Deferred**. Tier 3 must stay **Deferred / Not yet run** until PHI-safe Windows field evidence referencing `packageVerification.evidencePath` exists in `qa-runs/`.

**Three-tier reference:** [PILOT-START-HERE.md](./PILOT-START-HERE.md) · **Windows field test:** [FIELD-TEST-START-HERE.md](./FIELD-TEST-START-HERE.md)
