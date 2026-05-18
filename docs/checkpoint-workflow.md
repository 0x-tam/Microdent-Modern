# Implementation batch checkpoint workflow

After every implementation batch — before reporting completion to reviewers or operators — run this checkpoint from the repo root unless the batch is **strictly docs-only** with zero changes to code, packages, tests, or config (still run `git status` for docs-only batches).

```bash
cd /Users/Tamam/Desktop/Microdent/Microdent-Modern
nvm use 22
pnpm test
pnpm build:web
git status
```

### Write-mode env hygiene

QA and sandbox runs often export `WRITE_MODE`, `ALLOW_LEGACY_WRITES`, or `BACKUP_DIR`. Those variables leak into the same shell and can make bridge tests (e.g. `root-and-cors`) expect the wrong `writeMode`.

- **Bridge Vitest** clears `WRITE_MODE`, `ALLOW_LEGACY_WRITES`, and `BACKUP_DIR` in `beforeEach` via `services/bridge/vitest.setup.ts` (wired in `services/bridge/vitest.config.ts`), so root `pnpm test` stays reliable even if the shell still has write env set.
- **Optional:** unset before a full run: `env -u WRITE_MODE -u ALLOW_LEGACY_WRITES -u BACKUP_DIR pnpm test`
- **Sandbox write smoke** (time move + create): `scripts/qa-sandbox-write-smoke.sh` with bridge up and `SQLITE_PATH` / `BRIDGE_URL` / sandbox `DATA_ROOT` set (see [phase-3-write-safe-qa-checklist.md](./phase-3-write-safe-qa-checklist.md)).

## Required report fields

Final batch reports must include:

| Field | Notes |
| --- | --- |
| **nvm** | Whether `nvm use 22` succeeded and Node version |
| **pnpm test** | Pass/fail summary |
| **pnpm build:web** | Pass/fail summary |
| **git status** | Clean vs modified; list concerns |
| **Files changed** | Paths touched in the batch |
| **Hygiene** | Whether `git status` shows legacy trees, `*.sqlite` / `*.db`, `backups/`, or write-sandbox `DATA` |
| **Safe to commit?** | Yes/no with short rationale |

## Git staging rules

- Never use `git add .`
- Never stage legacy install trees, backup folders, SQLite mirrors, or disposable sandbox `DATA`
- Stage only intentional source, test, and doc paths under `Microdent-Modern`

## Related

- [phase-3-write-safe-qa-checklist.md](./phase-3-write-safe-qa-checklist.md) — sandbox write QA (steps 1–15)
- [README.md](../README.md) — install and local dev
