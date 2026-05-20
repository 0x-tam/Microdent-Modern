# Windows pilot package batch report — A–I (2026-05-21)

**Repo:** `/Users/Tamam/Desktop/Microdent/Microdent-Modern`  
**Baseline:** clean `main` at `1b67d2b` (audit-first gap-fill)  
**Branch:** `main` (uncommitted working tree)  
**Coordinator checkpoint:** 2026-05-21  
**Commit policy:** Do not commit unless explicitly instructed.

---

## Wave summary

| Wave | Status | Outcome |
| --- | --- | --- |
| Wave 1 (A, D, F, G, H) | **Done** | Release layout doc + staging script; data locations doc; acceptance checklist; guardrails sign-off; dev dry-run |
| Wave 2 (B, C, E) | **Done** | release-smoke repoRoot checks; verify-pilot-release; setup Windows examples; recovery copy |
| Wave I (checkpoint) | **PASS** | Full mandatory chain green; staged package verified |

---

## Workstreams

| WS | Verdict | Changes |
| --- | --- | --- |
| **A** ReleaseStructure | **Gap-fill** | `docs/windows-pilot-release-layout.md`, `scripts/stage-pilot-release.mjs`, `pnpm stage:pilot-release`, config templates, `.gitignore` `dist/pilot-release/` |
| **B** ReleaseSmoke | **Gap-fill** | `release-smoke.mjs` repoRoot join checks + optional `PILOT_STAGED_RELEASE=1`; `scripts/verify-pilot-release.mjs`, `pnpm pilot:verify-release`; desktop README |
| **C** SetupReliability | **Gap-fill** | `setup.html` Windows examples (help only); relative-path test in `setup-window.test.ts` |
| **D** DataLocations | **Gap-fill** | `docs/windows-pilot-data-locations.md`; PILOT-START-HERE links; packaging gap baseline → `1b67d2b`; config win32 tests already present |
| **E** RecoveryFlow | **Gap-fill** | `startup-failure.ts` sandbox/backup/write mappings; recovery strings in `read-only-ui-copy.ts`; generic unknown → PILOT-START-HERE |
| **F** AcceptanceChecklist | **Gap-fill** | `docs/pilot-acceptance-checklist.md`; linked from PILOT-START-HERE |
| **G** Guardrails | **Audit + gap-fill** | Route inventory unchanged (green in `pnpm test`); staging guards in stage/verify scripts; pilot package sign-off in `out-of-scope-guardrails.md` |
| **H** WindowsDryRun | **Gap-fill** | `docs/windows-dev-dry-run.md`, `scripts/dev-windows-dry-run.sh` |
| **I** FinalReport | **PASS** | This report |

---

## Mandatory checkpoint

| Step | Result | Notes |
| --- | --- | --- |
| `nvm use 22` | **PASS** | v22.22.3 |
| `pnpm test` | **PASS** | bridge 308 (+4 skipped); app 272; desktop **47** (+3) |
| `pnpm build:web` | **PASS** | Vite production build OK |
| `pnpm qa:sandbox` | **PASS** | 4 workflows; DBF readback `source=dbf`; mirror partial WARN (non-blocking) |
| `pnpm --filter @microdent/desktop run test` | **PASS** | 47 tests |
| `pnpm --filter @microdent/desktop run release-smoke` | **PASS** | repoRoot join + supervisor invariants |
| `pnpm stage:pilot-release` | **PASS** | 217 files, 20 directories under `dist/pilot-release/` |
| `pnpm pilot:verify-release` | **PASS** | Layout + sensitive-artifact guards |
| `git status` | **DIRTY** | 13 modified, 7 untracked; no Legacy/sandbox DATA/sqlite tracked; `dist/pilot-release/` gitignored |

### Sandbox excerpt

```
[qa-write-smoke] readback workflow=appointment.statusUpdate source=dbf appointment_id=100 status=2
[qa-write-smoke] === qa-sandbox-write-smoke complete (4 workflows) ===
[qa-sandbox-run] WARN: mirror has partial/failed table imports — DBF remains source of truth for writes
```

### Staging fix (during batch)

Initial `stage:pilot-release` failed because path guards matched filenames like `map-write-sandbox-error.js`. Guards now check **directory segments only**; desktop staging excludes `*.test.js` artifacts.

---

## Changed files

**Modified (13):**  
`.gitignore`, `package.json`, `scripts/README.md`  
`apps/desktop/{README.md,scripts/release-smoke.mjs,src/setup/setup.html,src/setup/setup-window.test.ts,src/startup-failure.ts,src/startup-failure.test.ts}`  
`docs/{PILOT-START-HERE.md,out-of-scope-guardrails.md,windows-pilot-packaging-gap-report.md}`  
`packages/app/src/read-only-ui-copy.ts`

**Untracked (7):**  
`docs/{pilot-acceptance-checklist.md,windows-dev-dry-run.md,windows-pilot-data-locations.md,windows-pilot-release-layout.md}`  
`scripts/{dev-windows-dry-run.sh,stage-pilot-release.mjs,verify-pilot-release.mjs}`

**Generated (gitignored):** `dist/pilot-release/`

**Not tracked (correct):** sandbox DATA, `.sqlite`, Legacy trees

---

## Safe to commit?

**Yes** — focused pilot package batch on `1b67d2b`. Zero new npm packaging deps. Suggested message:

```
feat(pilot): Windows pilot package staging and operator docs

Add stage:pilot-release and pilot:verify-release, release layout and
data-location docs, acceptance checklist, dev dry-run, setup/recovery
copy polish, and staging guardrails without new write domains.
```

---

## Risks / blockers

| Risk | Mitigation |
| --- | --- |
| Unpackaged desktop (Node + build manual) | Documented; staging gives IT a copyable tree |
| Real Windows not validated on this machine | `windows-dev-dry-run.md` lists gaps; field test still required |
| Mirror partial WARN in QA | Warn-only; DBF is write proof |
| Bridge dist includes `map-write-sandbox-error.js` etc. | Filename allowed; directory-segment guards only |
| No commit/deploy in this run | Per instruction — commit when operator approves |

**Blockers:** None for handoff review.

---

## Recommended next batch

1. Real Windows machine test matrix (record in `qa-runs/`)
2. electron-builder / NSIS spike with signing plan
3. Filter bridge staging to production-only subset (optional size reduction)
4. CI job: `pilot-checkpoint` + `stage:pilot-release` + `pilot:verify-release` on tag
