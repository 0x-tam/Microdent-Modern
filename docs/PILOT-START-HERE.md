# Windows clinic pilot — start here

**Purpose:** One-page index for operators and IT. For the full staged-package walkthrough, open **[PILOT-HANDOFF-PACK.md](./PILOT-HANDOFF-PACK.md)** first.

**Baseline:** Microdent-Modern Windows pilot release package batch.

**Operator manual:** [operator-manual.md](./operator-manual.md) · **Support KB:** [support-knowledge-base.md](./support-knowledge-base.md) · **Tester script:** [pilot-tester-guide.md](./pilot-tester-guide.md) · **IT sign-off:** [pilot-acceptance-checklist.md](./pilot-acceptance-checklist.md) · **Data locations:** [windows-pilot-data-locations.md](./windows-pilot-data-locations.md) · **Privacy review:** [data-privacy-review.md](./data-privacy-review.md) · **Field matrix:** [windows-pilot-real-machine-checklist.md](./windows-pilot-real-machine-checklist.md)

---

## Pilot readiness status (three tiers)

Use this table in batch reports and sponsor conversations. **Mac signoff alone does not mean clinic go-live.**

| Tier | Question | Expected state (this release) |
| --- | --- | --- |
| **1. Mac-side release readiness** | Can we build, stage, verify, and sign off on the build machine? | **READY** after `pnpm strict-signoff:local` or configured `pnpm pilot:release-signoff` passes |
| **2. Windows-test readiness** | Is the handoff pack complete for a **scheduled** Windows field test? | **READY** — field pack docs ship in staged `MicrodentModern/`; see [FIELD-TEST-START-HERE.md](./FIELD-TEST-START-HERE.md) |
| **3. Windows execution status** | Are package verification evidence and real Windows field evidence filed? | **Deferred / Not yet run** — do **not** treat this package as clinic go-live ready |

**Clinic go-live:** **BLOCKED** until tier 3 shows validated package verification evidence, completed PHI-safe Windows field evidence that references it with `packageVerification.evidencePath`, and [windows-pilot-go-no-go-checklist.md](./windows-pilot-go-no-go-checklist.md) GO.

**Field pack:** Ready when you **schedule** a Windows test — not “run now” from the Mac build machine. Start on the clinic PC with package verification evidence first: [FIELD-TEST-START-HERE.md](./FIELD-TEST-START-HERE.md) → [windows-pilot-package-verify-on-windows.md](./windows-pilot-package-verify-on-windows.md) → [windows-pilot-field-execution-script.md](./windows-pilot-field-execution-script.md).

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
| 5 | Read-only QA — Today, Patients, Schedule, Settings | [operator-manual.md](./operator-manual.md) and [phase-5-operator-qa-runbook.md](./phase-5-operator-qa-runbook.md) |
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
| `pnpm strict-signoff:local` | **Local strict rehearsal** | Generates PHI-free sandbox, imports mirror, runs strict signoff, and prints tier summary |
| `pnpm pilot:release-signoff` | **Strict signoff** | Full test/build/stage/verify/manifest/smoke + **requires** sandbox env paths — prints `READY` or `BLOCKED` |
| `pnpm pilot:package-verify-packet` | Package verify packet | Generates PHI-safe Windows no-pnpm package verification checklist, target filenames, and follow-up field commands; does **not** prove field execution |
| `pnpm pilot:package-verify-evidence` | Package evidence | Validates PHI-safe Windows staged-package verification JSON; use `--repo-root` only for an alternate checkout/evidence bundle; expected **BLOCKED** until IT verifies a real package |
| `pnpm pilot:windows-field-packet` | Field packet | Generates PHI-safe EXEC-01 through EXEC-16 collection packet, package verification evidence target, field target filenames, and validators; does **not** prove field execution |
| `pnpm pilot:field-evidence` | Field evidence | Validates PHI-safe real Windows field JSON that references validated package proof via `packageVerification.evidencePath`; use `--repo-root` only for an alternate checkout/evidence bundle; `sandbox-signoff` can satisfy tier 3 review only after real Windows evidence is filed |
| `pnpm pilot:windows-compatibility` | Windows matrix | Validates PHI-safe Windows 10/11 plus antivirus/endpoint compatibility evidence; use `--repo-root` only for an alternate checkout/evidence bundle |
| `pnpm pilot:signed-artifacts` | Signing evidence | Validates PHI-safe Authenticode app/installer signing evidence; use `--repo-root` only for an alternate checkout/evidence bundle; expected **BLOCKED** until real signed artifacts exist |
| `pnpm pilot:installer-packet` | Installer packet | Generates PHI-safe signed-installer validation packet, target filenames, and validators; does **not** build or sign an installer |
| `pnpm pilot:installer-evidence` | Installer evidence | Validates PHI-safe signed installer install/upgrade/uninstall evidence; use `--repo-root` only for an alternate checkout/evidence bundle; expected **BLOCKED** until real installer exists |
| `pnpm pilot:auto-update-packet` | Update packet | Generates PHI-safe signed-update validation packet, target filenames, and validators; does **not** enable auto-update |
| `pnpm pilot:auto-update-evidence` | Update evidence | Validates PHI-safe signed update, rollback, and privacy evidence; use `--repo-root` only for an alternate checkout/evidence bundle; expected **BLOCKED** until real update channel exists |
| `pnpm pilot:clinic-report` | Pilot report | Validates PHI-safe real clinic pilot outcome and triage evidence; use `--repo-root` only for an alternate checkout/evidence bundle; expected **BLOCKED** until real pilot report exists |
| `pnpm pilot:commercial-launch-packet` | Commercial packet | Generates PHI-safe support/license/distribution/pricing/marketing/commercial-readiness evidence packet |
| `pnpm pilot:support-readiness` | Support evidence | Validates PHI-safe support KB, issue workflow, rollback, training, and signoff evidence; use `--repo-root` only for an alternate checkout/evidence bundle |
| `pnpm pilot:distribution-evidence` | Distribution evidence | Validates PHI-safe channel, artifact integrity, claims, support path, and privacy/security evidence; use `--repo-root` only for an alternate checkout/evidence bundle |
| `pnpm pilot:pricing-evidence` | Pricing evidence | Validates PHI-safe license alignment, support terms, telemetry independence, and sponsor approval evidence; use `--repo-root` only for an alternate checkout/evidence bundle |
| `pnpm pilot:marketing-evidence` | Marketing evidence | Validates PHI-safe claim, disclosure, privacy review, packet approval, and safe-screenshot evidence; use `--repo-root` only for an alternate checkout/evidence bundle |
| `pnpm pilot:go-live-packet` | Go-live packet | Generates PHI-safe final approval packet tying field, clinic pilot, support, commercial readiness, and go-live evidence |
| `pnpm pilot:go-live-evidence` | Go-live evidence | Validates PHI-safe final go/no-go approval plus referenced package, field, clinic pilot, support, and commercial readiness evidence files; use `--repo-root` only for an alternate checkout/evidence bundle |
| `pnpm license:validate` | License evidence | Validates signed PHI-safe offline license JSON; relative `--public-key` paths resolve from the repo root; use `--repo-root` only for an alternate checkout/evidence bundle; template remains **BLOCKED** without real key/signature |
| `pnpm pilot:attachment-manifest` | Attachment manifest | Validates redacted attachment metadata, hashes, secure-tracker storage, and no raw screenshot/log commits; use `--repo-root` only for an alternate checkout/evidence bundle |
| `pnpm pilot:evidence-repo-guard` | Evidence repo guard | Confirms `qa-runs/` contains metadata/templates only and no raw screenshots, PDFs, logs, DBF/SQLite files, archives, or raw-evidence folders |
| `pnpm pilot:evidence-collection-packet` | [Master evidence packet](./evidence-collection-packet.md) | Prints/writes one PHI-safe command packet for field, installer, update, commercial launch, go-live, filing-plan, repo guard, status, and completion audit; does **not** create evidence JSON |
| `pnpm pilot:evidence-filing-plan` | Evidence filing plan | Prints PHI-safe packet commands, target filenames, source templates, and validator commands; relative `--public-key` paths resolve from the repo root; use `--write` for a Markdown checklist only; use `--repo-root` only for an alternate checkout/evidence bundle |
| `pnpm pilot:commercial-evidence-status` | Commercial evidence preflight | Scans non-template `qa-runs/*.json` and reports which commercial evidence families are missing or invalid; relative `--public-key` paths resolve from the repo root; use `--repo-root` only for an alternate checkout/evidence bundle |
| `pnpm pilot:commercial-readiness` | Commercial gate | Final sellable-product evidence audit; relative `--public-key` paths resolve from the repo root; use `--repo-root` only for an alternate checkout/evidence bundle; expected **BLOCKED** until signing/installer/update/pilots exist |
| `pnpm roadmap:completion-audit` | Completion gate | Strict roadmap audit; relative `--public-key` paths resolve from the repo root; use `--repo-root` only to audit an alternate checkout/evidence bundle; local sections can be ready, but full completion remains **BLOCKED** until non-template package verification, Windows field, and commercial readiness evidence are filed |
| `pnpm roadmap:local-audit` | Roadmap local audit | Non-destructive local audit: artifact tests, stage/verify, templates staged, evidence templates correctly blocked |
| `pnpm test:pilot-artifacts` | Dev | Synthetic good/bad staged trees + manifest round-trip |
| `pnpm pilot:verify-manifest` | Dev/build | Hash check on `RELEASE-MANIFEST.json` only |

### Distribution RC checkpoint (build machine — recommended before IT handoff)

```bash
pnpm pilot:distribution-checkpoint
```

Runs `pnpm test`, `pnpm build:web`, bridge + desktop build, `pnpm stage:pilot-release`, `pnpm pilot:verify-release`, and `PILOT_STAGED_RELEASE=1` desktop release-smoke against `dist/pilot-release/MicrodentModern/`. Optionally runs `pnpm qa:sandbox` when `DATA_ROOT` and `SQLITE_PATH` are set.

**Not release signoff** when sandbox env is missing — use `pnpm pilot:release-signoff` for strict gate.

**Script class:** cross-platform Node orchestrator. Historical bash fallback: `pnpm pilot:distribution-checkpoint:bash`.

### Quick checkpoint (no sandbox env)

```powershell
pnpm pilot-checkpoint
```

Runs `pnpm test`, `pnpm build:web`, and `pnpm desktop:release-smoke`. Does **not** stage, verify, or run sandbox QA.

### Local strict signoff rehearsal (PHI-free sandbox)

```bash
pnpm strict-signoff:local
```

Runs `pnpm strict-signoff:prepare`, imports the generated synthetic local copy, runs sandbox preflight, then executes `pnpm pilot:release-signoff` with generated `DATA_ROOT`, `SQLITE_PATH`, `BACKUP_DIR`, `BRIDGE_PORT`, and `BRIDGE_URL`.

Use this on the build machine when you need a reproducible Mac-side strict signoff proof without real clinic data. If port `17992` is busy, choose another free port:

```bash
pnpm strict-signoff:local -- --port 17995
```

This still does **not** replace tier 3 Windows field execution.

### Full pilot checkpoint (manual sandbox env)

```bash
pnpm strict-signoff:prepare
export DATA_ROOT="/path/to/Microdent-Write-Sandbox/DATA"
export SQLITE_PATH="/path/to/MICRODENT_MIRROR_SANDBOX.sqlite"
export BACKUP_DIR="/path/to/Microdent-Write-Sandbox/backups"
pnpm mirror:import-safe
pnpm pilot:full-checkpoint
```

For a PHI-free local strict signoff rehearsal, use the generated paths under ignored `services/strict-signoff/` after `pnpm strict-signoff:prepare`. Use a free `BRIDGE_PORT`/`BRIDGE_URL` pair if another local bridge is already listening on `17890`.

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
| `pnpm build:web` | `apps/web/dist/index.html` for the Electron desktop packaged UI; browser fallback is served over local HTTP by `DOUBLE-CLICK-WINDOWS-TEST.cmd` |
| `pnpm desktop:release-smoke` | Desktop dist, bridge dist reference, config defaults |
| `pnpm stage:pilot-release` | Stage `dist/pilot-release/MicrodentModern/` (dist only, no clinic data) |
| `pnpm pilot:verify-release` | Validate `MicrodentModern/` layout and guardrails |
| `pnpm pilot:verify-manifest` | Manifest hash verification |
| `pnpm test:pilot-artifacts` | Artifact safety + manifest fixtures |
| `pnpm qa:sandbox` | Four write workflows + DBF readback (needs env above; uses `sqlite3` or Node 22 `node:sqlite` fallback) |
| `pnpm pilot:distribution-checkpoint` | Distribution RC: test, build, stage, verify, staged smoke |
| `pnpm pilot:release-check` | **Dev only** — same as distribution checkpoint (not strict signoff) |
| `pnpm strict-signoff:local` | Local PHI-free strict signoff rehearsal: prepare synthetic sandbox, mirror import, preflight, strict release signoff |
| `pnpm pilot:release-signoff` | **Strict** — same as distribution + manifest + requires sandbox; prints `READY` or `BLOCKED` |
| `pnpm pilot:package-verify-packet -- --date YYYY-MM-DD --clinic-label CLINIC-PC-01 --write` | Writes PHI-safe Windows staged-package verification packet before field execution; does not create evidence JSON |
| `pnpm pilot:package-verify-evidence -- qa-runs/YYYY-MM-DD-windows-package-verify-evidence-CLINIC-PC-01.json` | Validates filed IT package verification evidence; add `--repo-root <path>` only for an alternate checkout/evidence bundle; does not prove app field execution |
| `pnpm pilot:windows-field-packet -- --date YYYY-MM-DD --clinic-label CLINIC-PC-01` | Prints PHI-safe Windows field execution packet with package verification evidence target, field evidence target, and validator commands |
| `pnpm pilot:field-evidence` | Validates filed Windows field evidence JSON after it references validated package proof through `packageVerification.evidencePath`; add `--repo-root <path>` only for an alternate checkout/evidence bundle; does not run Windows itself |
| `pnpm pilot:signed-artifacts` | Validates filed signed app/installer evidence JSON; add `--repo-root <path>` only for an alternate checkout/evidence bundle; does not sign artifacts |
| `pnpm pilot:installer-packet -- --date YYYY-MM-DD --target nsis` | Prints PHI-safe signed-installer validation packet with signing, install, upgrade, uninstall, data-boundary, and rollback checks |
| `pnpm pilot:installer-evidence` | Validates filed installer behavior evidence JSON; add `--repo-root <path>` only for an alternate checkout/evidence bundle; does not build installers |
| `pnpm pilot:auto-update-packet -- --date YYYY-MM-DD --channel internal-signed-feed` | Prints PHI-safe signed-update validation packet with update install, rollback, offline recovery, privacy, and operator-notice checks |
| `pnpm pilot:auto-update-evidence` | Validates filed update/rollback/privacy evidence JSON; add `--repo-root <path>` only for an alternate checkout/evidence bundle; does not enable update checks |
| `pnpm pilot:clinic-report` | Validates filed clinic pilot report JSON; add `--repo-root <path>` only for an alternate checkout/evidence bundle; does not replace Windows field evidence |
| `pnpm pilot:commercial-launch-packet -- --date YYYY-MM-DD --clinic-label CLINIC-PC-01` | Prints PHI-safe commercial launch packet for support, license, distribution, pricing, marketing, and commercial-readiness targets |
| `pnpm pilot:support-readiness` | Validates filed support readiness evidence JSON; add `--repo-root <path>` only for an alternate checkout/evidence bundle |
| `pnpm pilot:distribution-evidence` | Validates filed commercial distribution evidence JSON; add `--repo-root <path>` only for an alternate checkout/evidence bundle |
| `pnpm pilot:pricing-evidence` | Validates filed commercial pricing evidence JSON; add `--repo-root <path>` only for an alternate checkout/evidence bundle |
| `pnpm pilot:marketing-evidence` | Validates filed commercial marketing evidence JSON; add `--repo-root <path>` only for an alternate checkout/evidence bundle |
| `pnpm pilot:go-live-packet -- --date YYYY-MM-DD --clinic-label CLINIC-PC-01` | Prints PHI-safe final approval packet with field, clinic pilot, support, commercial readiness, and go-live targets |
| `pnpm pilot:go-live-evidence` | Validates filed final go-live approval evidence JSON and its referenced package, field, clinic pilot, support, and commercial readiness evidence files; add `--repo-root <path>` only for an alternate checkout/evidence bundle |
| `pnpm license:validate` | Validates signed offline commercial license evidence; add `--repo-root <path>` only for an alternate checkout/evidence bundle; does not enable pilot license enforcement |
| `pnpm pilot:attachment-manifest` | Validates filed redacted attachment manifest JSON; add `--repo-root <path>` only for an alternate checkout/evidence bundle; raw files stay outside the repo |
| `pnpm pilot:evidence-repo-guard` | Scans `qa-runs/` so raw screenshots, PDFs, logs, DBF/SQLite files, archives, and raw-evidence folders stay out of git |
| `pnpm pilot:evidence-collection-packet -- --public-key keys/microdent-license-public.pem --clinic-label CLINIC-PC-01 --write` | Writes the PHI-safe master command packet that coordinates package-verification, field, commercial, and final audit packet generators |
| `pnpm pilot:evidence-filing-plan -- --public-key keys/microdent-license-public.pem --clinic-label CLINIC-PC-01` | Prints packet commands, exact non-template evidence filenames, and validators without creating fake evidence JSON; relative key paths resolve from the repo root; add `--repo-root <path>` only for an alternate checkout/evidence bundle |
| `pnpm pilot:commercial-evidence-status -- --public-key keys/microdent-license-public.pem` | Preflight scanner for all filed non-template commercial evidence reports before final readiness; relative key paths resolve from the repo root; add `--repo-root <path>` only for an alternate checkout/evidence bundle |
| `pnpm pilot:commercial-readiness` | Final sellable-product evidence audit; relative key paths resolve from the repo root; add `--repo-root <path>` only for an alternate checkout/evidence bundle; remains blocked until external commercial evidence is filed |
| `pnpm roadmap:local-audit` | Local roadmap audit: release artifacts + blocked evidence-template checks |
| `pnpm roadmap:completion-audit -- --public-key keys/microdent-license-public.pem` | Final roadmap completion audit with explicit package verification, Windows field evidence, commercial readiness, and nested offline license signature verification; relative key paths resolve from the repo root; add `--repo-root <path>` only for an alternate checkout/evidence bundle |
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
| `DOUBLE-CLICK-AUTO-TEST.cmd` | Double-click automated Windows smoke helper; copies/imports `clinic-data-copy\DATA`, probes patients and schedule APIs, tries desktop first, then uses the local HTTP preview fallback |
| `DOUBLE-CLICK-WINDOWS-TEST.cmd` | Double-click Windows smoke helper; starts the local service and HTTP browser preview without opening `file://` assets |
| `clinic-data-copy/DATA/` | Optional copied DATA drop folder for the smoke helper; stays local and is excluded from `MicrodentModern-safe-results.zip` |
| `scripts/windows-oneclick-check.ps1` | Support readiness helper; from the staged package run it only with `-SkipPnpm` for Windows/AppData/path basics, while full repo verification remains `pnpm microdent:oneclick:windows` |
| `RELEASE-MANIFEST.json` | Content hash manifest for IT verification |
| `app/`, `bridge/`, `web/` | Compiled runtime artifacts |
| `config-templates/` | Example config only — operators save real config to `%AppData%\Microdent\config.json` |
| `docs/` | Pilot handoff pack, acceptance checklist, backup/restore, guardrails, real-Windows matrix |
| `scripts/` | Safe operator pointers (mirror import — see `mirror-import-pointer.txt`) |
| `logs/`, `mirror/`, `backups/` | Placeholder READMEs — create real folders outside the install dir |
| `MicrodentModern-safe-results.zip` | Returned by the smoke helper under the opened `qa-runs` folder; send this zip back, not DBF/SQLite/logs/screenshots |

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

Triage workflow: [pilot-feedback-triage-workflow.md](./pilot-feedback-triage-workflow.md) · Support KB: [support-knowledge-base.md](./support-knowledge-base.md)

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
| [operator-manual.md](./operator-manual.md) | Day-to-day operator use: setup, Today, Patients, Schedule, Settings, support logs |
| [data-privacy-review.md](./data-privacy-review.md) | Local-only PHI handling, support boundaries, retention guidance |
| [support-knowledge-base.md](./support-knowledge-base.md) | First-line support and escalation playbook |
| [pilot-feedback-triage-workflow.md](./pilot-feedback-triage-workflow.md) | Pilot feedback triage workflow |
| [support-readiness-checklist.md](./support-readiness-checklist.md) | Support readiness evidence checklist |
| [licensing-readiness.md](./licensing-readiness.md) | Offline/no-PHI licensing readiness |
| [distribution-readiness.md](./distribution-readiness.md) | Distribution and marketing-claim readiness |
| [pricing-readiness.md](./pricing-readiness.md) | Pricing readiness without usage telemetry |
| [pricing-evidence.md](./pricing-evidence.md) | Machine-readable pricing evidence schema and validation |
| [marketing-readiness.md](./marketing-readiness.md) | Marketing claim readiness |
| [marketing-evidence.md](./marketing-evidence.md) | Machine-readable marketing evidence schema and validation |
| [go-live-evidence.md](./go-live-evidence.md) | Machine-readable final go/no-go approval evidence |
| [windows-pilot-runbook.md](./windows-pilot-runbook.md) | Full Windows operator steps |
| [pilot-tester-guide.md](./pilot-tester-guide.md) | Guided day 1–3 test script |
| [pilot-backup-restore-audit.md](./pilot-backup-restore-audit.md) | Backup/restore + UI feedback |
| [phase-6-windows-mvp-operator-guide.md](./phase-6-windows-mvp-operator-guide.md) | Detailed Windows CLI |
| [phase-7-sandbox-pilot-qa-runbook.md](./phase-7-sandbox-pilot-qa-runbook.md) | Sandbox sign-off |
| [windows-pilot-packaging-gap-report.md](./windows-pilot-packaging-gap-report.md) | What installer work remains |
| [installer-deferral-decision-record.md](./installer-deferral-decision-record.md) | Portable package decision and installer deferral |
| [code-signing-deferral-decision-record.md](./code-signing-deferral-decision-record.md) | Authenticode/code-signing blocker |
| [auto-update-deferral-decision-record.md](./auto-update-deferral-decision-record.md) | Auto-update feed deferral |
| [telemetry-deferral-decision-record.md](./telemetry-deferral-decision-record.md) | Telemetry/upload deferral |
| [external-field-blockers-decision-record.md](./external-field-blockers-decision-record.md) | Windows field, AV, signing, installer, update, and clinic-pilot blockers |
| [windows-pilot-release-layout.md](./windows-pilot-release-layout.md) | Staged pilot package layout |
| [windows-dev-dry-run.md](./windows-dev-dry-run.md) | Dev-machine packaging dry-run |
| [pilot-acceptance-checklist.md](./pilot-acceptance-checklist.md) | IT pass/fail sign-off |
| [apps/desktop/README.md](../apps/desktop/README.md) | Desktop shell and config paths |
| [windows-pilot-data-locations.md](./windows-pilot-data-locations.md) | Install vs AppData vs clinic paths |
