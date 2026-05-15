# Phase 3 — Legacy backup CLI

**Status:** Implemented — file-level backup skeleton for pre-write workflows (no DBF mutation, no row reads).

**Related:** [phase-3-backup-restore-plan.md](./phase-3-backup-restore-plan.md), [phase-3-disposable-write-sandbox.md](./phase-3-disposable-write-sandbox.md), [phase-3-dry-run-write-plan.md](./phase-3-dry-run-write-plan.md).

---

## Command

From the repo root:

```bash
export DATA_ROOT="/absolute/path/to/disposable/DATA"
export BACKUP_DIR="/absolute/path/to/backups"
export WORKFLOW="appointment.statusUpdate"
pnpm legacy:backup
```

| Variable | Required | Rule |
|----------|----------|------|
| `DATA_ROOT` | Yes | Absolute path to legacy `DATA/` (disposable copy or sandbox — **not** `Microdent-Legacy`) |
| `BACKUP_DIR` | Yes | Absolute path; timestamped folders are created here |
| `WORKFLOW` | Yes | Workflow id selecting the table group (see below) |

**Stdout** prints operation metadata and per-file `size` + `sha256` only — never DBF row values, names, phones, or memo text.

---

## Supported workflows

| Workflow | Files backed up |
|----------|-----------------|
| `appointment.statusUpdate` | `SCHEDULE.DBF` (required), `SCHEDULE.FPT` and `SCHEDULE.CDX` when present |

Additional workflows will be added when write bands are implemented.

---

## Backup layout

Each run creates one directory:

```text
{BACKUP_DIR}/{utcTimestamp}__{workflow}__{shortOpId}/
  manifest.json
  files/
    SCHEDULE.DBF
    SCHEDULE.FPT    # when present under DATA_ROOT
    SCHEDULE.CDX    # when present under DATA_ROOT
```

### `manifest.json`

| Field | Description |
|-------|-------------|
| `operationId` | 32-char hex correlation id |
| `workflow` | e.g. `appointment.statusUpdate` |
| `createdAt` | ISO-8601 UTC timestamp |
| `dataRootRealpath` | `realpath` of `DATA_ROOT` at backup time |
| `files` | Array of `{ filename, size, sha256 }` |

---

## Safety

- **Read-only source:** Files are opened for read and copied with `copyFile`; source DBFs are not modified.
- **No row parsing:** Backup does not call `readRecords` or emit field values.
- **Forbidden path:** `DATA_ROOT` and `BACKUP_DIR` must not resolve under `/Users/Tamam/Desktop/Microdent/Microdent-Legacy`.
- **Tests:** Vitest uses synthetic temp `DATA_ROOT` trees only (`services/bridge/src/backup/legacy-backup.test.ts`).

---

## Implementation

| Piece | Location |
|-------|----------|
| Core | `services/bridge/src/backup/run-legacy-backup.ts` |
| Env | `services/bridge/src/backup/backup-env.ts` |
| CLI | `services/bridge/src/cli/legacy-backup.ts` |
| Shell | `scripts/legacy-backup.sh` |
| Root script | `pnpm legacy:backup` in root `package.json` |

**Not implemented yet:** `legacy:restore`, `legacy:backup-verify`, disk-space preflight, header-only catalog counts in manifest.
