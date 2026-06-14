# Master evidence collection packet

**Purpose:** Generate one PHI-safe command packet that coordinates Windows package verification, Windows field, installer, auto-update, commercial launch, go-live, filing-plan, repository guard, commercial status, and roadmap completion audit steps.

**Command:**

```bash
pnpm pilot:evidence-collection-packet -- --clinic-label CLINIC-PC-01 --public-key keys/microdent-license-public.pem --write
```

**Script:** `scripts/evidence-collection-packet.mjs`

**Status:** This packet is always a coordinator only. It does **not** create evidence JSON, prove Windows execution, approve commercial readiness, or make `ROADMAP COMPLETION: READY`.

## What It Writes

With `--write`, the command writes a Markdown packet under `qa-runs/` such as:

```text
qa-runs/YYYY-MM-DD-evidence-collection-packet-CLINIC-PC-01.md
```

That Markdown packet contains copy/paste commands in dependency order for:

- `pnpm pilot:package-verify-packet`
- `pnpm pilot:package-verify-evidence`
- `pnpm pilot:windows-field-packet`
- `pnpm pilot:installer-packet`
- `pnpm pilot:auto-update-packet`
- `pnpm pilot:commercial-launch-packet`
- `pnpm pilot:go-live-packet`
- `pnpm pilot:evidence-filing-plan`
- `pnpm pilot:evidence-repo-guard`
- `pnpm pilot:commercial-evidence-status`
- `pnpm roadmap:completion-audit`

It intentionally writes packet/checklist Markdown only. Operators must still copy JSON templates, including `TEMPLATE-windows-package-verify-evidence.json`, fill them from real external evidence, and run each validator. Package verification evidence must pass before the Windows field report can be accepted, because field evidence must reference it through `packageVerification.evidencePath`.

## Run From Full Repo Checkout

The staged pilot package includes a pointer to this command, but the command itself is a repo-side support/operator workflow. Run it from a full checkout with dependencies available, not from `dist/pilot-release/MicrodentModern/`.

Example:

```bash
pnpm pilot:evidence-collection-packet -- --date 2026-06-06 --clinic-label CLINIC-PC-01 --write
```

Use `--json` when another tool needs the packet structure:

```bash
pnpm pilot:evidence-collection-packet -- --date 2026-06-06 --clinic-label CLINIC-PC-01 --json
```

## PHI Rules

- Do not commit raw screenshots, PDFs, logs, DBF/SQLite files, archives, signed license payloads, installer binaries, or raw clinic exports.
- Store raw materials in the approved secure internal tracker.
- File metadata and summaries only in `qa-runs/`.
- Use [evidence-attachment-manifest.md](./evidence-attachment-manifest.md) for redacted attachment metadata, hashes, reviewer roles, and secure tracker references.
- Do not include patient names, chart numbers, phone numbers, comments, raw DBF/SQLite rows, or full local paths.

## Relationship To The Filing Plan

Use this command first when coordinating a full package-verification, field, and commercial evidence run. It tells the operator which packet generators to run and where their Markdown packet outputs should go.

Then use:

```bash
pnpm pilot:evidence-filing-plan -- --clinic-label CLINIC-PC-01 --public-key keys/microdent-license-public.pem
```

The filing plan lists the exact non-template JSON filenames, source templates, validators, and current blockers, starting with package verification evidence before field execution evidence.

## Completion Rule

The expected state remains:

```text
ROADMAP COMPLETION: BLOCKED
```

That is correct until package verification evidence, real non-template Windows field evidence referencing it, and commercial readiness evidence are filed and pass validation. Do not weaken validators or create placeholder non-template JSON to make the roadmap appear complete.
