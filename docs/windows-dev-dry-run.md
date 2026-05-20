# Windows dev dry-run (macOS / Linux)

**Purpose:** Simulate pilot packaging checks from a developer machine before real Windows testing.

**Does not replace** Windows validation: SmartScreen, file locking, UNC shares, and Electron-on-Win behavior require a clinic PC.

**Baseline:** `main` @ `1b67d2b`

---

## Quick dry-run

```bash
cd /path/to/Microdent-Modern
nvm use 22
bash scripts/dev-windows-dry-run.sh
```

Or step by step:

| Step | Command | Proves |
| --- | --- | --- |
| 1 | `pnpm --filter @microdent/desktop run test` | Setup path validation, supervisor |
| 2 | `pnpm --filter @microdent/bridge run build` | Bridge dist |
| 3 | `pnpm build:web` | Web dist for desktop |
| 4 | `pnpm --filter @microdent/desktop run build` | Desktop dist |
| 5 | `pnpm --filter @microdent/desktop run release-smoke` | Supervisor + defaults |
| 6 | `pnpm stage:pilot-release` | Staged tree |
| 7 | `pnpm pilot:verify-release` | Layout guards |

---

## Optional full checkpoint (sandbox env)

When disposable paths exist on the dev machine:

```bash
export DATA_ROOT="/path/to/Microdent-Write-Sandbox/DATA"
export SQLITE_PATH="/path/to/MICRODENT_MIRROR_SANDBOX.sqlite"
export BACKUP_DIR="/path/to/Microdent-Write-Sandbox/backups"
pnpm pilot:full-checkpoint
```

---

## Gaps vs real Windows

| Gap | Why dry-run is insufficient |
| --- | --- |
| SmartScreen / unsigned Electron | Policy UI on Windows only |
| DBF file locking under AV | Clinic antivirus profiles differ |
| UNC path performance | macOS cannot emulate `\\server\share` |
| `%AppData%` ACL | Per-user profile on Windows |
| Task Manager / port 17890 | Windows process model |

Document Windows machine results in `qa-runs/` after field testing.

---

## Related

- [windows-pilot-release-layout.md](./windows-pilot-release-layout.md)
- [PILOT-START-HERE.md](./PILOT-START-HERE.md)
- [scripts/README.md](../scripts/README.md)
