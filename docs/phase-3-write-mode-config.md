# Phase 3 — Write mode configuration (foundation)

**Status:** Implemented — config parsing and dev diagnostics only. **No write routes**, **no DBF mutation**.

**Scope:** Safe `WRITE_MODE` env parsing for future mutation routes. All tests use **synthetic fixtures**; operators use **Microdent-Legacy-Copy** read-only for reference data.

**Related:** [phase-3-dry-run-write-plan.md](./phase-3-dry-run-write-plan.md), [phase-1a-safety-module.md](./phase-1a-safety-module.md), [master-build-plan.md](./master-build-plan.md).

---

## 1. `WRITE_MODE` values

| Value | Meaning | Default |
| --- | --- | --- |
| `disabled` | Future mutation routes return **403** `WRITE_MODE_DISABLED`. | **Yes** — unset or invalid env resolves here. |
| `dry-run` | Future routes may validate and return a safe write plan only. | No |
| `enabled` | Future routes may commit after backup, audit, and sandbox gates. | No |

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
| Write gate stub | `services/bridge/src/config.ts` — `writesPermitted()` always **`false`** until write routes and companion flags ship |
| Zod contracts | `packages/contracts/src/write-mode.ts` — `WriteModeSchema`, `BridgeDevStatusResponseSchema` |
| Dev surface | `GET /debug/status` (non-`production` only) — `writeMode`, `writesPermitted` |
| Tests | `services/bridge/src/config.test.ts`, `services/bridge/src/root-and-cors.test.ts` |

`GET /health` is unchanged (production-safe). Write mode is **not** on `/v1/*` read routes or normal clinic UI.

---

## 3. Operator runbook (future writes)

```bash
# Default — bridge starts with writes impossible
unset WRITE_MODE

# Plan-only rehearsal (when mutation routes exist)
export WRITE_MODE=dry-run
export DATA_ROOT="/absolute/path/to/synthetic-or-copy/DATA"

# Real commit band (not active in this foundation)
export WRITE_MODE=enabled
# Requires WRITE_BACKUP_DIR, WRITE_AUDIT_LOG, sandbox marker, etc. — see dry-run plan
```

Setting `WRITE_MODE=enabled` **today** only changes config and dev diagnostics; **`writesPermitted` remains false** and no mutation endpoints exist.

---

## 4. Dev diagnostics

Non-production only:

```http
GET /debug/status
```

Example body:

```json
{
  "writeMode": "disabled",
  "writesPermitted": false
}
```

Use with local preview / bridge dev scripts to confirm env before enabling future dry-run routes.

---

## 5. Tests

| Case | Expected |
| --- | --- |
| Unset `WRITE_MODE` | `disabled` |
| Invalid `WRITE_MODE` | `disabled` (no startup throw) |
| `dry-run` | parses |
| `enabled` | parses; `writesPermitted === false` |

---

## 6. Non-goals (this band)

- No `POST` / `PATCH` mutation routes under `/v1`
- No DBF `writeFile`, pack, or backup implementation
- No change to `GET /health` or patient-facing UI
- No modification of `Microdent-Legacy` or writable use of legacy paths

**Next band (when approved):** write sandbox denylist, `WRITE_ALLOWED_WORKFLOWS`, first dry-run mutation route per [phase-3-dry-run-write-plan.md](./phase-3-dry-run-write-plan.md).
