# Scripts index

Shell helpers for local development and sandbox operations.

**Windows clinic pilot (start here):** [docs/PILOT-START-HERE.md](../docs/PILOT-START-HERE.md). **Windows MVP detail:** [docs/phase-6-windows-mvp-operator-guide.md](../docs/phase-6-windows-mvp-operator-guide.md). **Pilot RC:** [docs/windows-pilot-runbook.md](../docs/windows-pilot-runbook.md). **Sandbox pilot QA:** [docs/phase-7-sandbox-pilot-qa-runbook.md](../docs/phase-7-sandbox-pilot-qa-runbook.md). **Operator QA index:** [docs/phase-5-operator-qa-runbook.md](../docs/phase-5-operator-qa-runbook.md). **Script classification (full table):** [docs/phase-3-windows-readiness-audit.md](../docs/phase-3-windows-readiness-audit.md).

## Hard rules

| Rule | Requirement |
| --- | --- |
| Never live legacy as `DATA_ROOT` | Not `C:\Microdent\Microdent-Legacy` — use **`C:\Microdent\Legacy-Copy\DATA`** for read-only mirror import |
| Writes sandbox-only | `C:\Microdent\Write-Sandbox\DATA` + `.microdent-write-sandbox.json` |
| No new write domains | Four sandbox workflows; no payments, memos, or ledger writes in MVP |
| Sandbox QA CLIs | `node dist/cli/*.js` — smoke does **not** call `pnpm legacy:*` mid-run |

---

## macOS dev-only (`lsof`)

| Script | `pnpm` | Classification |
| --- | --- | --- |
| `dev-common.sh` | *(shared)* | macOS dev infrastructure |
| `dev-ports.sh` | `dev:ports` | macOS dev-only |
| `dev-kill-ports.sh` | `dev:kill-ports` | macOS dev-only |
| `dev-bridge.sh` | `dev:bridge` | macOS dev-only wrapper → bridge `dev` (tsx) |
| `dev-web.sh` | `dev:web` | macOS dev-only wrapper → Vite |

On **Windows**, use Task Manager / `netstat` for ports; run `pnpm --filter @microdent/bridge dev` or built `node dist/server.js` directly.

---

## Node wrappers with bash fallbacks

| Script | `pnpm` | Underlying | Classification |
| --- | --- | --- | --- |
| `mirror-import-safe.mjs` | `mirror:import-safe` | `@microdent/sqlite-mirror` `import-safe` | Cross-platform Node wrapper |
| `legacy-command.mjs backup` | `legacy:backup` | `@microdent/bridge` `legacy-backup` → `node dist/cli/legacy-backup.js` | Cross-platform Node wrapper |
| `legacy-command.mjs create-sandbox` | `legacy:create-sandbox` | `@microdent/bridge` `legacy-create-sandbox` | Cross-platform Node wrapper |
| `legacy-command.mjs restore` | `legacy:restore` | `@microdent/bridge` `legacy-restore` → `node dist/cli/legacy-restore.js` | Cross-platform Node wrapper |
| `legacy-command.mjs backup-verify` | `legacy:backup-verify` | `@microdent/bridge` `legacy-backup-verify` | Cross-platform Node wrapper |
| `legacy-*.sh` | `legacy:*:bash` | Same bridge CLIs | Historical bash fallbacks |

On **Windows**, prefer the root `pnpm` Node wrappers with PowerShell env vars (see below). Use `:bash` commands only when intentionally comparing against the historical shell fallback.

### Windows quick-reference (root `pnpm` wrappers)

Set absolute paths in PowerShell before each command (placeholders — use your operator paths).

| Task | Root `pnpm` | Bash fallback |
| --- | --- | --- |
| Mirror import (safe tables) | `pnpm mirror:import-safe` | `pnpm mirror:import-safe:bash` |
| Legacy backup | `pnpm legacy:backup` | `pnpm legacy:backup:bash` |
| Create write sandbox | `pnpm legacy:create-sandbox` | `pnpm legacy:create-sandbox:bash` |
| Restore from backup | `pnpm legacy:restore` | `pnpm legacy:restore:bash` |
| Verify backup manifest | `pnpm legacy:backup-verify` | `pnpm legacy:backup-verify:bash` |
| Production bridge | *(no root script)* | `pnpm --filter @microdent/bridge run build` then `node services\bridge\dist\server.js` |

**Example env (PowerShell):**

```powershell
$env:DATA_ROOT = "C:\Microdent\Legacy-Copy\DATA"
$env:SQLITE_PATH = "C:\Microdent\mirror\MICRODENT_MIRROR.sqlite"
$env:BACKUP_DIR = "C:\Microdent\Write-Sandbox\backups"
pnpm mirror:import-safe
```

Operator flow: [docs/phase-6-windows-mvp-operator-guide.md](../docs/phase-6-windows-mvp-operator-guide.md).

---

## Sandbox QA (bash)

| Script | `pnpm` | Classification | Notes |
| --- | --- | --- | --- |
| `qa-sandbox-run.mjs` | `qa:sandbox` | Cross-platform Node | Builds bridge; starts `node services/bridge/dist/server.js`; runs four write workflows with backup/restore + DBF readback; set `QA_SANDBOX_EVIDENCE_SUMMARY=qa-runs/YYYY-MM-DD-sandbox-write-summary-CLINIC-PC-01.json` to write a PHI-safe summary with operation IDs and backup basenames only |
| `qa-sandbox-run.sh` | `qa:sandbox:bash` | Bash fallback | Legacy bash orchestrator; same high-level proof, useful for comparing behavior on macOS/Git Bash |
| `qa-sandbox-write-smoke.sh` | *(manual bash smoke)* | Bash fallback | Four workflows; backup/restore = **direct** `(cd services/bridge && node dist/cli/legacy-backup.js)` — **not** `pnpm legacy:backup` mid-smoke |
| `qa-sandbox-pilot-checklist.sh` | *(print-only)* | Cross-platform bash | Ordered pilot steps — no execution; see [phase-7-sandbox-pilot-qa-runbook.md](../docs/phase-7-sandbox-pilot-qa-runbook.md) |

**Pass criteria and env:** [docs/phase-5-operator-qa-runbook.md](../docs/phase-5-operator-qa-runbook.md) §3. Orchestrator detail: [docs/phase-3-sandbox-qa-runner.md](../docs/phase-3-sandbox-qa-runner.md). Pilot sign-off: [docs/phase-7-sandbox-pilot-qa-runbook.md](../docs/phase-7-sandbox-pilot-qa-runbook.md). Windows without bash: [docs/phase-6-windows-mvp-operator-guide.md](../docs/phase-6-windows-mvp-operator-guide.md) §7.

---

## Root `package.json` command classification

| Command | Entry | Classification | Windows production notes |
| --- | --- | --- | --- |
| `pnpm test` | workspaces test chain | Cross-platform Node | Read-only regression |
| `pnpm build:web` | `@microdent/web` build | Cross-platform Node | Electron desktop packaged UI; browser fallback is served over local HTTP by `DOUBLE-CLICK-WINDOWS-TEST.cmd` |
| `pnpm preview:web` | Vite dev | Cross-platform Node | Optional pilot env in `.env.local` |
| `pnpm microdent:oneclick` | `scripts/microdent-oneclick.mjs` | Cross-platform Node | Full Linux/Codex one-click verification: dependency check, tests/builds, desktop release smoke, first-run/config simulation, clinic service health probe, PHI-safe report |
| `pnpm microdent:oneclick:quick` | `scripts/microdent-oneclick.mjs --quick` | Cross-platform Node | Faster iteration path: targeted builds, desktop tests, release smoke, first-run/config simulation, clinic service health probe |
| `pnpm microdent:oneclick:windows` | `scripts/windows-oneclick-check.ps1` | Windows PowerShell | Real Windows readiness check for AppData, spaces in paths, optional `microdent:oneclick:quick`, and Windows-only observation checklist; Linux cannot verify this |
| `pnpm dev:ports` | `scripts/dev-ports.sh` | macOS dev-only | `netstat` on Windows |
| `pnpm dev:kill-ports` | `scripts/dev-kill-ports.sh` | macOS dev-only | Task Manager on Windows |
| `pnpm dev:bridge` | `scripts/dev-bridge.sh` | macOS dev-only wrapper | `pnpm --filter @microdent/bridge dev` or `node dist/server.js` |
| `pnpm dev:web` | `scripts/dev-web.sh` | macOS dev-only wrapper | `pnpm --filter @microdent/web dev` |
| `pnpm mirror:import-safe` | `scripts/mirror-import-safe.mjs` | Cross-platform Node | Builds contracts/bridge, then runs `@microdent/sqlite-mirror` `import-safe` |
| `pnpm mirror:import-safe:bash` | `scripts/mirror-import-safe.sh` | Cross-platform bash + Node | Historical fallback for mirror import |
| `pnpm legacy:backup` | `scripts/legacy-command.mjs backup` | Cross-platform Node | Builds contracts/bridge, then runs `pnpm --filter @microdent/bridge run legacy-backup` |
| `pnpm legacy:backup:bash` | `scripts/legacy-backup.sh` | Bash fallback | Historical shell wrapper |
| `pnpm legacy:create-sandbox` | `scripts/legacy-command.mjs create-sandbox` | Cross-platform Node | Builds contracts/bridge, then runs `pnpm --filter @microdent/bridge run legacy-create-sandbox` |
| `pnpm legacy:create-sandbox:bash` | `scripts/legacy-create-sandbox.sh` | Bash fallback | Historical shell wrapper |
| `pnpm legacy:restore` | `scripts/legacy-command.mjs restore` | Cross-platform Node | Builds contracts/bridge, then runs `pnpm --filter @microdent/bridge run legacy-restore` |
| `pnpm legacy:restore:bash` | `scripts/legacy-restore.sh` | Bash fallback | Historical shell wrapper |
| `pnpm legacy:backup-verify` | `scripts/legacy-command.mjs backup-verify` | Cross-platform Node | Builds contracts/bridge, then runs `pnpm --filter @microdent/bridge run legacy-backup-verify` |
| `pnpm legacy:backup-verify:bash` | `scripts/legacy-backup-verify.sh` | Bash fallback | Historical shell wrapper |
| `pnpm sandbox:validate` | Vitest band | Cross-platform Node | Fast sandbox rules |
| `pnpm sandbox:validate:real` | Vitest + env | Cross-platform Node | Optional real-path band |
| `pnpm qa:sandbox` | `scripts/qa-sandbox-run.mjs` | Cross-platform Node | Native Windows/macOS/Linux sandbox proof; uses Node fetch/crypto plus `scripts/sqlite-query.mjs` on Node 22+; optional `QA_SANDBOX_EVIDENCE_SUMMARY` writes a PHI-safe JSON summary for later `EXEC-12`/`EXEC-13` evidence transcription |
| `pnpm qa:sandbox:bash` | `scripts/qa-sandbox-run.sh` | Bash fallback | Git Bash/macOS fallback if comparing against the historical shell runner |
| `pnpm desktop:release-smoke` | `@microdent/desktop` `release-smoke` | Cross-platform Node | Build + vitest + desktop/web/bridge dist checks |
| `pnpm strict-signoff:prepare` | `scripts/prepare-strict-signoff-sandbox.mjs` | Cross-platform Node | Creates ignored PHI-free synthetic DATA + disposable Write-Sandbox for local strict signoff |
| `pnpm strict-signoff:local` | `scripts/strict-signoff-local.mjs` | Cross-platform Node | One-command local strict signoff rehearsal: prepare synthetic sandbox, mirror import, preflight, strict signoff |
| `pnpm strict-signoff:local:bash` | `scripts/strict-signoff-local.sh` | Cross-platform bash + Node | Historical fallback for local strict signoff rehearsal |
| `pnpm pilot-checkpoint` | test + `build:web` + `desktop:release-smoke` | Cross-platform Node | Quick handoff gate — **does not** run `qa:sandbox` |
| `pnpm pilot:full-checkpoint` | `scripts/pilot-checkpoint.mjs full-checkpoint` | Cross-platform Node | Test + web + optional `qa:sandbox` + desktop smoke — **no** stage/verify |
| `pnpm pilot:full-checkpoint:bash` | `scripts/pilot-full-checkpoint.sh` | Bash fallback | Historical shell checkpoint |
| `pnpm pilot:distribution-checkpoint` | `scripts/pilot-checkpoint.mjs distribution-checkpoint` | Cross-platform Node | Distribution RC: test, build, stage, verify, `PILOT_STAGED_RELEASE=1` smoke; **warns** when sandbox skipped |
| `pnpm pilot:distribution-checkpoint:bash` | `scripts/pilot-distribution-checkpoint.sh` | Bash fallback | Historical shell checkpoint |
| `pnpm pilot:release-check` | `scripts/pilot-checkpoint.mjs release-check` | Cross-platform Node | **Dev iteration** — distribution checkpoint; loud not-signoff banner; **does not** prove Windows field execution |
| `pnpm pilot:release-check:bash` | `scripts/pilot-release-check.sh` | Bash fallback | Historical shell checkpoint |
| `pnpm pilot:release-signoff` | `scripts/pilot-release-signoff.mjs` | Cross-platform Node | **Mac full gate** — test, artifacts, build, stage, verify, manifest, smoke, **requires** sandbox env (`pnpm qa:sandbox`); prints signoff + **3-tier summary** |
| `pnpm pilot:release-signoff:bash` | `scripts/pilot-release-signoff.sh` | Cross-platform bash | Historical fallback for strict release signoff |
| `pnpm pilot:mac-release-status` | `scripts/pilot-mac-release-status.mjs` | Cross-platform Node | **Tiers only** — read-only status labels; no build, no verify, no deps |
| `pnpm pilot:stage-release` | alias → `stage:pilot-release` | Cross-platform Node | Same as `pnpm stage:pilot-release` |
| `pnpm stage:pilot-release` | `scripts/stage-pilot-release.mjs` | Cross-platform Node | Stage `dist/pilot-release/` from dist artifacts only |
| `pnpm pilot:verify-release` | `scripts/verify-pilot-release.mjs` | Cross-platform Node | Validate staged layout + sensitive-file guards + manifest |
| `pnpm pilot:verify-manifest` | `scripts/verify-pilot-manifest.mjs` | Cross-platform Node | Hash check on `RELEASE-MANIFEST.json` only |
| `pnpm pilot:package-verify-packet` | `scripts/package-verify-packet.mjs` | Cross-platform Node | Generate PHI-safe Windows staged-package verification packet, target evidence filename, and follow-up field commands; does not create evidence JSON |
| `pnpm pilot:package-verify-evidence` | `scripts/package-verify-evidence.mjs` | Cross-platform Node | Validate PHI-safe Windows staged-package verification JSON before field execution; pass `--repo-root` to validate an alternate checkout/evidence bundle; expected blocked for the template until IT verifies a real package |
| `pnpm pilot:windows-field-packet` | `scripts/windows-field-packet.mjs` | Cross-platform Node | Generate PHI-safe EXEC-01 through EXEC-16 collection packet, evidence targets, and validator commands; does not prove execution |
| `pnpm pilot:field-evidence` | `scripts/windows-field-evidence.mjs` | Cross-platform Node | Validate PHI-safe Windows field evidence JSON that references package verification through `packageVerification.evidencePath`; pass `--repo-root` to validate an alternate checkout/evidence bundle; `sandbox-signoff` can satisfy tier 3 review only after real Windows evidence is filed |
| `pnpm pilot:intake-safe-results` | `scripts/intake-safe-results.mjs` | Cross-platform Node (`Expand-Archive` on Windows, `unzip` elsewhere) | Intake returned `MicrodentModern-safe-results.zip`, validate the three generated evidence JSON files in a temporary root, then copy them into `qa-runs/` only after attachment/package/field evidence passes; blocked intake leaves `qa-runs/` unchanged; read-only smoke stays `READ_ONLY_READY`, not go-live |
| `pnpm pilot:windows-compatibility` | `scripts/windows-compatibility-evidence.mjs` | Cross-platform Node | Validate PHI-safe Windows 10/11 and antivirus/endpoint compatibility matrix evidence; pass `--repo-root` to validate an alternate checkout/evidence bundle |
| `pnpm pilot:signed-artifacts` | `scripts/signed-artifact-evidence.mjs` | Cross-platform Node | Validate PHI-safe Authenticode certificate, app executable, installer, timestamp, and SmartScreen evidence; pass `--repo-root` to validate an alternate checkout/evidence bundle |
| `pnpm pilot:installer-packet` | `scripts/installer-readiness-packet.mjs` | Cross-platform Node | Generate PHI-safe signed-installer packet, evidence targets, and validation commands; does not build or sign installers |
| `pnpm pilot:installer-evidence` | `scripts/installer-evidence.mjs` | Cross-platform Node | Validate PHI-safe signed installer install, upgrade, uninstall/data preservation, shortcuts, launch, and data-location evidence; pass `--repo-root` to validate an alternate checkout/evidence bundle |
| `pnpm pilot:auto-update-packet` | `scripts/auto-update-readiness-packet.mjs` | Cross-platform Node | Generate PHI-safe signed-update packet, evidence targets, and validation commands; does not implement or enable updates |
| `pnpm pilot:auto-update-evidence` | `scripts/auto-update-evidence.mjs` | Cross-platform Node | Validate PHI-safe signed update channel, payload, update, rollback, offline recovery, and privacy evidence; pass `--repo-root` to validate an alternate checkout/evidence bundle |
| `pnpm pilot:clinic-report` | `scripts/clinic-pilot-report-evidence.mjs` | Cross-platform Node | Validate PHI-safe clinic pilot outcome, field-evidence reference, issue triage, safety flags, and sponsor signoff; pass `--repo-root` to validate an alternate checkout/evidence bundle |
| `pnpm pilot:commercial-launch-packet` | `scripts/commercial-launch-packet.mjs` | Cross-platform Node | Generate PHI-safe support/license/distribution/pricing/marketing/commercial-readiness evidence packet |
| `pnpm pilot:support-readiness` | `scripts/support-readiness-evidence.mjs` | Cross-platform Node | Validate PHI-safe support KB, issue workflow, rollback, training, safe-evidence, and lead signoff readiness; pass `--repo-root` to validate an alternate checkout/evidence bundle |
| `pnpm pilot:distribution-evidence` | `scripts/distribution-evidence.mjs` | Cross-platform Node | Validate PHI-safe distribution channel, artifact integrity, release notes, claims review, support path, and privacy/security evidence; pass `--repo-root` to validate an alternate checkout/evidence bundle |
| `pnpm pilot:pricing-evidence` | `scripts/pricing-evidence.mjs` | Cross-platform Node | Validate PHI-safe pricing, license alignment, support terms, telemetry independence, and sponsor approval evidence; pass `--repo-root` to validate an alternate checkout/evidence bundle |
| `pnpm pilot:marketing-evidence` | `scripts/marketing-evidence.mjs` | Cross-platform Node | Validate PHI-safe marketing claims, disclosures, privacy review, packet approval, and safe-screenshot evidence; pass `--repo-root` to validate an alternate checkout/evidence bundle |
| `pnpm pilot:go-live-packet` | `scripts/go-live-readiness-packet.mjs` | Cross-platform Node | Generate PHI-safe final approval packet tying field, clinic pilot, support, commercial readiness, and go-live evidence targets |
| `pnpm pilot:go-live-evidence` | `scripts/go-live-evidence.mjs` | Cross-platform Node | Validate PHI-safe final go/no-go approval plus referenced package, field, clinic pilot, support, and commercial readiness evidence files; pass `--repo-root` to validate an alternate checkout/evidence bundle |
| `pnpm license:validate` | `scripts/offline-license-validate.mjs` | Cross-platform Node | Validate a signed PHI-safe offline commercial license JSON; relative `--public-key` paths resolve from the repo root; pass `--repo-root` to validate an alternate checkout/evidence bundle; expected blocked for the template without a real public key/signature |
| `pnpm pilot:attachment-manifest` | `scripts/evidence-attachment-manifest.mjs` | Cross-platform Node | Validate PHI-safe redacted attachment metadata, hashes, and secure tracker storage; pass `--repo-root` to validate an alternate checkout/evidence bundle |
| `pnpm pilot:evidence-repo-guard` | `scripts/evidence-repo-guard.mjs` | Cross-platform Node | Scan `qa-runs/` and block raw screenshots, PDFs, logs, DBF/SQLite files, archives, executable attachments, and raw-evidence folders |
| `pnpm pilot:evidence-collection-packet` | `scripts/evidence-collection-packet.mjs` | Cross-platform Node | Generate one PHI-safe master command packet for field, installer, update, commercial launch, go-live, filing-plan, repo guard, status, and completion audit; does not create evidence JSON |
| `pnpm pilot:evidence-filing-plan` | `scripts/evidence-filing-plan.mjs` | Cross-platform Node | Generate a PHI-safe filing plan with packet commands, target names, templates, and validators; relative `--public-key` paths resolve from the repo root; pass `--repo-root` to plan against an alternate checkout/evidence bundle; does not create evidence JSON |
| `pnpm pilot:commercial-evidence-status` | `scripts/commercial-evidence-status.mjs` | Cross-platform Node | Scan filed non-template commercial evidence JSONs and report missing/invalid families before final readiness; relative `--public-key` paths resolve from the repo root; pass `--repo-root` to scan an alternate checkout/evidence bundle |
| `pnpm pilot:commercial-readiness` | `scripts/commercial-readiness-audit.mjs` | Cross-platform Node | Validate final sellable-product evidence and referenced evidence bundle; relative `--public-key` paths resolve from the repo root; pass `--repo-root` to validate an alternate checkout/evidence bundle |
| `pnpm roadmap:completion-audit` | `scripts/roadmap-completion-audit.mjs` | Cross-platform Node | Strict requirement-by-requirement roadmap completion audit with explicit package verification, Windows field evidence, and commercial readiness gates; relative `--public-key` paths resolve from the repo root; pass `--repo-root` to audit an alternate checkout/evidence bundle |
| `pnpm roadmap:local-audit` | `scripts/roadmap-local-audit.mjs` | Cross-platform Node | Non-destructive local roadmap audit: artifact tests, stage/verify, template staging, expected blocked evidence gates |
| `pnpm roadmap:local-audit:bash` | `scripts/roadmap-local-audit.sh` | Cross-platform bash + Node | Historical fallback for the local roadmap audit |
| `pnpm test:pilot-artifacts` | `scripts/pilot-release-artifacts.test.mjs` | Cross-platform Node | Synthetic good/bad trees + manifest fixtures |
| `node scripts/sqlite-query.mjs` | `scripts/sqlite-query.mjs` | Cross-platform Node 22+ | Minimal read-only SQLite query helper for sandbox QA when the `sqlite3` CLI is unavailable |
| `bash scripts/dev-windows-dry-run.sh` | *(manual)* | Cross-platform bash | Desktop test + release-smoke + stage + verify; optional `qa:sandbox` if env set |

**Mac QA sequence (before IT zip):** [docs/mac-pilot-qa-runbook.md](../docs/mac-pilot-qa-runbook.md).

**None of the `pilot:*` commands substitute for Windows field execution** (tier 3). Clinic go-live stays **BLOCKED** until package verification evidence, PHI-safe Windows field evidence referencing that package proof with `packageVerification.evidencePath`, non-template commercial readiness evidence, and non-template go-live evidence are filed.
| `bash scripts/qa-sandbox-write-smoke.sh` | smoke only | macOS-oriented bash | Bridge must already be up |
| `pnpm --filter @microdent/desktop run start` | Electron | Cross-platform Node | `%AppData%\Microdent\config.json` |
| `node services/bridge/dist/server.js` | production bridge | Windows production-ready | Set env in PowerShell first |

### Deferred / needs replacement

| Item | Classification | Notes |
| --- | --- | --- |
| `scripts/qa-sandbox-run.sh` / `qa-sandbox-write-smoke.sh` | Fallback only | Historical bash flow retained for comparison; canonical `pnpm qa:sandbox` is Node |
| `pnpm dev:ports` / `dev:kill-ports` | Needs replacement (Windows dev ergonomics) | Optional; not required for production |
| NSIS / signed installer | Out of scope | Unpackaged desktop MVP |
