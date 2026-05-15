# Phase 3 — Writable sandbox guard

**Status:** Implemented guard utilities only — **no write routes**, **no DBF mutation**.

**Related:** [phase-3-disposable-write-sandbox.md](phase-3-disposable-write-sandbox.md) (operator runbook), [phase-3-dry-run-write-plan.md](phase-3-dry-run-write-plan.md) (future route modes).

---

## 1. Purpose

Future bridge mutation routes must call `validateWritableSandbox()` before any write helper runs. The guard **fails closed** unless `DATA_ROOT` points at a **disposable** sandbox marked on disk and is not one of the forbidden legacy trees.

Implementation: `services/bridge/src/write-safety/`.

---

## 2. API

```ts
import { validateWritableSandbox } from "./write-safety/index.js";

validateWritableSandbox({
  dataRoot: process.env.DATA_ROOT ?? "",
  writeMode: process.env.WRITE_MODE ?? "dry-run",
  allowLegacyWritesValue: process.env.ALLOW_LEGACY_WRITES,
});
```

On success, returns `{ ok: true, dataRoot, dataRootReal, writeMode }`.

On failure, throws `WriteSandboxError` with a stable `code` (see §4).

---

## 3. Rules

| Check | `dry-run` | `enabled` |
| --- | --- | --- |
| `DATA_ROOT` is absolute | Required | Required |
| Not `…/Microdent-Legacy` (or under it) | Required | Required |
| Not `…/Microdent-Legacy-Copy` (or under it) | Required | Required |
| `.microdent-write-sandbox.json` present under `DATA_ROOT` | **Required** | **Required** |
| Marker `disposable: true` | **Required** | **Required** |
| `ALLOW_LEGACY_WRITES=I_UNDERSTAND_THIS_IS_A_DISPOSABLE_COPY` | Not checked | **Required** |

### Dry-run and the marker

The marker is **required for `dry-run` as well as `enabled`**. Dry-run still exercises validation, path denylist, and marker semantics; it only skips the `ALLOW_LEGACY_WRITES` acknowledgement. That keeps rehearsal and integration tests from accidentally targeting `Microdent-Legacy-Copy` without creating a throwaway tree.

Recommended operator layout (outside git): see [phase-3-disposable-write-sandbox.md](phase-3-disposable-write-sandbox.md) §4–6.

---

## 4. Error codes

| Code | When |
| --- | --- |
| `WRITE_DATA_ROOT_NOT_ABSOLUTE` | Relative or non-absolute `DATA_ROOT` |
| `WRITE_TARGET_FORBIDDEN_LEGACY` | Resolves under production `Microdent-Legacy` |
| `WRITE_TARGET_FORBIDDEN_LEGACY_COPY` | Resolves under read-only `Microdent-Legacy-Copy` |
| `WRITE_SANDBOX_MARKER_MISSING` | No `.microdent-write-sandbox.json` |
| `WRITE_SANDBOX_MARKER_INVALID` | Unreadable JSON or `disposable` is not `true` |
| `WRITE_NOT_ACKNOWLEDGED` | `WRITE_MODE=enabled` without exact allow env value |
| `WRITE_MODE_INVALID` | `WRITE_MODE` is not `dry-run` or `enabled` |

Constants: `FORBIDDEN_LEGACY_ROOT`, `FORBIDDEN_LEGACY_COPY_ROOT`, `ALLOW_LEGACY_WRITES_ACK`, `WRITE_SANDBOX_MARKER`.

---

## 5. Tests

`services/bridge/src/write-safety/write-safety.test.ts` uses **temp directories only** (synthetic marker JSON). Cases cover missing marker, forbidden legacy paths, forbidden copy paths, valid temp sandbox, enabled without allow flag, relative `DATA_ROOT`, and invalid marker payload.

---

## 6. Out of scope (this band)

- `POST` / `PATCH` write routes
- DBF writers, pack, or backup execution
- Changes under `Microdent-Legacy` or `Microdent-Legacy-Copy`
- Wiring the guard into `loadBridgeConfig()` (call sites will add this when write routes land)

---

## 7. Definition of done

- [x] `write-safety` module with `validateWritableSandbox`
- [x] Unit tests (temp dirs only)
- [x] This document
- [ ] Write routes call the guard (future band)
