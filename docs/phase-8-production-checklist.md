# Phase 8 — Production checklist

**Status:** Operator and engineering checklist for packaged / pilot deployments.

## Write safety defaults

| Setting | Production default | Notes |
| --- | --- | --- |
| `WRITE_MODE` | `disabled` | Set in `%AppData%\Microdent\config.json` for packaged builds |
| `ALLOW_LEGACY_WRITES` | unset | Only on disposable sandbox copies |
| `BACKUP_DIR` | operator path | Required before any enabled write |
| `DATA_ROOT` | absolute copy path | Never `Microdent-Legacy` |

Payment and ledger DBF writes remain **out of scope** until explicit approval.

## Pre-pilot verification

- [ ] `pnpm test` green on Node 22
- [ ] `pnpm build:web` succeeds
- [ ] Bridge binds `127.0.0.1` only
- [ ] Disposable sandbox marker present before write drills
- [ ] Backup → write → restore rehearsed per workflow
- [ ] No PHI in bridge logs or API error bodies
- [ ] Mirror import run from copied `DATA` only

## Packaged desktop

- [ ] `WRITE_MODE=disabled` in default config template
- [ ] First-run wizard sets `DATA_ROOT` / optional `SQLITE_PATH`
- [ ] Bridge supervised; health probe before UI load
- [ ] Quit stops bridge child (no orphan listener on `17890`)

## Security / privacy

- [ ] Forbidden-token tests pass (`pnpm test`)
- [ ] Rate limit returns `429 RATE_LIMITED` under abuse (see `services/bridge/src/rate-limit.ts`)
- [ ] No raw DBF rows in responses or audit payloads
- [ ] Payment amounts UI still blocked in app

## Related

- [phase-8-log-redaction-review.md](./phase-8-log-redaction-review.md)
- [phase-3-write-safe-qa-checklist.md](./phase-3-write-safe-qa-checklist.md)
- [phase-3-desktop-packaging-plan.md](./phase-3-desktop-packaging-plan.md)
