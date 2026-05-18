# Windows MVP batch report — 2026-05-19

**Repo:** `/Users/Tamam/Desktop/Microdent/Microdent-Modern`  
**Branch:** `main` (uncommitted working tree)  
**Coordinator checkpoint:** 2026-05-18 (local)  
**Commit policy:** Do not commit until `pnpm qa:sandbox` is green (this run failed).

## Agents (7/7 delivered)

| Agent | Scope (inferred) | Batch verdict |
| --- | --- | --- |
| DesktopMVP | `apps/desktop` setup, path validation, bridge supervisor, main | Delivered — unit tests in `pnpm test` (desktop not in root test script; desktop tests run via workspace if invoked separately) |
| SandboxQA | `scripts/qa-sandbox-*`, preflight, write smoke | Delivered — **integration FAIL** at sqlite readback (see checkpoint) |
| MirrorOps | `services/sqlite-mirror`, bridge mirror status | Delivered — mirror/sqlite-mirror tests pass |
| DocsRunbooks | `docs/phase-*`, operator guides | Delivered — doc-only changes, no legacy dirs |
| ClinicProduct | schedule, patient flows, today dashboard, read-only copy | Delivered — app tests pass |
| SettingsDash | `SettingsPanel`, settings status, shell banners | Delivered — settings/shell tests pass |
| PrivacyStability | `mask-operator-path`, AppShell fetch cleanup, write safety band | Delivered — privacy/masking tests pass |

## Mandatory checkpoint

| Step | Command / action | Result | Notes |
| --- | --- | --- | --- |
| Node | `nvm use 22` | **PASS** | v22.22.3 |
| Unit/integration tests | `pnpm test` | **PASS** | contracts 3; sqlite-mirror 42; bridge 302 (+4 skipped); bridge-client 36; ui 10; app 261 |
| Web build | `pnpm build:web` | **PASS** | Vite production build OK |
| Sandbox env | `DATA_ROOT`, `SQLITE_PATH`, `BACKUP_DIR` | **SET** | Write-sandbox paths (not in git) |
| Port cleanup | `lsof -ti :17890 \| xargs kill -9` | **OK** | |
| Sandbox QA | `pnpm qa:sandbox` | **FAIL** | `appointment.statusUpdate` commit HTTP 200 but sqlite readback: expected `status_code=1`, got `0` |
| Git snapshot | `git status` | **DIRTY** | 41 modified, 4 untracked; nothing staged |

### Sandbox failure excerpt

```
[qa-write-smoke] workflow=appointment.statusUpdate phase=commit http=200 ... committed=true
[qa-write-smoke] FAIL: sqlite readback workflow=appointment.statusUpdate expected_status_code=1 got=0
```

## Merge sanity (coordinator)

| Area | Finding |
| --- | --- |
| `read-only-ui-copy.ts` | Single source in `packages/app` only; no desktop duplicate |
| `AppShell.tsx` / `today-dashboard.tsx` | Single app package copies; coherent diffs (health-check stale guard, settings banner dedupe) |
| `maskOperatorPath` | **Intentional duplication:** `packages/app/src/mask-operator-path.ts` vs `apps/desktop/src/path-validation.ts` — different masking rules and empty-path labels (`…` vs `(not set)`). Not a merge conflict; document as cross-surface consistency risk |

No conflict markers or duplicate filenames requiring resolution.

## Git hygiene / legacy sentinels

| Check | Status |
| --- | --- |
| `Legacy/` or `Legacy-Copy/` in diff or untracked | **PASS** — none |
| `.sqlite`, Write-Sandbox `DATA`, or `backups` tracked/staged | **PASS** — none in `git status` / changed paths |
| Secrets in tree | Not scanned; env paths are local exports only |

**Modified (41):** desktop (7), docs (4), app (27), scripts (3), bridge/sqlite-mirror (6)  
**Untracked (4):** `docs/phase-6-windows-mvp-operator-guide.md`, `packages/app/src/app-shell-fetch-cleanup.test.tsx`, `scripts/qa-sandbox-preflight.sh`, `services/bridge/src/write-safety/write-route-safety-band.test.ts`

## Safe to commit?

**No (recommended hold)** — `pnpm qa:sandbox` failed on post-commit sqlite readback for `appointment.statusUpdate`. Unit tests and web build are green; treat as **merge-ready for review** but **not release-ready** until sandbox smoke passes.

If committing doc/script-only slices before the fix, split PRs explicitly and do not claim sandbox-green.

## Risks

1. **Sandbox sqlite readback drift** — write commit succeeds but mirror/SQLite appointment status does not match DBF expectation; blocks operator confidence for status writes.
2. **Dual `maskOperatorPath` implementations** — operators may see different masked strings in Electron logs vs web settings hints.
3. **Large app surface diff** — many panels touched; regression risk outside vitest (manual schedule/settings/today flows).
4. **Vitest `act(...)` warnings** — noisy stderr in app tests; not failing but may hide real async issues.

## Next batch (suggested)

1. **SandboxQA / MirrorOps:** Fix `appointment.statusUpdate` sqlite readback (status_code 0 vs 1); re-run full `pnpm qa:sandbox` until green.
2. **PrivacyStability (optional):** Align desktop `maskOperatorPath` with app or extract shared `@microdent/operator-path` helper.
3. **DesktopMVP:** Add desktop package to root `pnpm test` or document `pnpm --filter @microdent/desktop test` in runbook.
4. **DocsRunbooks:** Link `phase-6-windows-mvp-operator-guide.md` from phase-5 runbook after sandbox is green.
5. Re-run this coordinator checkpoint and update this report before any commit.

---

*Generated by Windows MVP batch coordinator. No git commit performed.*
