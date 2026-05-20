#!/usr/bin/env bash
# Prints ordered sandbox pilot QA steps — does not execute them.
# PHI-safe: no paths from the operator environment are echoed.

set -euo pipefail

cat <<'EOF'
Microdent sandbox pilot QA checklist (print-only)
=================================================

Prerequisites:
  - Node 22
  - Microdent-Modern repo
  - Disposable Microdent-Write-Sandbox/DATA with marker
  - SQLITE_PATH and BACKUP_DIR configured

Steps:
  1. Create write sandbox (if needed)
       pnpm legacy:create-sandbox
       Verify .microdent-write-sandbox.json under DATA_ROOT

  2. Mirror import (read-only snapshot)
       Set DATA_ROOT and SQLITE_PATH
       pnpm mirror:import-safe
       Settings → Refresh status (optional UI check)

  3. Read-only regression
       pnpm test
       pnpm build:web

  4. Sandbox write QA (automated)
       export DATA_ROOT SQLITE_PATH BACKUP_DIR
       pnpm qa:sandbox
       Expect: sections 1/5–5/5, exit 0, DBF readback source=dbf

  5. Four workflows (inside qa:sandbox smoke)
       - appointment.statusUpdate
       - appointment.timeMove
       - appointment.create
       - patient.demographics.update

  6. Backup / restore (manual or legacy CLI when validating restore)
       pnpm legacy:backup / pnpm legacy:restore on sandbox only

  7. Reset sandbox (separate from mirror refresh)
       Restore or re-create sandbox copy — never production legacy

  8. Re-import mirror (when search/schedule should match DBF)
       pnpm mirror:import-safe again
       DBF remains source of truth for writes until re-import

Docs:
  - docs/phase-7-sandbox-pilot-qa-runbook.md
  - docs/windows-pilot-runbook.md
  - docs/out-of-scope-guardrails.md

EOF
