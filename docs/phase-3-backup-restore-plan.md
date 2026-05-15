# Phase 3 — Backup and restore architecture (pre-write gate)

**Status:** Design only — **no write code**, **no legacy file mutations**, **no PHI in this document.**

**Goal:** Define a safe backup/restore system for **copied legacy `DATA`** before any appointment edits, patient edits, or other DBF mutations are implemented in Microdent-Modern.

**Related docs:** [master-build-plan.md](./master-build-plan.md) §6–8, [phase-1a-safety-module.md](./phase-1a-safety-module.md), [legacy-system-map.md](./legacy-system-map.md) §6–9, [phase-1b-route-inventory.md](./phase-1b-route-inventory.md).

---

## 1. Scope and non-goals

### In scope (this phase)

- File-level backup and restore of FoxPro/VFP **table sets** under a configured `DATA_ROOT`.
- Operator runbooks, naming, verification, and failure handling.
- Future CLI surface (`pnpm legacy:backup`, `pnpm legacy:restore`) — **specified here, not implemented**.
- Automated tests using **synthetic** `.dbf` / `.fpt` / `.cdx` only.

### Out of scope (explicit)

- Implementing DBF row writes, `PACK`, `REINDEX`, legacy **EXE** execution, or bridge mutation routes.
- Backing up or modifying **`/Users/Tamam/Desktop/Microdent/Microdent-Legacy`** (forbidden tree).
- SQLite mirror backup (optional later); Phase 3 focuses on **authoritative legacy DBF sidecars**.
- Full-tree `DATA` snapshots (supported as an **operator** option, but default is **per-operation table group**).

---

## 2. Principles

1. **Copy-first:** All development and pilot writes run only against a **disposable duplicate** (e.g. `Microdent-Legacy-Copy/DATA`), never the sole production backup or the original legacy install.
2. **DBF never alone:** A backup unit always includes the target **`.DBF`** plus every **companion file that exists** for that basename (`.FPT`, `.CDX`, and DBC triplets when the table participates in a database container).
3. **Backup before write:** No mutation API or CLI may run unless the pre-write backup succeeded and was verified (checksum manifest written).
4. **Restore is whole table group:** Partial file restore across a workflow group is forbidden — restore the entire group from one backup operation.
5. **No PHI in artifacts:** Backup manifests record basenames, byte sizes, and hashes only — never row payloads, memo text, or field values.
6. **Outside git:** Backup roots must not live inside the Modern repo working tree.

---

## 3. What must be backed up before any write

### 3.1 Per-table minimum set

For each logical table **basename** `TABLE` (e.g. `SCHEDULE`):

| Artifact | Include when | Why |
|----------|----------------|-----|
| `TABLE.DBF` | Always | Primary table file |
| `TABLE.FPT` | Present on disk | Memo columns; DBF without FPT breaks memo fields |
| `TABLE.CDX` | Present on disk | Structural / tag indexes; legacy app and some readers assume indexes |
| `TABLE.DCT` / `TABLE.DCX` | Present and table is DBC-bound | Database container metadata (rare for single-table edits; include if present) |

**Rule:** At backup time, scan `DATA_ROOT` for `TABLE.{DBF,FPT,CDX,DCT,DCX}` (case-insensitive on Windows). Copy every file that exists. If `.DBF` exists but expected `.FPT` is missing while the schema has memo fields, **abort the write** (data may already be inconsistent).

### 3.2 Workflow table groups

A **table group** is the atomic backup/restore unit for one user or API workflow. Back up **all members** before the first byte of the workflow’s write sequence.

#### Group A — `appointment_edit`

Touches scheduling and possibly denormalized patient fields on appointments.

| Basename set | Role |
|--------------|------|
| `SCHEDULE` | Canonical appointment rows (+ `COMMENT` memo) |
| `IDS` | Singleton ID counters — **required** if the workflow allocates new `SCHEDULE.ID` values |
| `PATIENT` | **Conditional** — include if the implementation updates denormalized `PAT_NAME` / `TELEPHONE` on `SCHEDULE` when patient display data changes |

Reference-only (read in Phase 1, usually **not** written): `SC_ROOM`, `DICSCHED` — omit unless a future write band explicitly mutates them.

#### Group B — `patient_demographics_edit`

Touches master patient and dependent indexes.

| Basename set | Role |
|--------------|------|
| `PATIENT` | Master patient row (+ memos such as `QUICKNOTE` if ever written) |
| `PAT1` | Lightweight patient index copy (if present — legacy may sync) |
| `_patshet` | Scheduler/search sheet (if present) |
| `IDS` | **Required** if allocating new `PATIENT.ID` |
| `HISTORY` | **Conditional** — if workflow appends audit rows |
| `SCHEDULE` | **Conditional** — if name/phone denormalization on appointments is updated in the same transaction |

Phone subgraph (future): `PHONETAB`, `PHN_TEL` — add to this group when phone write paths exist.

#### Group C — `appointment_and_patient_linked_edit`

Use when a single API operation can change **both** `SCHEDULE` and `PATIENT` (or denormalized schedule fields derived from patient). **Union of Group A + Group B** members, de-duplicated by basename.

#### Group D — `id_allocator_touch`

Any write that increments counters in `IDS.DBF` without touching other tables still backs up:

| Basename set | Role |
|--------------|------|
| `IDS` | Singleton counter row — corruption affects entire practice key space |

#### Groups reserved (not Phase 3 first writes)

Document now; implement backup profiles when those writes are scheduled:

| Group id | Basenames (indicative) |
|----------|-------------------------|
| `treatment_post` | `OPERTBL`, `IDS`, optionally `TRANS`, `CHARTDBF` |
| `ledger_post` | `TRANS`, `_transto`, `IDS`, `ACCOUNTS`, `ACCTRAN` |
| `chart_edit` | `CHARTDBF`, `CHARTTMP`, `CHARTFLG` |
| `medical_edit` | `MEDICAL` |

### 3.3 Registry-driven discovery

`LEGACY_CATALOG_REGISTRY` lists common tables but is **not** sufficient alone for backup scope. Backup profiles must be keyed by **workflow id** (above), not by catalog id. Optionally cross-check: every basename in a profile must resolve under `DATA_ROOT` via the same path sandbox as the bridge (`resolvePathWithinDataRoot`).

---

## 4. Recommended backup location

| Requirement | Recommendation |
|-------------|----------------|
| Outside git | Default root: `~/.microdent/backups/` or `/var/local/microdent/backups/` (operator-chosen, absolute) |
| Timestamped | One directory per backup operation (see §5) |
| Per operation | Never append into a previous backup folder |
| Writable | User running the bridge/CLI must have create + fsync |
| Not legacy originals | Must not be under `Microdent-Legacy/` or committed as part of Modern |

**Environment variable (future):** `LEGACY_BACKUP_ROOT` — absolute path; validated at CLI startup the same way as `DATA_ROOT` (absolute, normalized, not equal to forbidden paths).

**Optional cold storage:** Operators may copy a completed backup folder to external disk; Modern tooling only needs a local fast path for restore drills.

---

## 5. Backup naming scheme

```
{LEGACY_BACKUP_ROOT}/{utcTimestamp}__{workflowId}__{shortOpId}/
```

| Component | Format | Example |
|-----------|--------|---------|
| `utcTimestamp` | `YYYYMMDDTHHmmssZ` | `20260515T143022Z` |
| `workflowId` | snake_case from §3.2 | `appointment_edit` |
| `shortOpId` | 8-char hex from `crypto.randomBytes(4)` | `a1b2c3d4` |

**Example path:**

`~/.microdent/backups/20260515T143022Z__appointment_edit__a1b2c3d4/`

### Contents of each backup folder

```
manifest.json          # metadata, no row values
files/
  SCHEDULE.DBF
  SCHEDULE.FPT
  SCHEDULE.CDX
  IDS.DBF
  ...
```

### `manifest.json` (schema sketch)

| Field | Type | Notes |
|-------|------|-------|
| `version` | `1` | Manifest format version |
| `createdAt` | ISO-8601 UTC | Backup start |
| `completedAt` | ISO-8601 UTC | After fsync |
| `workflowId` | string | e.g. `appointment_edit` |
| `operationId` | string | Correlates logs; no PHI |
| `dataRoot` | string | **Absolute** path at backup time |
| `dataRootRealpath` | string | `realpath` of `DATA_ROOT` |
| `files` | array | `{ "basename", "relativePath", "sizeBytes", "sha256" }` |
| `preWriteCatalog` | object | Optional: `{ basename: { recordCount, fieldCount } }` from header-only reads |

**Never store:** row samples, memo excerpts, phone digits, names, addresses, amounts.

---

## 6. Backup procedure (operator + future CLI)

### 6.1 Steps

1. Resolve `DATA_ROOT` → `realpath`; run **pre-write checks** (§10).
2. Select **workflow table group** (§3.2).
3. Create backup directory (§5).
4. For each basename in the group:
   - Open files **read-only** (reuse `openReadOnlyUnderDataRoot` semantics).
   - Stream copy to `files/` preserving basename case as found on disk.
   - Compute SHA-256 per file; record in manifest.
5. Optionally capture **header-only** `recordCount` / `fieldCount` per `.DBF` (same as legacy catalog reader — no `readRecords`).
6. Write `manifest.json`, `fsync` directory.
7. Verify backup (§8) — if verification fails, **delete incomplete folder** or mark `status: failed` and block writes.

### 6.2 Concurrency

- Assume **exclusive access** to `DATA_ROOT` during backup+write (no legacy FoxPro app, no second Modern writer).
- Document: reading during backup is OK for read-only bridge; **writing** during backup is undefined — pre-write check should detect file size/mtime drift (optional future).

### 6.3 Disk space

Before copy: `sum(sizeBytes)` for all group members × **1.1** margin must be available on `LEGACY_BACKUP_ROOT` volume. Fail with `INSUFFICIENT_DISK_SPACE` if not.

---

## 7. Restore procedure

### 7.1 When to restore

- Write API returned error after partial flush.
- Post-write verification failed (§8).
- Operator cancelled a dry-run that still touched files (should not happen — dry-run must not open write handles).
- Deliberate rollback after QA on a disposable copy.

### 7.2 Steps

1. **Stop** bridge write mode and ensure no legacy EXE holds files open.
2. Validate manifest: version, `workflowId`, `dataRootRealpath` matches current `DATA_ROOT` realpath (or operator explicitly passes `--force` on a disposable copy only).
3. For each file in `manifest.files`:
   - Copy `files/{basename}` → `DATA_ROOT/{basename}` (overwrite).
4. `fsync` each restored file and parent directory.
5. Run **restore verification** (§8).
6. Append an **audit log entry** (future): `{ operationId, action: "restore", backupPath, timestamp }` — no PHI.

### 7.3 Atomicity strategy

True atomic rename across DBF+FPT+CDX is OS-dependent. Mitigations:

- Restore **all group files** before allowing reads/writes again.
- Prefer restoring to a **staging subfolder** under `DATA_ROOT` (`.restore-staging/`) then rename into place in one batch (future implementation detail).
- If any file in the group fails to restore, **re-run full restore** from the same backup folder — do not leave a mixed state.

---

## 8. How to verify backup and restore worked

### 8.1 Backup verification (immediate)

| Check | Method |
|-------|--------|
| File integrity | Re-hash each file in `files/`; compare to `manifest.json` `sha256` |
| Completeness | Every group basename accounted for; note missing optional sidecars in manifest with `"present": false` |
| Size | `sizeBytes` matches on disk |
| No empty DBF | `sizeBytes > 32` for non-trivial tables (synthetic tests except empty fixtures) |

### 8.2 Post-restore verification

| Check | Method |
|-------|--------|
| Byte identity | Hashes of live `DATA_ROOT` files match manifest |
| Header stability | `recordCount` / `fieldCount` match `preWriteCatalog` in manifest (detects truncated writes) |
| Bridge catalog | `GET /v1/legacy/catalog` — compare counts only, not row data |
| Spot functional | Re-run read-only route smoke for workflow (e.g. schedule date range returns expected **count** shape in tests — synthetic data only) |

### 8.3 Failed verification → action

- **Do not** attempt another write.
- Restore from the same backup (§7) or, on disposable copy only, re-copy from a known-good golden duplicate.

---

## 9. Failed writes

| Scenario | Detection | Response |
|----------|-----------|----------|
| Write never started | Backup succeeded; mutation aborted pre-flush | No restore needed; keep backup for audit |
| Write aborted mid-transaction | Application error; optional file size / hash mismatch vs manifest | **Full table group restore** (§7) |
| Write reported success but verification failed | Post-write checks (§8.2) | **Full table group restore**; file incident report with `operationId` only |
| `IDS.DBF` touched, others not | Catalog shows `IDS` header drift | Restore Group D or full group that included `IDS` |

**Logging:** Error codes and `operationId`, `workflowId`, basename list — never log field values or memos.

**Legacy app:** After restore, advise operator to open the **copy** in legacy only after confirming no exclusive lock from Modern.

---

## 10. Partial writes

Partial writes are the highest-risk failure mode (e.g. `SCHEDULE.DBF` updated but `SCHEDULE.FPT` not, or `IDS` incremented but row not inserted).

### Detection heuristics

- **File-level:** hash or size mismatch vs manifest for any member of the table group.
- **Header-level:** `recordCount` changed on one table but paired table in group unchanged when workflow requires coupled updates.
- **Cross-file:** DBF mtime newer than FPT/CDX by more than workflow tolerance (implementation-specific threshold).
- **Allocator:** `IDS` counter increased without corresponding new row in target table (requires workflow-specific validation rules).

### Response

1. Treat the operation as **failed** even if HTTP 200 was returned.
2. **Restore entire table group** from the pre-write backup — never restore only `SCHEDULE.DBF` without `SCHEDULE.FPT` / `SCHEDULE.CDX`.
3. On disposable copy: if restore fails, **re-clone** `DATA` from golden duplicate rather than repairing in place.

**Prevention (future implementation):**

- Single write session per operation with ordered flush: FPT → DBF or temp files + rename pattern documented per library capabilities.
- Two-phase: write to `*.partial` siblings, verify, then rename — still requires group-level commit.

---

## 11. Prevent backup folders from being committed

1. **Never** set `LEGACY_BACKUP_ROOT` inside `Microdent-Modern/`.
2. Add to root `.gitignore` (when implementing CLI):

   ```
   # Phase 3 legacy backups (must stay outside repo; belt-and-suspenders)
   .microdent-backups/
   legacy-backups/
   ```

3. CI: fail if `git ls-files` matches `*.dbf` outside `services/bridge/fixtures/sandbox/FAKE_TINY.dbf`.
4. Document in operator README: backups may contain **real PHI** if pointed at a real copy — treat backup disks as confidential media.

---

## 12. Avoid backing up the original Microdent-Legacy folder

| Guard | Implementation (future) |
|-------|-------------------------|
| Path denylist | Reject `DATA_ROOT` or `LEGACY_BACKUP_ROOT` whose `realpath` is under `Microdent-Legacy` (exact path list configured per machine) |
| Allowlist pattern | Require `DATA_ROOT` to match operator pattern e.g. `Microdent-Legacy-Copy/DATA` or explicit `MICRODENT_DATA_COPY=1` |
| Startup fatal | Bridge in write mode refuses start if `dataRoot.realPath` contains `/Microdent-Legacy/` but not `Legacy-Copy` |
| Docs / scripts | Mirror `scripts/mirror-import-safe.sh` warning: **Never point DATA_ROOT at production Microdent-Legacy** |

**Read-only analysis** may still use `Microdent-Legacy-Copy`; **writes and backups** only on disposable copies whose loss is acceptable.

---

## 13. Disposable copied DATA first

### Rollout order

1. **Synthetic** temp `DATA_ROOT` in tests — prove backup/restore/verify.
2. **Dedicated lab copy** — full `DATA` duplicate on a scratch disk, not the operator’s only backup.
3. **Pilot** — one workstation, write flag on, legacy app closed.
4. **Production** — only after restore drills, checksum manifests, and explicit sign-off; still prefer legacy app off during writes.

### Golden copy

Maintain an immutable **golden** duplicate (checksum manifest checked monthly). Lab writes that corrupt data are fixed by **re-copy from golden**, not incremental repair.

---

## 14. Required pre-write checks

All must pass before any byte is written to `DATA_ROOT`:

| # | Check | Failure code (suggested) |
|---|--------|---------------------------|
| 1 | `DATA_ROOT` set and **absolute** | `DATA_ROOT_NOT_CONFIGURED` / `DATA_ROOT_NOT_ABSOLUTE` |
| 2 | `DATA_ROOT` exists; `realpath` resolves | `DATA_ROOT_NOT_FOUND` |
| 3 | **Write mode explicitly enabled** — e.g. `LEGACY_DBF_WRITES_ENABLED=1` (exact name TBD); default off | `WRITES_DISABLED` |
| 4 | `DATA_ROOT` **not** under forbidden `Microdent-Legacy` path (§12) | `DATA_ROOT_FORBIDDEN` |
| 5 | Optional: `MICRODENT_DATA_COPY_ACK=1` when path does not match lab copy pattern | `DATA_ROOT_NOT_ACKNOWLEDGED` |
| 6 | **Backup succeeded** for the workflow’s table group; manifest `status: complete` | `BACKUP_REQUIRED` |
| 7 | **Backup verified** (§8.1) | `BACKUP_VERIFICATION_FAILED` |
| 8 | **Disk space** on backup volume (§6.3) | `INSUFFICIENT_DISK_SPACE` |
| 9 | No other write operation in progress (file lock / op token) | `WRITE_IN_PROGRESS` |
| 10 | Bridge bound to localhost; auth if enabled | (existing security posture) |

Dry-run mode (`LEGACY_DBF_WRITE_DRY_RUN=1`) must still run checks 1–5 and 8 but **must not** open write handles or mutate files.

---

## 15. Suggested future CLI

Root `package.json` scripts (not implemented in Phase 3):

```bash
# Backup only — exits 0 with manifest path on stdout
pnpm legacy:backup -- --workflow appointment_edit --data-root "$DATA_ROOT"

# Restore from a specific backup folder
pnpm legacy:restore -- --backup ~/.microdent/backups/20260515T143022Z__appointment_edit__a1b2c3d4

# Verify manifest vs disk (backup or live DATA_ROOT)
pnpm legacy:backup-verify -- --backup <path>
```

### Suggested flags

| Flag | Purpose |
|------|---------|
| `--workflow <id>` | Select table group §3.2 |
| `--data-root <path>` | Override `DATA_ROOT` |
| `--backup-root <path>` | Override `LEGACY_BACKUP_ROOT` |
| `--operation-id <id>` | Correlate with API write |
| `--dry-run` | Run checks without copying |
| `--force` | Restore only on lab copy (skip realpath match) |

### Package placement

Implement in `services/bridge` or a new `services/legacy-backup` package:

- Reuse `loadBridgeConfig`, path sandbox, read-only open helpers.
- **No** dependency on legacy EXEs.
- Shared workflow → basename map exported for write band tests.

---

## 16. Testing strategy (synthetic files only)

### Fixtures

- Generate minimal VFP-style DBF + optional FPT/CDX in temp dirs (same approach as `patient-profile-routes.test.ts`, `schedule-routes.test.ts`).
- Use fake tokens only (`SYNTH_PAT_001`, `ROOM_1`, etc.) — **never** real clinic exports.

### Test cases

| Test | Assert |
|------|--------|
| Backup happy path | All group files copied; manifest hashes match |
| Missing FPT when memo field exists | Backup/write preflight fails |
| Restore round-trip | Mutate synthetic DBF in temp; restore; byte match manifest |
| Partial write simulation | Truncate one file mid-test; detector flags; restore heals group |
| Forbidden path | `DATA_ROOT` pointing at mocked `Microdent-Legacy` → hard fail |
| Writes disabled | Without `LEGACY_DBF_WRITES_ENABLED`, backup CLI works; write shim rejects |
| Disk space | Mock `statfs` or use tiny temp volume — graceful fail |

### What not to test in CI

- Real `Microdent-Legacy-Copy` paths on developer machines.
- Record payloads or memo content in snapshots.

---

## 17. Relationship to Phase 2 SQLite mirror

- Phase 2 **imports** DBF → SQLite read model; importer already opens DBF read-only.
- After DBF writes, SQLite is **stale** until re-import — document operator step: `pnpm mirror:import-safe` from the same `DATA_ROOT` or rebuild mirror from post-restore snapshot.
- SQLite file backup is **recommended** before mirror import over a post-write DATA tree but is **not** a substitute for DBF sidecar backup.

---

## 18. Definition of done (this document)

- [x] `docs/phase-3-backup-restore-plan.md` exists
- [x] No write code implemented
- [x] No legacy files modified
- [x] No PHI or row values included

**Next implementation bands (not Phase 3):** backup CLI package, manifest schema types in `@microdent/contracts`, bridge write-gate middleware, restore drill script for lab copies.

---

## Appendix A — Quick reference: first write workflows

| Planned write | Table group id | Minimum basenames |
|---------------|----------------|-------------------|
| Reschedule / edit appointment | `appointment_edit` | `SCHEDULE` (+FPT/CDX), `IDS` if new ids |
| Edit patient demographics | `patient_demographics_edit` | `PATIENT` (+FPT/CDX), optional `PAT1`, `_patshet`, `IDS`, `SCHEDULE` if denormalized |
| Combined | `appointment_and_patient_linked_edit` | Union of above |

Always consult [legacy-system-map.md](./legacy-system-map.md) before expanding groups — `IDS.DBF` and memo/index coupling are **Critical** severity.
