# Phase 3 — Legacy restore CLI

**Status:** Implemented — file-level restore skeleton from backup manifests into a disposable write sandbox (no DBF row reads, no PHI in stdout).

**Related:** [phase-3-backup-cli.md](./phase-3-backup-cli.md), [phase-3-disposable-write-sandbox.md](./phase-3-disposable-write-sandbox.md), [phase-3-sandbox-guard.md](./phase-3-sandbox-guard.md), [phase-3-backup-restore-plan.md](./phase-3-backup-restore-plan.md).

---

## Command

From the repo root:

```bash
export BACKUP_MANIFEST="/absolute/path/to/backup/folder"
export DATA_ROOT="/absolute/path/to/disposable/DATA"
pnpm legacy:restore
```

| Variable | Required | Rule |
|----------|----------|------|
| `BACKUP_MANIFEST` | Yes | Absolute path to a folder created by `pnpm legacy:backup` (contains `manifest.json` and `files/`) |
| `DATA_ROOT` | Yes | Absolute path to legacy `DATA/` in a **disposable write sandbox** |

**Stdout** prints operation metadata and per-file `status`, `size`, and `sha256` only — never DBF row values, names, phones, or memo text.

---

## Restore flow

1. Validate `DATA_ROOT` with `validateWritableSandbox` (dry-run mode): absolute path, forbidden-tree checks, `.microdent-write-sandbox.json` with `disposable: true`.
2. Read `manifest.json` under `BACKUP_MANIFEST`.
3. **Preflight** every manifest entry: backup file exists under `files/`, size matches, sha256 matches.
4. If any preflight fails, exit with error — **no files are copied** (whole group or nothing).
5. Copy each file into `DATA_ROOT` and verify restored size and sha256.

---

## Safety checks

| Check | Failure |
|-------|---------|
| `DATA_ROOT` is absolute | `WRITE_DATA_ROOT_NOT_ABSOLUTE` |
| `DATA_ROOT` not under `Microdent-Legacy` | `WRITE_TARGET_FORBIDDEN_LEGACY` |
| `DATA_ROOT` not under `Microdent-Legacy-Copy` | `WRITE_TARGET_FORBIDDEN_LEGACY_COPY` |
| `.microdent-write-sandbox.json` present | `WRITE_SANDBOX_MARKER_MISSING` |
| Marker sets `disposable: true` | `WRITE_SANDBOX_MARKER_INVALID` |
| `BACKUP_MANIFEST` is absolute | CLI env error |
| `BACKUP_MANIFEST` not under `Microdent-Legacy` | CLI env error |
| `manifest.json` readable and valid | restore error |
| Every backup `files/` member present and verified | restore error (no partial copy) |

Restore **writes** sandbox files. It does not parse DBF rows or emit field values.

---

## Example (synthetic drill)

```bash
# 1. Create disposable sandbox with marker (see phase-3-disposable-write-sandbox.md)
# 2. Backup from sandbox or synthetic DATA_ROOT
export DATA_ROOT="/tmp/microdent-sandbox/DATA"
export BACKUP_DIR="/tmp/microdent-backups"
export WORKFLOW="appointment.statusUpdate"
pnpm legacy:backup

# 3. Restore into the same or another marked sandbox
export BACKUP_MANIFEST="/tmp/microdent-backups/20260515T120000Z__appointment.statusUpdate__abcd1234"
export DATA_ROOT="/tmp/microdent-sandbox/DATA"
pnpm legacy:restore
```

---

## Implementation

| Piece | Location |
|-------|----------|
| Core | `services/bridge/src/backup/run-legacy-restore.ts` |
| Env | `services/bridge/src/backup/restore-env.ts` |
| Hash helper | `services/bridge/src/backup/file-hash.ts` |
| CLI | `services/bridge/src/cli/legacy-restore.ts` |
| Shell | `scripts/legacy-restore.sh` |
| Root script | `pnpm legacy:restore` in root `package.json` |
| Tests | `services/bridge/src/backup/legacy-restore.test.ts` |

**Not implemented yet:** transactional rollback on mid-restore failure, `legacy:backup-verify`, manifest `dataRootRealpath` enforcement on restore.
