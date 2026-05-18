# Validation Hardening Batch Report

**Date:** 2026-05-18  
**Repo:** `/Users/Tamam/Desktop/Microdent/Microdent-Modern`  
**Node:** v22.22.3 (`nvm use 22`)  
**Coordinator checkpoint:** mandatory test/build + sandbox QA + commit

---

## 1. Workers run (batch scope)

| Worker | Focus | Deliverables |
| --- | --- | --- |
| **A — QA runner** | `pnpm qa:sandbox` orchestration | `scripts/qa-sandbox-run.sh`, `scripts/qa-sandbox-write-smoke.sh`, `docs/phase-3-sandbox-qa-runner.md`, `package.json` `qa:sandbox` script |
| **B — Windows** | Production script classification | `docs/phase-3-windows-readiness-audit.md`, `scripts/README.md` |
| **E — Desktop** | Bridge supervisor + config paths | `apps/desktop/src/config.ts`, `bridge-supervisor.test.ts`, `config.test.ts`, `apps/desktop/README.md` |
| **F+G — Readonly / Vitest** | Contract-aligned mocks, env hygiene | `packages/app` smoke/tests, `vitest.setup.ts` (app + bridge), `read-only-smoke-fixtures.ts`, `import-patients-fk-reimport.test.ts`, `write-schedule-create.test.ts` |
| **C+D — Operator UX** | Shell banners, write feedback, search/schedule copy | `shell-status-banners.ts`, `write-operation-feedback.ts`, `AppShell.tsx`, `PatientSearchBar.tsx`, `SchedulePanel.tsx`, `read-only-ui-copy.ts` |

No new write routes or features were added in this batch; changes harden validation, operator messaging, and repeatable sandbox QA.

---

## 2. Files changed (`git diff --stat`)

**Tracked (28 files):** +1088 / −172 lines

| Area | Files |
| --- | --- |
| `apps/desktop` | README, config, bridge-supervisor tests |
| `docs` | checkpoint-workflow, phase-3 audit/backup/write-safe checklist |
| `packages/app` | App shell, schedule, search, write actions, tests, CSS |
| `services/bridge` | `write-schedule-create`, dbf helpers, fixtures, vitest config |
| `services/sqlite-mirror` | `import-patients`, mirror-import-safe test |
| `package.json` | `qa:sandbox` script |

**Untracked (added this batch):**

- `docs/phase-3-sandbox-qa-runner.md`, `docs/phase-3-windows-readiness-audit.md`
- `scripts/README.md`, `scripts/qa-sandbox-*.sh`
- `packages/app/src/shell-status-banners.*`, `write-operation-feedback.*`, `vitest.setup.ts`
- `services/bridge` memo-create tests/fixtures, `vitest.setup.ts`, `import-patients-fk-reimport.test.ts`
- `qa-runs/*` (reports, phase-g artifacts)

`pnpm-lock.yaml` and root `README.md` — **unchanged**.

---

## 3. Tests run and results

### `pnpm test` (clean env)

| Workspace | Result |
| --- | --- |
| `@microdent/contracts` | **Pass** — 3/3 |
| `@microdent/sqlite-mirror` | **Pass** — 40/40 (16 files) |
| `@microdent/bridge` | **Pass** — 295 passed, 4 skipped (41 files) |
| `@microdent/bridge-client` | **Pass** — 36/36 |
| `@microdent/ui` | **Pass** — 10/10 |
| `@microdent/app` | **Pass** — 211/211 (22 files) |

**Overall:** exit **0**

### `WRITE_MODE=enabled ALLOW_LEGACY_WRITES=I_UNDERSTAND_THIS_IS_A_DISPOSABLE_COPY pnpm test`

| Result |
| --- |
| **Pass** — same counts; exit **0** (proves `vitest.setup.ts` env isolation) |

---

## 4. Build result

| Command | Result |
| --- | --- |
| `pnpm build:web` | **Pass** — Vite production build (~292 kB JS gzip ~81 kB); exit **0** |

---

## 5. `pnpm qa:sandbox` result

**Prerequisites:** `DATA_ROOT=/Users/Tamam/Desktop/Microdent/Microdent-Write-Sandbox/DATA` (marker present), `SQLITE_PATH=/Users/Tamam/Desktop/Microdent/MICRODENT_MIRROR_SANDBOX.sqlite` (exists). No `legacy:create-sandbox` or `mirror:import-safe` needed.

| Step | Result |
| --- | --- |
| Bridge build + start (`node dist/server.js`) | **Pass** — health attempt 1, write-capability ready attempt 1 |
| `appointment.statusUpdate` | dry-run 200 → commit 200 `committed=true` → restore **PASS** |
| `appointment.timeMove` | conflict-free slot → dry-run 200 → commit 200 → restore **PASS** |
| `appointment.create` | dry-run 200 → commit 200 → restore **PASS** |
| `patient.demographics.update` | dry-run 200 → commit 200 → restore **PASS** |
| Write audit (safe fields) | **Pass** — success rows logged by `operationId` / `workflow` |

**Exit code:** **0**  
**Note:** First coordinator attempt exited **1** with `EPERM` on `Microdent-Write-Sandbox/backups/` when the tool sandbox blocked writes outside the repo; re-run with full filesystem access succeeded.

---

## 6. Path sentinels (post-QA)

Files newer than `2026-05-18T12:00:00Z`:

| Path | Count |
| --- | --- |
| `Microdent-Legacy` | **0** |
| `Microdent-Legacy-Copy` | **0** |

Production and legacy-copy trees were not touched during QA.

---

## 7. Reference check (doctors)

| Source | Count |
| --- | --- |
| `sqlite3 … SELECT COUNT(*) FROM doctors` | **6** |
| Bridge during `qa:sandbox` | Up (health + write smoke used live HTTP) |
| Post-QA ad-hoc `curl /v1/reference/doctors` | Not captured (standalone bridge start timing); prior remediation verified **6 HTTP = 6 mirror** |

---

## 8. Git status before commit

- **Branch:** `main`
- **Staged:** none (pre-commit)
- **Must NOT be staged:** `Microdent-Legacy`, `Microdent-Legacy-Copy`, Write-Sandbox `DATA`, `*.sqlite`, `node_modules`, `dist` — **none appear in `git status`** ✓

---

## 9. Windows readiness

See [`docs/phase-3-windows-readiness-audit.md`](../docs/phase-3-windows-readiness-audit.md).

- Bridge/mirror/legacy **CLIs** are cross-platform Node after build.
- Root `pnpm legacy:*` / `mirror:import-safe` / `qa:sandbox` are **bash-oriented** (macOS dev / Git Bash / WSL on Windows).
- `pnpm dev:*` port helpers are **macOS-only** (`lsof`).
- Desktop: Electron + `%AppData%\Microdent\config.json` on Windows.

---

## 10. Risks / blockers

| Risk | Severity | Notes |
| --- | --- | --- |
| `qa:sandbox` requires bash, `curl`, `jq`, `sqlite3`, writable sandbox backups dir | Low (macOS ops) | Documented; Windows needs manual steps until Node orchestrator |
| Mirror import may report `overall: partial` for clinic data | Low | Expected; does not block write smoke when appointments/patients exist |
| Procedures HTTP (20) vs mirror (24) | Info | `source_deleted` filtering — not a regression |
| CI/agent sandboxes without Write-Sandbox write access | Low | QA must run with permissions to create backup dirs outside repo |

**Blockers for merge:** none identified in this checkpoint.

---

## 11. Safe to commit

**Yes** — monorepo tests (clean + leaked env), `build:web`, and `pnpm qa:sandbox` all green; path sentinels zero; no PHI or legacy paths in git index.

**Commit message (requested):** `feat: harden sandbox QA, Windows readiness, and operator UX`
