# Phase 3 — Disposable write sandbox (design only)

**Status:** Planning / runbook — **no write routes or write helpers are implemented** in Microdent-Modern yet. This document defines how operators and future bridge code must treat legacy FoxPro data before any real DBF mutation exists.

**Related:** [phase-1a-safety-module.md](phase-1a-safety-module.md) (read-only path sandbox), [master-build-plan.md](master-build-plan.md) (Phase 4 writes require backup, audit, flags, dry-run).

---

## 1. Problem statement

Phase 1–2 intentionally **read** legacy tables under `DATA_ROOT` and mirror into SQLite. Phase 4 will eventually need **destructive and mutating** tests (row updates, counter bumps, pack/reindex experiments). Those tests must never run against:

| Path | Role today |
|------|------------|
| `/Users/Tamam/Desktop/Microdent/Microdent-Legacy` | **Production / authoritative** legacy install — must remain untouched |
| `/Users/Tamam/Desktop/Microdent/Microdent-Legacy-Copy/DATA` | **Working read-only reference** for bridge reads, mirror import, and manual QA |

A third location is required: a **disposable copy** used only when write mode is explicitly enabled and safety gates pass.

---

## 2. Why writes must never target `Microdent-Legacy`

`/Users/Tamam/Desktop/Microdent/Microdent-Legacy` is the live legacy tree documented in [legacy-system-map.md](legacy-system-map.md). Writing there risks:

- **Data loss** — FoxPro/VFP tables use paired `.DBF`, `.CDX`, `.FPT`, and DBC containers; partial or incorrect writes corrupt indexes and memos.
- **PHI exposure** — real patient data; mistakes belong in tickets and backups, not in an experimental bridge.
- **Operational fork** — legacy EXE and `schedule_replacement.py` assume this tree is authoritative; silent mutation breaks clinic workflows.
- **Policy** — Modern repo rules: **do not modify legacy files**; Legacy folder is **out of scope** for all Modern agents and scripts.

**Rule:** `DATA_ROOT` resolution and write guards must **reject** any path that realpath-resolves under `Microdent-Legacy` (exact path denylist, not merely “outside repo”).

---

## 3. Why writes should not target `Microdent-Legacy-Copy` directly

`Microdent-Legacy-Copy` exists so Modern can **read** a stable snapshot without touching production:

- Mirror import (`pnpm mirror-import-safe`, `services/sqlite-mirror`) expects a consistent DBF tree.
- Manual QA and Phase 1b docs point `DATA_ROOT` at `…/Microdent-Legacy-Copy/DATA`.
- Operators refresh the copy from Legacy when needed; it is the **shared reference**, not a scratch pad.

Destructive write tests (delete row, botch `IDS.DBF`, truncate `SCHEDULE.DBF`, pack table) would:

- Break **all** read-only dev sessions still pointed at the copy.
- Force a full re-copy from Legacy to recover — slow and error-prone.
- Blur the line between “safe read source” and “throwaway lab.”

**Rule:** Treat `Microdent-Legacy-Copy` as **read-only forever** for Modern. Writable experiments use only the disposable sandbox below (created **from** the copy, never **in place of** it).

---

## 4. Proposed sandbox location

| Item | Value |
|------|--------|
| **Sandbox root** | `/Users/Tamam/Desktop/Microdent/Microdent-Write-Sandbox` |
| **`DATA_ROOT` for writes** | `/Users/Tamam/Desktop/Microdent/Microdent-Write-Sandbox/DATA` |
| **Marker file** | `/Users/Tamam/Desktop/Microdent/Microdent-Write-Sandbox/DATA/.microdent-write-sandbox.json` |
| **Optional backup dir** | `/Users/Tamam/Desktop/Microdent/Microdent-Write-Sandbox/backups` (writable; per-mutation snapshots) |

The sandbox lives **outside** the `Microdent-Modern` git repo so DBF blobs are never staged. If a symlink or copy is ever placed under the repo, add `/Microdent-Write-Sandbox/` to root `.gitignore` (same hygiene as `/Microdent-Legacy-Copy/`).

---

## 5. Create the sandbox from `Microdent-Legacy-Copy/DATA`

Use a **full file-level copy** (not hardlinks to the copy) so sandbox mutations cannot affect the reference tree.

**macOS / Linux (recommended — preserves timestamps, restorable):**

```bash
SOURCE="/Users/Tamam/Desktop/Microdent/Microdent-Legacy-Copy/DATA"
DEST="/Users/Tamam/Desktop/Microdent/Microdent-Write-Sandbox/DATA"

mkdir -p "$(dirname "$DEST")"
rsync -a --delete "$SOURCE/" "$DEST/"
```

**Alternative (simple):**

```bash
rm -rf "/Users/Tamam/Desktop/Microdent/Microdent-Write-Sandbox/DATA"
mkdir -p "/Users/Tamam/Desktop/Microdent/Microdent-Write-Sandbox/DATA"
cp -R "/Users/Tamam/Desktop/Microdent/Microdent-Legacy-Copy/DATA/." \
  "/Users/Tamam/Desktop/Microdent/Microdent-Write-Sandbox/DATA/"
```

**After copy:**

1. Create the marker (section 6).
2. Create `backups/` and verify it is writable.
3. Confirm `DATA_ROOT` is **absolute** and equals `…/Microdent-Write-Sandbox/DATA` before starting bridge with any future write flag.

**Never** rsync from `Microdent-Legacy` directly into the sandbox for day-to-day dev; refresh **Copy → Sandbox** so production stays one step removed.

---

## 6. Mark the sandbox as disposable

### 6.1 Marker file: `.microdent-write-sandbox.json`

Place at the **root of `DATA/`** (same directory as `PATIENT.DBF`, etc.):

```json
{
  "schemaVersion": 1,
  "purpose": "disposable-write-sandbox",
  "createdAt": "2026-05-15T12:00:00.000Z",
  "sourceCopy": "Microdent-Legacy-Copy/DATA",
  "disposable": true,
  "allowedOperations": ["dbf-row-write", "dbf-pack", "counter-bump"],
  "owner": "local-dev"
}
```

**Semantics:**

- `disposable: true` — required for future write gates.
- `sourceCopy` — audit trail only; not used for path resolution.
- Future bridge code must **read and validate** this file before any write helper runs; missing or invalid marker → **refuse writes** (HTTP 403 or startup error).

### 6.2 Human-visible cues

- Keep a `README.txt` in `Microdent-Write-Sandbox/` stating: *“Safe to delete; recreate from Legacy-Copy.”*
- Do not use this tree for mirror import production paths documented in Phase 2 runbooks unless you intentionally re-import after refresh.

---

## 7. Required environment flags (future write stack)

Until write routes exist, set these only in local shell profiles or one-off `export` blocks — **documented contract** for Phase 3+ implementation.

| Variable | Required when | Values / rules |
|----------|----------------|----------------|
| **`DATA_ROOT`** | Always (reads and writes) | **Absolute** path. For write tests: `/Users/Tamam/Desktop/Microdent/Microdent-Write-Sandbox/DATA` only. |
| **`WRITE_MODE`** | Any code path that mutates DBF | `dry-run` (default) or `enabled`. **`dry-run`:** log intended mutations, no `fs` write, no DBF pack. **`enabled`:** may mutate only after all safety checks pass. |
| **`ALLOW_LEGACY_WRITES`** | `WRITE_MODE=enabled` only | Must be exactly: `I_UNDERSTAND_THIS_IS_A_DISPOSABLE_COPY`. Any other value → refuse writes at startup. |

**Example session (future):**

```bash
export DATA_ROOT="/Users/Tamam/Desktop/Microdent/Microdent-Write-Sandbox/DATA"
export WRITE_MODE="dry-run"   # switch to "enabled" only for intentional destructive tests
export ALLOW_LEGACY_WRITES="I_UNDERSTAND_THIS_IS_A_DISPOSABLE_COPY"

# pnpm dev:bridge  # when write routes exist; today remains GET-only
```

**Defaults (implementation target):**

- `WRITE_MODE` unset → treat as `dry-run`.
- `ALLOW_LEGACY_WRITES` unset → **no writes**, even if `WRITE_MODE=enabled`.
- `WRITE_MODE=enabled` without sandbox marker → **refuse**.

---

## 8. Safety checks (implementation checklist)

Future `assertWritableDataRoot()` (bridge or sqlite-mirror write module) must **fail closed** before opening files for write:

| # | Check | Failure behavior |
|---|--------|------------------|
| 1 | **`DATA_ROOT` is absolute** | Reject at config load (same as [phase-1a-safety-module.md](phase-1a-safety-module.md)). |
| 2 | **Not original legacy path** | `realpath(DATA_ROOT)` must not equal or be under `/Users/Tamam/Desktop/Microdent/Microdent-Legacy` or `/Users/Tamam/Desktop/Microdent/Microdent-Legacy/DATA`. Also reject `Microdent-Legacy-Copy` paths when `WRITE_MODE=enabled` (copy is read-only reference). |
| 3 | **Sandbox marker present** | Require `DATA/.microdent-write-sandbox.json` with `disposable: true` and `schemaVersion` supported. |
| 4 | **Marker matches root** | Resolved path of marker file must be under `realpath(DATA_ROOT)` (no symlink escape). |
| 5 | **Backup directory writable** | e.g. `Microdent-Write-Sandbox/backups` exists and passes `access(W_OK)` before first mutation. |
| 6 | **Env gate** | `ALLOW_LEGACY_WRITES` exact match + `WRITE_MODE=enabled` for real writes; `dry-run` skips disk writes but may still validate paths. |
| 7 | **Git hygiene** | Sandbox DBF paths must not live inside `Microdent-Modern` working tree (or must match ignored patterns in `.gitignore`). CI must not mount real `DATA/`. |

**Symlinks:** Reuse `realpathSync.native` rules from `path-sandbox.ts` so `DATA_ROOT` cannot point through a link into Legacy or Legacy-Copy.

---

## 9. Verify the app refuses writes without sandbox markers

**Today (Phase 1–2):** Bridge and mirror importer already enforce **read-only** opens (`O_RDONLY`). Verification:

```bash
# Bridge with no DATA_ROOT — table routes 503
unset DATA_ROOT
pnpm dev:bridge
curl -s http://127.0.0.1:17890/v1/tables | jq '.error.code'
# expect DATA_ROOT_NOT_CONFIGURED
```

**After write routes land (acceptance tests to add):**

| Scenario | Expected |
|----------|----------|
| `DATA_ROOT` = Legacy-Copy, `WRITE_MODE=enabled`, marker absent | **403** / startup error `WRITE_SANDBOX_MARKER_MISSING` |
| `DATA_ROOT` = Legacy path (any write flag) | **403** / `WRITE_TARGET_FORBIDDEN` |
| `DATA_ROOT` = sandbox, marker present, `WRITE_MODE=dry-run` | **200** with `dryRun: true` body; **no** file mtime changes on `PATIENT.DBF` |
| `DATA_ROOT` = sandbox, marker present, `WRITE_MODE=enabled`, wrong `ALLOW_LEGACY_WRITES` | **403** / `WRITE_NOT_ACKNOWLEDGED` |
| `DATA_ROOT` = sandbox, all flags valid | Mutation allowed; backup file created under `backups/` first |

**Manual spot-check:** `stat -f "%m" PATIENT.DBF` before and after a dry-run call — mtime must be unchanged.

---

## 10. Testing strategy

| Layer | Approach |
|-------|----------|
| **Unit** | Mock `DATA_ROOT` with temp dirs: missing marker, legacy path denylist, relative path, symlink escape (reuse safety fixtures). |
| **Integration** | `mkdtemp` + minimal fake DBF + valid marker JSON; assert `WRITE_MODE=dry-run` never calls `writeFile`. |
| **E2E (local only)** | Operator copies sandbox from Legacy-Copy; runs one destructive test (e.g. append dummy row to a throwaway `FAKE_TEST.DBF` in sandbox only); confirms Legacy-Copy unchanged via `diff -rq` on a sample file set. |
| **CI** | No real PHI paths. Use `services/bridge/fixtures/sandbox` for reads; write tests use temp dirs with synthetic marker files only. |
| **Regression** | Golden test: `loadBridgeConfig()` + future `loadWriteConfig()` throws when `DATA_ROOT` contains string `Microdent-Legacy` (case-normalized on macOS). |

**Do not** point automated CI at `Microdent-Write-Sandbox` on a developer machine.

---

## 11. Cleanup and reset workflow

When the sandbox is corrupted or tests finish:

```bash
SANDBOX="/Users/Tamam/Desktop/Microdent/Microdent-Write-Sandbox"
SOURCE="/Users/Tamam/Desktop/Microdent/Microdent-Legacy-Copy/DATA"

# 1. Stop bridge / any process holding DBF locks
pnpm dev:kill-ports   # or stop dev:bridge manually

# 2. Remove disposable tree (backups + DATA)
rm -rf "$SANDBOX/DATA" "$SANDBOX/backups"

# 3. Recreate from read-only copy (section 5)
mkdir -p "$SANDBOX/backups"
rsync -a "$SOURCE/" "$SANDBOX/DATA/"

# 4. Recreate marker (section 6.1)
# 5. Re-export env flags; default WRITE_MODE=dry-run
```

**Optional:** Archive broken sandbox for debugging: `tar -czf ~/Desktop/microdent-sandbox-broken-$(date +%Y%m%d).tar.gz -C "$SANDBOX" .` — store outside git; delete when done.

**Legacy-Copy refresh** (if reference itself is stale, not sandbox):

```bash
# Operator procedure only — still never write to Microdent-Legacy from Modern
rsync -a --delete "/Users/Tamam/Desktop/Microdent/Microdent-Legacy/DATA/" \
  "/Users/Tamam/Desktop/Microdent/Microdent-Legacy-Copy/DATA/"
# Then recreate sandbox from Copy (above)
```

---

## 12. What is explicitly out of scope for this document

- Implementing `POST`/`PATCH` bridge routes or DBF writers.
- Changing files under `Microdent-Legacy` or `Microdent-Legacy-Copy`.
- SQLite mirror writing to operator DB files (Phase 2) — separate backup rules in [phase-2-sqlite-mirror-plan.md](phase-2-sqlite-mirror-plan.md).
- Production cutover or dual-write to legacy.

---

## 13. Definition of done (this band)

- [x] `docs/phase-3-disposable-write-sandbox.md` exists.
- [x] Sandbox path, marker schema, env flags, and safety checks documented.
- [x] No write code added; no legacy trees modified.

**Next implementation band (when approved):** `services/bridge/src/safety/write-sandbox.ts`, config loader for `WRITE_MODE` / `ALLOW_LEGACY_WRITES`, denylist tests, and first `dry-run` mutation route against sandbox only.
