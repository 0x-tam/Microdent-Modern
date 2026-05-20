#!/usr/bin/env bash
# Distribution RC checkpoint — tests, builds, stage, verify, staged release-smoke.
# PHI-safe: does not print DATA_ROOT paths or row payloads.
#
# Optional sandbox proof when env is set:
#   export DATA_ROOT="/path/to/Microdent-Write-Sandbox/DATA"
#   export SQLITE_PATH="/path/to/MICRODENT_MIRROR_SANDBOX.sqlite"
#   export BACKUP_DIR="/path/to/Microdent-Write-Sandbox/backups"
#
# Usage:
#   bash scripts/pilot-distribution-checkpoint.sh
#   pnpm pilot:distribution-checkpoint
#
# Windows: run from Git Bash or WSL; Node scripts (stage, verify, release-smoke) work in PowerShell too.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

log() { echo "[pilot-distribution-checkpoint] $*"; }

cd "${REPO_ROOT}"

log "pnpm test"
pnpm test

log "pnpm build:web"
pnpm build:web

log "bridge + desktop build"
pnpm --filter @microdent/bridge run build
pnpm --filter @microdent/desktop run build

log "pnpm stage:pilot-release"
pnpm stage:pilot-release

log "pnpm pilot:verify-release"
pnpm pilot:verify-release

log "staged release-smoke (PILOT_STAGED_RELEASE=1)"
PILOT_STAGED_RELEASE=1 pnpm --filter @microdent/desktop run release-smoke

if [[ -n "${DATA_ROOT:-}" && -n "${SQLITE_PATH:-}" ]]; then
  log "pnpm qa:sandbox (sandbox env detected)"
  pnpm qa:sandbox
else
  log "WARNING: SKIP pnpm qa:sandbox — dev checkpoint only; NOT release signoff-ready"
  log "WARNING: set DATA_ROOT, SQLITE_PATH, and BACKUP_DIR then run pnpm pilot:release-signoff for strict gate"
fi

log "pilot-distribution-checkpoint complete"
