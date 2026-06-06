# Windows clinic pilot — start here

**Purpose:** One-page index for operators and IT. For the full staged-package walkthrough, open **[PILOT-HANDOFF-PACK.md](./PILOT-HANDOFF-PACK.md)** first.

**Baseline:** Microdent-Modern Windows pilot release package batch.

**Tester script:** [pilot-tester-guide.md](./pilot-tester-guide.md) · **IT sign-off:** [pilot-acceptance-checklist.md](./pilot-acceptance-checklist.md) · **Data locations:** [windows-pilot-data-locations.md](./windows-pilot-data-locations.md) · **Field matrix:** [windows-pilot-real-machine-checklist.md](./windows-pilot-real-machine-checklist.md)

---

## Pilot readiness status (three tiers)

Use this table in batch reports and sponsor conversations. **Mac signoff alone does not mean clinic go-live.**

| Tier | Question | Expected state (this release) |
| --- | --- | --- |
| **1. Mac-side release readiness** | Can we build, stage, verify, and sign off on the build machine? | **READY** after `pnpm pilot:release-signoff` passes (or distribution checkpoint + verify when sandbox env is set) |
| **2. Windows-test readiness** | Is the handoff pack complete for a **scheduled** Windows field test? | **READY** — field pack docs ship in staged `MicrodentModern/`; see [FIELD-TEST-START-HERE.md](./FIELD-TEST-START-HERE.md) |
| **3. Windows execution status** | Has a real Windows clinic PC run been logged? | **Deferred / Not yet run** — do **not** treat this package as clinic go-live ready |

**Clinic go-live:** **BLOCKED** until tier 3 shows a completed PHI-safe field log and [windows-pilot-go-no-go-checklist.md](./windows-pilot-go-no-go-checklist.md) GO.

**Field pack:** Ready when you **schedule** a Windows test — not “run now” from the Mac build machine. Start on the clinic PC: [FIELD-TEST-START-HERE.md](./FIELD-TEST-START-HERE.md) → [windows-pilot-field-execution-script.md](./windows-pilot-field-execution-script.md).

**Quick tier print (dev):** `pnpm pilot:mac-release-status`

---

## Data locations (three layers)

Full reference: **[windows-pilot-data-locations.md](./windows-pilot-data-locations.md)** — install vs `%AppData%` vs clinic paths, logs, QA reports, mirror/backups outside install.

| Layer | Example (Windows) | Notes |
| --- | --- | --- |
| **Install / staged package** | `C:\Microdent\MicrodentModern\` | IT extract — no clinic DBF/sqlite/backups |
| **Desktop config** | `%AppData%\Microdent\config.json` | Run → `%AppData%\Microdent` |
| **Clinic data folder** | `C:\ClinicData\Microdent\DATA` | Disposable copied data — never live legacy |
| **Local copy** | Derived by setup, e.g. `C:\ClinicData\Microdent\mirror\clinic.sqlite` | **Not** inside install folder |
| **Backups** | Derived by setup, e.g. `C:\ClinicData\Microdent\microdent-backups` | Required before sandbox commits — outside install |
| **Logs** | `%AppData%\Microdent\logs\` | PHI-safe operational logs; export from Settings when requested |
| **Repo (dev/build)** | `C:\Microdent\Microdent-Modern` | Clone + build; `qa-runs/` is dev-only |

Quote paths with spaces in PowerShell (e.g. `"C:\ClinicData\My Sandbox\DATA"`). Prefer drive letters over UNC shares.

---

## Numbered flow

| Step | Action | Detail doc |
| --- | --- | --- |
| 1 | Confirm bundled or fallback **Node 22.5+** | [windows-pilot-field-execution-script.md](./windows-pilot-field-execution-script.md) |
| 2 | Verify staged package layout | [windows-pilot-package-verify-on-windows.md](./windows-pilot-package-verify-on-windows.md) |
| 3 | First launch — desktop setup chooses copied clinic data and prepares local copy | [windows-pilot-field-execution-script.md](./windows-pilot-field-execution-script.md) |
| 4 | Local copy status / refresh from Settings | [windows-pilot-field-execution-script.md](./windows-pilot-field-execution-script.md) |
| 5 | Read-only QA — Today, Patients, Schedule, Settings | [phase-5-operator-qa-runbook.md](./phase-5-operator-qa-runbook.md) |
| 6 | Sandbox write pilot (optional) | [windows-pilot-runbook.md §6](./windows-pilot-runbook.md#6-sandbox-write-pilot-optional) |
| 7 | Sandbox QA sign-off | [phase-7-sandbox-pilot-qa-runbook.md](./phase-7-sandbox-pilot-qa-runbook.md) |
| 8 | Restore / reset when needed | [windows-pilot-runbook.md §8](./windows-pilot-runbook.md#8-restore-and-reset) |

Open the app → **Settings** → **Pilot readiness** strip and checklist show what is still missing.

---

## Validation commands

| Command | Class | Proves |
| --- | --- | --- |
| `pnpm pilot-checkpoint` | Dev quick | `pnpm test` + `build:web` + desktop release-smoke — **no** stage/verify/sandbox |
| `pnpm pilot:full-checkpoint` | Dev | Test + web + optional sandbox QA + desktop smoke — **no** stage/verify |
| `pnpm pilot:distribution-checkpoint` | Dev distribution | Test, build, stage, verify, staged smoke — **warns** when sandbox skipped |
| `pnpm pilot:release-check` | **Dev only** | Alias to distribution checkpoint with loud **not signoff** banner |
| `pnpm pilot:release-signoff` | **Strict signoff** | Full test/build/stage/verify/manifest/smoke + **requires** sandbox env paths — prints `READY` or `BLOCKED` |
| `pnpm test:pilot-artifacts` | Dev | Synthetic good/bad staged trees + manifest round-trip |
| `pnpm pilot:verify-manifest` | Dev/build | Hash check on `RELEASE-MANIFEST.json` only |

### Distribution RC checkpoint (build machine — recommended before IT handoff)

```bash
pnpm pilot:distribution-checkpoint
```

Runs `pnpm test`, `pnpm build:web`, bridge + desktop build, `pnpm stage:pilot-release`, `pnpm pilot:verify-release`, and `PILOT_STAGED_RELEASE=1` desktop release-smoke against `dist/pilot-release/MicrodentModern/`. Optionally runs `pnpm qa:sandbox` when `DATA_ROOT` and `SQLITE_PATH` are set.

**Not release signoff** when sandbox env is missing — use `pnpm pilot:release-signoff` for strict gate.

**Script class:** bash orchestrator (macOS/Linux/Git Bash). Underlying stage/verify/smoke are **Node** — runnable on Windows in PowerShell after builds.

### Quick checkpoint (no sandbox env)

```powershell
pnpm pilot-checkpoint
```

Runs `pnpm test`, `pnpm build:web`, and `pnpm desktop:release-smoke`. Does **not** stage, verify, or run sandbox QA.

### Full pilot checkpoint (with sandbox env)

```bash
export DATA_ROOT="/path/to/Microdent-Write-Sandbox/DATA"
export SQLITE_PATH="/path/to/MICRODENT_MIRROR_SANDBOX.sqlite"
export BACKUP_DIR="/path/to/Microdent-Write-Sandbox/backups"
pnpm pilot:full-checkpoint
```

Or run the same steps manually:

```bash
pnpm test
pnpm build:web
pnpm qa:sandbox
pnpm --filter @microdent/desktop run test
pnpm --filter @microdent/desktop run release-smoke
```

### Individual checks

| Command | Proves |
| --- | --- |
| `pnpm test` | All workspace regression tests |
| `pnpm build:web` | `apps/web/dist/index.html` for desktop `file://` UI |
| `pnpm desktop:release-smoke` | Desktop dist, bridge dist reference, config defaults |
| `pnpm stage:pilot-release` | Stage `dist/pilot-release/MicrodentModern/` (dist only, no clinic data) |
| `pnpm pilot:verify-release` | Validate `MicrodentModern/` layout and guardrails |
| `pnpm pilot:verify-manifest` | Manifest hash verification |
| `pnpm test:pilot-artifacts` | Artifact safety + manifest fixtures |
| `pnpm qa:sandbox` | Four write workflows + DBF readback (needs env above) |
| `pnpm pilot:distribution-checkpoint` | Distribution RC: test, build, stage, verify, staged smoke |
| `pnpm pilot:release-check` | **Dev only** — same as distribution checkpoint (not strict signoff) |
| `pnpm pilot:release-signoff` | **Strict** — same as distribution + manifest + requires sandbox; prints `READY` or `BLOCKED` |
| `pnpm pilot:full-checkpoint` | Test + web + optional sandbox QA + desktop smoke (no stage) |

Script index: [scripts/README.md](../scripts/README.md).

---

## IT handoff package (staged distribution)

For clinic deployment without a full git checkout, build and stage on a build machine:

```powershell
pnpm build:web
pnpm --filter @microdent/bridge run build
pnpm --filter @microdent/desktop run build
pnpm stage:pilot-release
pnpm pilot:verify-release
```

Deliver **`dist/pilot-release/MicrodentModern/`** to IT. That folder includes:

| Path | Purpose |
| --- | --- |
| `HANDOFF-README.txt` / `HANDOFF-README.md` | Install steps, Node 22 requirement — **start at** `docs/PILOT-HANDOFF-PACK.md` |
| `RELEASE-MANIFEST.json` | Content hash manifest for IT verification |
| `app/`, `bridge/`, `web/` | Compiled runtime artifacts |
| `config-templates/` | Example config only — operators save real config to `%AppData%\Microdent\config.json` |
| `docs/` | Pilot handoff pack, acceptance checklist, backup/restore, guardrails, real-Windows matrix |
| `scripts/` | Safe operator pointers (mirror import — see `mirror-import-pointer.txt`) |
| `logs/`, `mirror/`, `backups/` | Placeholder READMEs — create real folders outside the install dir |

Before sign-off, IT runs through [pilot-acceptance-checklist.md](./pilot-acceptance-checklist.md) and confirms `pnpm pilot:verify-release` passed on the build machine.

Layout detail: [windows-pilot-release-layout.md](./windows-pilot-release-layout.md).

---

## Issue report template (no PHI)

Use when filing pilot feedback:

| Field | What to include |
| --- | --- |
| Build | `main` @ `1b67d2b` (or current commit) |
| Checkpoint | `pilot-checkpoint` / `pilot:full-checkpoint` pass or fail |
| Settings checklist | Which rows are warn (screenshot OK — no patient names) |
| Mirror | Stale / partial / failed / OK from Settings refresh |
| Writes | `operationId` + audit status from feedback lines only |
| Do not attach | DBF files, patient names, full config paths in public tickets |

Full template: [pilot-tester-guide.md](./pilot-tester-guide.md#issue-report-template).

---

## Troubleshooting

**Full Windows pack:** [windows-pilot-troubleshooting-pack.md](./windows-pilot-troubleshooting-pack.md) — app launch, clinic service, port 17890, SmartScreen/AV, permissions, clinic data folder, local copy, sandbox QA, restore, safe logs.

| Symptom | What to check |
| --- | --- |
| **Clinic service offline** in Settings | Desktop config paths; `bridge\server.js` in staged package; Settings **Restart clinic service** / **Check service port** — [troubleshooting pack § Bridge offline](./windows-pilot-troubleshooting-pack.md#bridge-offline--health-timeout) |
| **Missing web dist** / blank UI | Confirm `web/index.html` in staged package — [troubleshooting pack § Blank UI](./windows-pilot-troubleshooting-pack.md#app-does-not-open--blank-ui) |
| **Port 17890 in use** | Use Settings **Check service port** and **View port cleanup policy**; app may run on a backup port; do not close unknown processes from Microdent Modern |
| **Local copy stale** vs copied files | Settings **Refresh local copy**; copied files are write source of truth — [troubleshooting pack § Mirror import](./windows-pilot-troubleshooting-pack.md#mirror-import-failed) |
| **Setup closed** without save | Restart desktop; choose **Re-open setup** if offered |
| **Write blocked** | Sandbox marker, `writeMode`, `ALLOW_LEGACY_WRITES` ack — [troubleshooting pack § Sandbox QA](./windows-pilot-troubleshooting-pack.md#sandbox-qa-failed) |
| **Unsupported feature** | [out-of-scope-guardrails.md](./out-of-scope-guardrails.md) |

**IT — verify package before operators start (no pnpm):** [windows-pilot-package-verify-on-windows.md](./windows-pilot-package-verify-on-windows.md)

---

## Not supported (pilot RC)

- NSIS installer, code signing, auto-update — see [windows-pilot-pre-installer-checklist.md](./windows-pilot-pre-installer-checklist.md)
- Payments, ledger, chart, medical summary, or memo writes
- Pointing the clinic data folder at live **Microdent-Legacy**

Full guardrails: [out-of-scope-guardrails.md](./out-of-scope-guardrails.md).

---

## Related docs

| Doc | Use when |
| --- | --- |
| [PILOT-HANDOFF-PACK.md](./PILOT-HANDOFF-PACK.md) | Master staged-package operator index |
| [windows-pilot-runbook.md](./windows-pilot-runbook.md) | Full Windows operator steps |
| [pilot-tester-guide.md](./pilot-tester-guide.md) | Guided day 1–3 test script |
| [pilot-backup-restore-audit.md](./pilot-backup-restore-audit.md) | Backup/restore + UI feedback |
| [phase-6-windows-mvp-operator-guide.md](./phase-6-windows-mvp-operator-guide.md) | Detailed Windows CLI |
| [phase-7-sandbox-pilot-qa-runbook.md](./phase-7-sandbox-pilot-qa-runbook.md) | Sandbox sign-off |
| [windows-pilot-packaging-gap-report.md](./windows-pilot-packaging-gap-report.md) | What installer work remains |
| [windows-pilot-release-layout.md](./windows-pilot-release-layout.md) | Staged pilot package layout |
| [windows-dev-dry-run.md](./windows-dev-dry-run.md) | Dev-machine packaging dry-run |
| [pilot-acceptance-checklist.md](./pilot-acceptance-checklist.md) | IT pass/fail sign-off |
| [apps/desktop/README.md](../apps/desktop/README.md) | Desktop shell and config paths |
| [windows-pilot-data-locations.md](./windows-pilot-data-locations.md) | Install vs AppData vs clinic paths |
