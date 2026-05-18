# Phase 3 — Sandbox validation band

**Purpose:** One command that exercises all four sandbox write routes against **synthetic, disposable** data only. Use in CI and before sign-off on write-safety changes. This is **not** a substitute for manual QA on a clinic copy; it proves the bridge gates and dry-run contracts in isolation.

**Related:** [phase-3-disposable-write-sandbox.md](./phase-3-disposable-write-sandbox.md), [phase-3-sandbox-guard.md](./phase-3-sandbox-guard.md), [phase-3-backup-cli.md](./phase-3-backup-cli.md), [phase-3-restore-cli.md](./phase-3-restore-cli.md), [phase-3-write-safe-qa-checklist.md](./phase-3-write-safe-qa-checklist.md).

**Implementation:** [`services/bridge/src/sandbox/sandbox-validation-band.test.ts`](../services/bridge/src/sandbox/sandbox-validation-band.test.ts) (Vitest, in-process HTTP; no shell `curl` to real paths).

---

## Hard rules (every run)

| Rule | Requirement |
| --- | --- |
| **Never touch** | `/Users/Tamam/Desktop/Microdent/Microdent-Legacy` |
| **Read-only reference only** | `/Users/Tamam/Desktop/Microdent/Microdent-Legacy-Copy` — do **not** use as `DATA_ROOT` for validation |
| **Writable target** | Only `mkdtemp` directories under the OS temp folder, with `.microdent-write-sandbox.json` (`disposable: true`) |
| **No clinic data** | No real patient tables, production `DATA/`, or committed SQLite mirrors in tests |
| **No PHI in output** | Responses must not include raw DBF rows, full phones, notes, memos, payment amounts, or before/after values |

The band does **not** start a long-lived bridge against your operator `DATA_ROOT`. It builds a throwaway tree per test run.

---

## What `pnpm sandbox:validate` does

From the repository root, this runs:

```bash
pnpm --filter @microdent/bridge exec vitest run src/sandbox/sandbox-validation-band.test.ts
```

(Defined as `sandbox:validate` in the root [`package.json`](../package.json).)

Vitest:

1. Creates a **temporary** `DATA_ROOT` and empty `BACKUP_DIR` under `tmpdir`.
2. Writes **synthetic** `SCHEDULE.DBF`, `PATIENT.DBF`, and related fixture rows (no real clinic identifiers).
3. Writes the disposable sandbox marker at `DATA_ROOT/.microdent-write-sandbox.json`.
4. Starts an in-process bridge with `WRITE_MODE=dry-run`.
5. Calls each mutation route over loopback HTTP and asserts a `SafeWritePlan` with `committed: false` and `mode: "dry-run"`.
6. Asserts **no DBF mtime change** and **no backup folders** created for dry-run cases.

No FoxPro/EXE/BAT binaries are executed. No files under Legacy or Legacy-Copy are read or written.

---

## Normal mode (default)

**Command:**

```bash
nvm use 22
pnpm sandbox:validate
```

**Node:** **22.5+** required (same as SQLite mirror work; `node:sqlite`).

**Environment:** No operator `DATA_ROOT`, `BACKUP_DIR`, or `ALLOW_LEGACY_WRITES` is required. The test band sets up its own temp paths.

### What is validated (four checks, all must pass)

| # | Route | Method | Workflow | Pass criteria |
| --- | --- | --- | --- | --- |
| 1 | `/v1/schedule/appointments/:id/status` | `PATCH` | `appointment.statusUpdate` | **200**, `SafeWritePlan` with `committed: false`, `mode: dry-run`; `SCHEDULE.DBF` mtime unchanged; backup dir empty |
| 2 | `/v1/schedule/appointments/:id/time` | `PATCH` | `appointment.timeMove` | Same dry-run contract; schedule mtime unchanged |
| 3 | `/v1/schedule/appointments` | `POST` | `appointment.create` | Same dry-run contract; schedule mtime unchanged |
| 4 | `/v1/patients/:patientId/demographics` | `PATCH` | `patient.demographics.update` | Same dry-run contract; `PATIENT.DBF` mtime unchanged; response must not echo fixture phone tokens |

For each response, the band also asserts the JSON body does **not** contain forbidden patterns (e.g. `"before"`, `"after"`, `"rawRow"`, `PAT_NAME`, `TELEPHONE`, `COMMENT`, or synthetic secret tokens used only inside fixtures).

Dry-run mode does **not** write notes, memos, comments, payment fields, or medical free text. Request bodies use allowlisted fields only (see route contracts in phase-3 docs).

### Fifth–eighth tests (skipped in normal mode)

Four **real** write drills (status, time move, create, demographics) are **skipped** unless you opt in (see below). Each uses its own fresh `mkdtemp` sandbox.

---

## Optional real validation: `SANDBOX_VALIDATE_REAL=1`

**Commands:**

```bash
nvm use 22
SANDBOX_VALIDATE_REAL=1 pnpm sandbox:validate
# or
pnpm sandbox:validate:real
```

(`sandbox:validate:real` is defined in the root [`package.json`](../package.json) and sets `SANDBOX_VALIDATE_REAL=1` for you.)

### What it adds

When `SANDBOX_VALIDATE_REAL=1`, the band runs **four** additional tests (one per workflow). Each test:

1. Uses a **fresh** `mkdtemp` sandbox (synthetic fixtures + disposable marker).
2. Sets `WRITE_MODE=enabled`, `ALLOW_LEGACY_WRITES=I_UNDERSTAND_THIS_IS_A_DISPOSABLE_COPY`, and a temp `BACKUP_DIR`.
3. **Commits** one allowlisted mutation over loopback HTTP.
4. Verifies only the expected fields changed on disk (and blocked schedule/patient columns stay untouched where applicable).
5. Asserts a backup folder exists under temp `BACKUP_DIR`, then runs **`runLegacyRestore`** from that backup.
6. Verifies the sandbox reverts to the pre-write state for that workflow.

| Workflow | Route | Post-write check | Post-restore check |
| --- | --- | --- | --- |
| `appointment.statusUpdate` | `PATCH …/1001/status` → `status: 3` | `STATUS` is 3 | `STATUS` back to fixture value (1) |
| `appointment.timeMove` | `PATCH …/1001/time` → date/time/room | `DATE`/`TIME`/`ROOM` updated; `COMMENT`/`PAT_NAME`/`TELEPHONE` unchanged | Schedule row back to fixture slot |
| `appointment.create` | `POST …/appointments` (synthetic patient `50001`) | New id exists; blocked columns empty on new row | New appointment **not found** |
| `patient.demographics.update` | `PATCH …/50001/demographics` | `chartNumber` updated; `HOME_PHONE` unchanged | Profile chart number reverted; phone still fixture value |

All paths stay under `tmpdir`. Nothing points at Microdent-Legacy or Microdent-Legacy-Copy.

### Why real validation is opt-in

Real writes mutate DBF bytes. The default command keeps CI and local checks **fast and side-effect-free**. Opt-in real mode proves backup + restore integration on the same synthetic tree shape operators use in disposable sandboxes.

### Why real validation must never use Legacy-Copy or production DATA

- **Microdent-Legacy** must never be written.
- **Microdent-Legacy-Copy** is for **read-only** reference when building a disposable sandbox (`pnpm legacy:create-sandbox`), not as a live write target.
- Real clinic `DATA/` may contain PHI; this band must not read or log row contents.

Only **synthetic fixtures** (generated in the test) or an operator-created **disposable write sandbox** (marker + ack + your own copy) are valid targets for manual QA outside this command. This automated band always uses generated temp sandboxes.

---

## Required environment variables

| Variable | Normal `pnpm sandbox:validate` | `SANDBOX_VALIDATE_REAL=1` |
| --- | --- | --- |
| `SANDBOX_VALIDATE_REAL` | unset or not `1` | **`1`** (enables all four real-write drills; or use `pnpm sandbox:validate:real`) |
| `DATA_ROOT` | **Not used** (test creates temp) | **Not used** (test creates temp) |
| `BACKUP_DIR` | **Not used** (empty temp dir) | **Not used** (test creates temp) |
| `WRITE_MODE` | **Not used** (set in test config) | **Not used** (set in test config) |
| `ALLOW_LEGACY_WRITES` | **Not used** (stubbed in real sub-suite only) | Stubbed inside test to the required ack string |

Do not export production paths into this command expecting them to be picked up—the band ignores operator paths by design.

---

## What this command must never do

- Read, write, or delete under **Microdent-Legacy** or **Microdent-Legacy-Copy**.
- Run legacy **EXE**, **BAT**, or FoxPro binaries.
- Import or commit real clinic DBF/SQLite files into the repo.
- Print raw DBF rows, patient names, phones, notes, memos, payment amounts, or before/after field values in test failures (assertions use status codes and plan metadata only).
- Accept or send `COMMENT`, `TELEPHONE`, `PAT_NAME`, `CASENUM`, or medical/payment fields on write routes (blocked by API contracts; not exercised as successful writes here).
- Replace manual steps 11–12 in [phase-3-write-safe-qa-checklist.md](./phase-3-write-safe-qa-checklist.md) on your real disposable sandbox—run those separately when piloting.

---

## How to run (operator checklist)

1. `cd` to `Microdent-Modern`.
2. `nvm use 22` (confirm `node -v` is **≥ 22.5**).
3. `pnpm install` if dependencies are missing.
4. `pnpm sandbox:validate`.

Optional deeper drill:

5. `pnpm sandbox:validate:real` (equivalent to `SANDBOX_VALIDATE_REAL=1 pnpm sandbox:validate`).

After a green run, continue with full repo checks per [checkpoint-workflow.md](./checkpoint-workflow.md) (`pnpm test`, `pnpm build:web`) before merging or tagging a release.

---

## Expected output and failure behavior

### Success (normal mode)

Vitest reports **4 passed**, **4 skipped** (the real-write sub-suite).

Example shape (versions may vary):

```text
 ✓ sandbox validation band > dry-run band > PATCH appointment status …
 ✓ sandbox validation band > dry-run band > PATCH appointment time move …
 ✓ sandbox validation band > dry-run band > POST appointment create …
 ✓ sandbox validation band > dry-run band > PATCH patient demographics …
 ↓ optional real write band > status commit … (skipped)
 ↓ optional real write band > time move commit … (skipped)
 ↓ optional real write band > create commit … (skipped)
 ↓ optional real write band > demographics commit … (skipped)

 Test Files  1 passed (1)
      Tests  4 passed | 4 skipped
```

### Success (with real band)

**8 passed**, **0 skipped** when `SANDBOX_VALIDATE_REAL=1` or `pnpm sandbox:validate:real`.

### Failure behavior

| Failure | Typical cause |
| --- | --- |
| Vitest **FAIL** on a dry-run test | Write gate regression, route handler error, or `SafeWritePlan` schema/PHI leak |
| **403** / sandbox errors in test | Sandbox guard or marker validation broken |
| **Unexpected mtime change** | Dry-run path wrote DBF bytes (critical bug) |
| Real band fails when enabled | Backup, restore, or commit path broken for one of the four workflows on synthetic tree |
| `node:sqlite` / engine errors | Node below 22.5 — use `nvm use 22` |
| Command not found | Run from repo root after `pnpm install`; script is on root `package.json` |

Fix the failing assertion in bridge write routes or the band test—do not point the band at real clinic `DATA_ROOT` to “make it pass.”

---

## Relationship to other commands

| Command | Role |
| --- | --- |
| `pnpm test` | Full monorepo unit tests (includes this band when bridge tests run) |
| `pnpm sandbox:validate` | Focused signal for sandbox write dry-run + optional synthetic restore drills (four workflows) |
| `pnpm sandbox:validate:real` | Same band with `SANDBOX_VALIDATE_REAL=1` (all eight tests) |
| `pnpm legacy:backup` / `pnpm legacy:restore` | Operator CLIs on **your** disposable sandbox paths (manual QA) |
| `pnpm legacy:create-sandbox` | Copy from Legacy-Copy into a **new** write sandbox (never write Legacy-Copy in place) |

---

## Privacy note for logs and CI

CI and local Vitest output should show only pass/fail, workflow names, and HTTP status—not row payloads. If you see synthetic secret tokens from fixtures in failure diffs, treat that as a test or redaction bug, not as data to paste into tickets.
