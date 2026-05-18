# Phase 3 — Legacy backup CLI

**Status:** Implemented — file-level backup skeleton for pre-write workflows (no DBF mutation, no row reads).

**Related:** [phase-3-backup-restore-plan.md](./phase-3-backup-restore-plan.md), [phase-3-disposable-write-sandbox.md](./phase-3-disposable-write-sandbox.md), [phase-3-dry-run-write-plan.md](./phase-3-dry-run-write-plan.md), [phase-3-sandbox-validation.md](./phase-3-sandbox-validation.md) (synthetic CI validation band).

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
- **Forbidden paths:** `DATA_ROOT` and `BACKUP_DIR` must not resolve under `Microdent-Legacy` or `Microdent-Legacy-Copy`.
- **Tests:** Vitest uses synthetic temp `DATA_ROOT` trees only (`services/bridge/src/backup/legacy-backup.test.ts`). For an end-to-end dry-run band across write routes, see [phase-3-sandbox-validation.md](./phase-3-sandbox-validation.md).

---

## Implementation

| Piece | Location |
|-------|----------|
| Core | `services/bridge/src/backup/run-legacy-backup.ts` |
| Env | `services/bridge/src/backup/backup-env.ts` |
| CLI | `services/bridge/src/cli/legacy-backup.ts` |
| Shell | `scripts/legacy-backup.sh` |
| Root script | `pnpm legacy:backup` in root `package.json` |

**Also available:** `pnpm legacy:backup-verify` — read-only manifest hash check (see below).

**Not implemented yet:** disk-space preflight, header-only catalog counts in manifest.

**Restore:** see [phase-3-restore-cli.md](./phase-3-restore-cli.md) (`pnpm legacy:restore`).

### Web UI feedback (sandbox pilot)

After a committed appointment status change in the dev pilot UI (`AppointmentStatusWriteAction`), the operator sees PHI-safe lines only:

- **Operation** — UUID from the write plan (`operationId`)
- **Backup** — whether `backupWouldCreate` / `backupRequired` indicated a backup for that commit (no manifest paths or file names)
- **Audit** — summary from `GET /v1/meta/write-audit-recent` (entry count, whether the operation id appears, terminal status when matched)

Helpers live in `packages/app/src/write-operation-feedback.ts`. Full backup folders and manifest rows are never shown in the browser.

### Verify (read-only)

```bash
export BACKUP_MANIFEST="/absolute/path/to/backups/<folder>"
pnpm legacy:backup-verify

# Optional: confirm live DATA_ROOT still matches the manifest
export DATA_ROOT="/absolute/path/to/disposable/DATA"
pnpm legacy:backup-verify
```

| Piece | Location |
|-------|----------|
| Core | `services/bridge/src/backup/verify-legacy-backup.ts` |
| CLI | `services/bridge/src/cli/legacy-backup-verify.ts` |
| Shell | `scripts/legacy-backup-verify.sh` |
