#!/usr/bin/env bash
# Full Windows clinic pilot RC checkpoint — test, web build, optional sandbox QA, desktop smoke.
# PHI-safe: does not print DATA_ROOT paths or row payloads.
#
# Sandbox env (required for qa:sandbox section):
#   export DATA_ROOT="/path/to/Microdent-Write-Sandbox/DATA"
#   export SQLITE_PATH="/path/to/MICRODENT_MIRROR_SANDBOX.sqlite"
#   export BACKUP_DIR="/path/to/Microdent-Write-Sandbox/backups"
#
# Usage:
#   bash scripts/pilot-full-checkpoint.sh
#   pnpm pilot:full-checkpoint
#
# Does NOT stage or verify the pilot package. For distribution RC use pnpm pilot:distribution-checkpoint.
# For strict release signoff (sandbox required): pnpm pilot:release-signoff

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

log() { echo "[pilot-full-checkpoint] $*"; }

cd "${REPO_ROOT}"

log "pnpm test"
pnpm test

log "pnpm build:web"
pnpm build:web

if [[ -n "${DATA_ROOT:-}" && -n "${SQLITE_PATH:-}" ]]; then
  log "pnpm qa:sandbox (sandbox env detected)"
  pnpm qa:sandbox
else
  log "SKIP pnpm qa:sandbox — set DATA_ROOT and SQLITE_PATH for full sandbox proof"
fi

log "desktop test + release-smoke"
pnpm --filter @microdent/desktop run test
pnpm --filter @microdent/desktop run release-smoke

log "NOTE: pilot:full-checkpoint does not run stage/verify — use pilot:distribution-checkpoint or pilot:release-signoff before IT handoff"

log "pilot-full-checkpoint complete"
