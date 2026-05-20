# Windows pilot distribution RC batch report — A–M (2026-05-22)

**Repo:** `/Users/Tamam/Desktop/Microdent/Microdent-Modern`  
**Plan:** `windows_distribution_rc_a6368117.plan.md`  
**Branch:** `main` (uncommitted working tree)  
**Coordinator:** Agent_FinalReport (WORKSTREAM M)  
**Checkpoint host:** macOS (darwin), Node **v22.22.3** (`nvm use 22`)  
**Commit policy:** User did not request commit — **no commit performed**.

---

## Executive summary

| Gate | Result |
| --- | --- |
| **Overall batch** | **PASS** (mandatory chain green after M-scope fixes) |
| `pnpm test` | **PASS** |
| `pnpm build:web` | **PASS** |
| `pnpm qa:sandbox` | **SKIP** (`DATA_ROOT` / `SQLITE_PATH` unset) |
| Desktop `test` + dev `release-smoke` | **PASS** |
| `pnpm pilot:distribution-checkpoint` | **PASS** (stage + verify + staged smoke) |

During WORKSTREAM M, two regressions from Wave 2 copy edits were fixed without expanding write domains: restored missing `read-only-ui-copy.ts` exports required by app build/tests, and aligned `appointment-status-write.test.tsx` with updated sandbox panel banner text.

---

## Waves and agents (A–M)

| Wave | Agents | Status |
| --- | --- | --- |
| **Wave 1** | A DistributionBuilder, D DataLocations, J AcceptanceChecklist, K Guardrails, L LoggingSweep | **Done** (per parent) |
| **Wave 2** | B ReleaseSmoke, C ConfigSafety, E SetupWizard, F SettingsReadiness, G MirrorFlow, H PilotValidation, I RecoveryUX | **Done** (per parent) |
| **Wave 3** | **M FinalReport** | **Done** (this report + checkpoint) |

| WS | Agent | Focus (batch) |
| --- | --- | --- |
| **A** | DistributionBuilder | `MicrodentModern/` staged layout, HANDOFF-README, stage/verify guards |
| **B** | ReleaseSmoke | `release-smoke.mjs` dev + `PILOT_STAGED_RELEASE=1` |
| **C** | ConfigSafety | Windows paths, UNC warnings, config tests |
| **D** | DataLocations | `windows-pilot-data-locations.md`, operator-data-locations helper |
| **E** | SetupWizard | setup.html / setup-window UX |
| **F** | SettingsReadiness | Settings panel status + operator copy |
| **G** | MirrorFlow | Mirror operator docs + settings hints |
| **H** | PilotValidation | Checkpoint / validation wiring |
| **I** | RecoveryUX | Recovery / startup failure copy |
| **J** | AcceptanceChecklist | `pilot-acceptance-checklist.md` |
| **K** | Guardrails | out-of-scope + write-route inventory tests |
| **L** | LoggingSweep | log redaction review docs |
| **M** | FinalReport | Mandatory checkpoint + this report; export/test repair |

---

## Mandatory checkpoint (M)

| Step | Result | Notes |
| --- | --- | --- |
| `nvm use 22` | **PASS** | v22.22.3 |
| `pnpm test` | **PASS** | contracts 3; sqlite-mirror 42; bridge 330 (4 skipped); bridge-client 36; ui 10; app **268**; desktop **56** |
| `pnpm build:web` | **PASS** | Vite production build OK |
| `pnpm qa:sandbox` | **SKIP** | `DATA_ROOT` and `SQLITE_PATH` unset — run on disposable sandbox machine before write-pilot sign-off |
| `pnpm --filter @microdent/desktop run test` | **PASS** | 56 tests |
| `pnpm --filter @microdent/desktop run release-smoke` | **PASS** | Dev tree: dist + config defaults + supervisor argv |
| `pnpm pilot:distribution-checkpoint` | **PASS** | Full chain: test → build:web → bridge/desktop build → `stage:pilot-release` → `pilot:verify-release` → staged `release-smoke`; qa:sandbox skipped inside script |

### Distribution checkpoint details

- **Stage:** `[stage-pilot-release] OK — staged 224 files in 24 directories under dist/pilot-release/MicrodentModern/`
- **Verify:** `[verify-pilot-release] MicrodentModern layout, supervisor invariants, and sensitive-artifact guards OK`
- **Staged smoke:** `[release-smoke] … OK` with `PILOT_STAGED_RELEASE=1`
- **Script:** `scripts/pilot-distribution-checkpoint.sh` (untracked); root `package.json` adds `pilot:distribution-checkpoint`

### M-scope fixes (same working tree, no new write domains)

1. **`packages/app/src/read-only-ui-copy.ts`** — Re-added constants accidentally removed during copy polish (patient/today loading strings, offline search banners, `SETTINGS_SQLITE_MIRROR_UNKNOWN`, mirror partial/failed calouts). Required for `tsc` and multiple panels.
2. **`packages/app/src/appointment-status-write.test.tsx`** — Expectations updated to match `SANDBOX_WRITE_PILOT_PANEL_BANNER` (“Sandbox write mode … disposable data only”).

---

## Changed files (aggregate, all waves)

**Modified (40 files, +1343 / −372 lines):**

- **Desktop:** `apps/desktop/README.md`, `scripts/release-smoke.mjs`, `src/bridge-supervisor.ts`, `src/config.test.ts`, `src/path-validation.test.ts`, `src/setup/setup-window.{ts,test.ts,html}`
- **App:** `packages/app/src/{SettingsPanel.tsx,read-only-ui-copy.ts,settings-panel.test.tsx,settings-status.ts,settings-status.test.ts,write-operation-feedback.ts,write-operation-feedback.test.ts,appointment-status-write.test.tsx}`
- **Bridge / mirror:** `services/bridge/src/{cli/legacy-create-sandbox.ts,cli/legacy-restore.ts,config.ts,server.ts,write-safety/validate-writable-sandbox.ts,write-safety/write-route-inventory.test.ts}`, `services/sqlite-mirror/src/mirror-env.ts`
- **Scripts / root:** `package.json`, `scripts/{README.md,dev-bridge.sh,pilot-full-checkpoint.sh,qa-sandbox-write-smoke.sh,stage-pilot-release.mjs,verify-pilot-release.mjs}`
- **Docs:** `docs/PILOT-START-HERE.md`, `docs/out-of-scope-guardrails.md`, `docs/phase-4-mirror-import-operator.md`, `docs/phase-8-log-redaction-review.md`, `docs/pilot-acceptance-checklist.md`, `docs/pilot-backup-restore-audit.md`, `docs/pilot-tester-guide.md`, `docs/windows-dev-dry-run.md`, `docs/windows-pilot-data-locations.md`, `docs/windows-pilot-release-layout.md`

**Untracked (3):**

- `apps/desktop/src/operator-data-locations.{ts,test.ts}`
- `scripts/pilot-distribution-checkpoint.sh`

**Generated (gitignored, not in commit):**

- `dist/pilot-release/` → `dist/pilot-release/MicrodentModern/` (includes `HANDOFF-README.txt`, `app/`, `bridge/`, `web/`, placeholders)

---

## Git status summary

- **Branch:** `main`
- **Staged:** none
- **Uncommitted:** 40 modified + 3 untracked (see above)
- **Sensitive artifacts tracked?** **No** — `git status` shows no `.sqlite`, `/DATA/`, `backups/`, `*.log`, or `dist/pilot-release/` paths
- **`.gitignore` coverage:** `dist/pilot-release/`, `*.sqlite`, `/DATA/`, `backups/`, `*.log` — confirmed `dist/pilot-release` ignored via `git check-ignore`

---

## Safe to commit?

| Question | Answer |
| --- | --- |
| Tests / build / distribution checkpoint | **Yes** — all green after M fixes |
| PHI / runtime data in tree | **No tracked runtime data** — still verify locally before `git add` |
| Installer / signing artifacts | **N/A** — out of scope; nothing to commit |
| Review focus before commit | Staging script size (+239 lines), setup HTML/TS UX, settings copy churn in `read-only-ui-copy.ts`, new `pilot:distribution-checkpoint` script |

**Risks / blockers**

- **`pnpm qa:sandbox` not run** on this host — mandatory for write-pilot proof when env is available.
- **No NSIS/MSI/signing** — IT handoff is staged folder + docs, not a signed installer.
- **Copy-edit discipline** — Wave 2 UI copy changes can drop exports; M restored; consider a small “exports used by panels” guard test later (optional).

**Recommended next batch**

1. Run `pnpm qa:sandbox` with disposable `DATA_ROOT` + `SQLITE_PATH` (and `BACKUP_DIR` if required) on Windows or macOS sandbox paths.
2. IT dry-run: copy `dist/pilot-release/MicrodentModern/` to a pilot PC, follow `HANDOFF-README.txt` + `pilot-acceptance-checklist.md`.
3. Optional: commit distribution RC as one reviewed changeset (user must explicitly request).
4. Future (out of scope here): Authenticode, bundled Node 22, installer packaging.

---

## Pass / fail summary

| Check | Pass/Fail |
| --- | --- |
| `pnpm test` | **PASS** |
| `pnpm build:web` | **PASS** |
| `pnpm qa:sandbox` | **SKIP** |
| `@microdent/desktop` test | **PASS** |
| `@microdent/desktop` release-smoke (dev) | **PASS** |
| `pnpm pilot:distribution-checkpoint` | **PASS** |
| **Batch overall** | **PASS** (sandbox proof deferred) |

**Report path:** `qa-runs/2026-05-22-windows-pilot-distribution-rc-batch-report.md`
