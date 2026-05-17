# Phase 3 — Write mode configuration

**Status:** Implemented — `WRITE_MODE` parsing, dev diagnostics, and appointment status route gating.

**Scope:** Safe `WRITE_MODE` env parsing for mutation routes. All automated tests use **synthetic fixtures**; operators use **Microdent-Legacy-Copy** read-only for reference data and a **disposable write sandbox** for enabled commits.

**Related:** [phase-3-dry-run-write-plan.md](./phase-3-dry-run-write-plan.md), [phase-1a-safety-module.md](./phase-1a-safety-module.md), [master-build-plan.md](./master-build-plan.md).

---

## 1. `WRITE_MODE` values

| Value | Meaning | Default |
| --- | --- | --- |
| `disabled` | Mutation routes return **403** `WRITE_MODE_DISABLED`. | **Yes** — unset or invalid env resolves here. |
| `dry-run` | Validate and return a safe write plan only (`committed: false`). | No |
| `enabled` | Commit after backup, audit (when `SQLITE_PATH` set), and sandbox gates. | No |

**Parsing (bridge startup):**

- Read `process.env.WRITE_MODE`; trim; lowercase.
- Missing, empty, whitespace-only, or unknown value → **`disabled`** (fail closed; no throw).
- Valid values validated with `WriteModeSchema` in `@microdent/contracts`.

**Startup log:** `server.ts` logs `writeMode=<enum>` only (no paths, payloads, or PHI).

---

## 2. Code locations

| Area | Path |
| --- | --- |
| Env parsing | `services/bridge/src/config.ts` — `parseWriteModeFromValue`, `loadWriteModeFromEnv`, `loadBridgeConfig` |
| Write gate | `services/bridge/src/config.ts` — `writesPermitted()`, `isWritableSandboxReady()` |
| Zod contracts | `packages/contracts/src/write-mode.ts` — `WriteModeSchema`, `BridgeDevStatusResponseSchema` |
| Dev surface | `GET /debug/status` (non-`production` only) — `writeMode`, `writesPermitted`, `writableSandbox` |
| Status route | `PATCH /v1/schedule/appointments/:appointmentId/status` |
| Tests | `services/bridge/src/config.test.ts`, `services/bridge/src/root-and-cors.test.ts`, `appointment-status-*.test.ts` |

`GET /health` is unchanged (production-safe). Write mode is **not** on normal clinic read UI in production builds.

---

## 3. `writesPermitted` and sandbox readiness

| Diagnostic | When true |
| --- | --- |
| `writesPermitted` | `WRITE_MODE=enabled` **and** `BACKUP_DIR` configured **and** `DATA_ROOT` configured |
| `writableSandbox` | `DATA_ROOT` passes disposable sandbox marker guard **and** `ALLOW_LEGACY_WRITES` ack (when required) **and** write mode ≠ `disabled` |

`writesPermitted` does **not** bypass per-request sandbox checks on commit.

---

## 4. Operator runbook

```bash
# Default — bridge starts with writes impossible
unset WRITE_MODE

# Plan-only rehearsal
export WRITE_MODE=dry-run
export DATA_ROOT="/absolute/path/to/disposable-sandbox/DATA"

# Sandbox commit band
export WRITE_MODE=enabled
export BACKUP_DIR="/absolute/path/outside/repo/backups"
export ALLOW_LEGACY_WRITES=I_UNDERSTAND_THIS_IS_A_DISPOSABLE_COPY
# Optional audit: export SQLITE_PATH="/absolute/path/to/mirror.sqlite"
```

See [phase-3-appointment-status-write-runbook.md](./phase-3-appointment-status-write-runbook.md) for the full 15-step QA flow.

---

## 5. Dev diagnostics

Non-production only:

```http
GET /debug/status
```

Example (enabled + backup + sandbox ready):

```json
{
  "writeMode": "enabled",
  "writesPermitted": true,
  "writableSandbox": true
}
```

Example (enabled but missing backup):

```json
{
  "writeMode": "enabled",
  "writesPermitted": false,
  "writableSandbox": false
}
```

---

## 6. Tests

| Case | Expected |
| --- | --- |
| Unset `WRITE_MODE` | `disabled` |
| Invalid `WRITE_MODE` | `disabled` (no startup throw) |
| `dry-run` | parses; `writesPermitted === false` |
| `enabled` without `BACKUP_DIR` | parses; `writesPermitted === false` |
| `enabled` with `BACKUP_DIR` + `DATA_ROOT` | `writesPermitted === true` |

---

## 7. Non-goals

- No writes against production `Microdent-Legacy` paths
- No patient/profile mutation routes in this band
- No change to `GET /health` production contract
