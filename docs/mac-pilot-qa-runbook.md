# Mac pilot QA runbook — before IT handoff

**Purpose:** Ordered checklist on the **Mac build machine** to produce a verified `dist/pilot-release/MicrodentModern/` folder for IT to zip and ship to Windows.

**Audience:** Release coordinator, Mac developer.

**Out of scope:** Real Windows clinic PC execution (tier 3). Mac steps prove tier 1–2 only.

---

## Prerequisites

- Node 22 (`nvm use 22`)
- Repo at `/path/to/Microdent-Modern`
- For **strict signoff** (optional but recommended): disposable sandbox env:

```bash
export DATA_ROOT="/path/to/Microdent-Write-Sandbox/DATA"
export SQLITE_PATH="/path/to/MICRODENT_MIRROR_SANDBOX.sqlite"
export BACKUP_DIR="/path/to/Microdent-Write-Sandbox/backups"
```

---

## Ordered checklist

| Step | Command | Proves |
| --- | --- | --- |
| 1 | `pnpm test` | Workspace regression |
| 2 | `pnpm build:web` | Web dist for desktop `file://` UI |
| 3 | `pnpm --filter @microdent/bridge run build` | Bridge `dist/server.js` |
| 4 | `pnpm --filter @microdent/desktop run build` | Desktop dist + setup HTML |
| 5 | `pnpm stage:pilot-release` | Stage `dist/pilot-release/MicrodentModern/` |
| 6 | `pnpm pilot:verify-release` | Layout + artifact safety |
| 7 | `pnpm pilot:verify-manifest` | `RELEASE-MANIFEST.json` hashes |
| 8 | `pnpm test:pilot-artifacts` | Synthetic layout/manifest tests |
| 9 (optional) | `pnpm pilot:release-signoff` | Tier 1 **READY** — requires sandbox env + full gate |
| 10 | `pnpm pilot:mac-release-status` | Read-only 3-tier summary (no build) |

**Dev iteration without sandbox:** `pnpm pilot:release-check` — distribution checkpoint; **not** strict signoff.

---

## Zip handoff to IT (manual)

1. Confirm `dist/pilot-release/MicrodentModern/` contains `HANDOFF-README.txt`, `RELEASE-MANIFEST.json`, `PILOT-START-HERE.md`, and `docs/PILOT-HANDOFF-PACK.md`.
2. Zip the **`MicrodentModern`** folder (not the whole repo). Example on Mac:

```bash
cd dist/pilot-release
zip -r MicrodentModern-pilot.zip MicrodentModern
```

3. Deliver the zip to IT. On Windows, IT verifies per `docs/windows-pilot-package-verify-on-windows.md` (no pnpm required).
4. **Do not** mark clinic go-live ready until a Windows field run is logged — see [FIELD-TEST-START-HERE.md](./FIELD-TEST-START-HERE.md).

---

## Three-tier status (reporting)

| Tier | Mac runbook covers? |
| --- | --- |
| **1. Mac-side release readiness** | Steps 1–9 |
| **2. Windows-test readiness** | Step 5 stages field pack docs |
| **3. Windows execution** | **Not covered** — Deferred until clinic PC |

**Clinic go-live:** **BLOCKED** until tier 3 complete. See [PILOT-START-HERE.md](./PILOT-START-HERE.md#pilot-readiness-status-three-tiers).

---

## Related

| Doc | Use |
| --- | --- |
| [scripts/README.md](../scripts/README.md) | Command matrix |
| [PILOT-HANDOFF-PACK.md](./PILOT-HANDOFF-PACK.md) | Staged package operator index |
| [windows-pilot-release-layout.md](./windows-pilot-release-layout.md) | Staged tree layout |
| [qa-runs/TEMPLATE-batch-report.md](../qa-runs/TEMPLATE-batch-report.md) | Batch report with mandatory tier table |
