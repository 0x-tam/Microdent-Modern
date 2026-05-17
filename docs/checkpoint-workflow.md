# Implementation batch checkpoint workflow

After every implementation batch — before reporting completion to reviewers or operators — run this checkpoint from the repo root unless the batch is **strictly docs-only** with zero changes to code, packages, tests, or config (still run `git status` for docs-only batches).

```bash
cd /Users/Tamam/Desktop/Microdent/Microdent-Modern
nvm use 22
pnpm test
pnpm build:web
git status
```

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
