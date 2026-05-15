# Phase 3 — Create write sandbox CLI

**Status:** Implemented — copies a read-only `DATA/` tree into a disposable write sandbox with marker and `backups/` folder.

**Related:** [phase-3-disposable-write-sandbox.md](./phase-3-disposable-write-sandbox.md), [phase-3-sandbox-guard.md](./phase-3-sandbox-guard.md), [phase-3-backup-cli.md](./phase-3-backup-cli.md).

---

## Command

From the repo root:

```bash
export SOURCE_DATA_ROOT="/Users/Tamam/Desktop/Microdent/Microdent-Legacy-Copy/DATA"
export SANDBOX_ROOT="/Users/Tamam/Desktop/Microdent/Microdent-Write-Sandbox"
pnpm legacy:create-sandbox
```

| Variable | Required | Rule |
|----------|----------|------|
| `SOURCE_DATA_ROOT` | Yes | Absolute path to the **read-only** legacy `DATA/` folder to copy **from** |
| `SANDBOX_ROOT` | Yes | Absolute path to the sandbox **parent** (creates `SANDBOX_ROOT/DATA` and `SANDBOX_ROOT/backups`) |

**Stdout** prints status and entry counts only — never DBF row values, names, phones, or memo text.

---

## What it creates

| Path | Purpose |
|------|---------|
| `{SANDBOX_ROOT}/DATA/` | Full copy of `SOURCE_DATA_ROOT` |
| `{SANDBOX_ROOT}/DATA/.microdent-write-sandbox.json` | Disposable marker (`disposable: true`, realpaths, warning) |
| `{SANDBOX_ROOT}/backups/` | Writable backup root for `pnpm legacy:backup` |

Re-running the CLI replaces `{SANDBOX_ROOT}/DATA` (fresh copy + new marker). `backups/` is preserved.

---

## Safety

| Check | Behavior |
|-------|----------|
| Absolute paths only | Rejects relative `SOURCE_DATA_ROOT` / `SANDBOX_ROOT` |
| `SOURCE_DATA_ROOT` | Must **not** resolve under `Microdent-Legacy` |
| `SANDBOX_ROOT` | Must **not** resolve under `Microdent-Legacy` or `Microdent-Legacy-Copy` |
| Source read-only | Source files are copied with `fs.cp`; source tree is not modified |
| No row parsing | Does not open DBF records or log field values |
| Tests | Synthetic temp directories only (`create-write-sandbox.test.ts`) |

Typical flow: copy **from** `Microdent-Legacy-Copy/DATA` **into** `Microdent-Write-Sandbox` (outside both forbidden trees).

---

## Marker file

`DATA/.microdent-write-sandbox.json` includes:

- `disposable: true`
- `createdAt` (ISO-8601 UTC)
- `sourceDataRootRealpath`
- `sandboxDataRootRealpath`
- `warning` — disposable-only notice

Required by `validateWritableSandbox` before any future write route runs.

---

## Implementation

| Piece | Location |
|-------|----------|
| Core | `services/bridge/src/sandbox/create-write-sandbox.ts` |
| Env | `services/bridge/src/sandbox/sandbox-env.ts` |
| CLI | `services/bridge/src/cli/legacy-create-sandbox.ts` |
| Shell | `scripts/legacy-create-sandbox.sh` |
| Root script | `pnpm legacy:create-sandbox` in root `package.json` |

---

## After create

```bash
export DATA_ROOT="/Users/Tamam/Desktop/Microdent/Microdent-Write-Sandbox/DATA"
export BACKUP_DIR="/Users/Tamam/Desktop/Microdent/Microdent-Write-Sandbox/backups"
# future: WRITE_MODE=dry-run|enabled with sandbox marker + ack
```

See [phase-3-write-safe-qa-checklist.md](./phase-3-write-safe-qa-checklist.md) for full QA steps.
