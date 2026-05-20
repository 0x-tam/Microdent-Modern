#!/usr/bin/env bash
# Strict release signoff — fails when sandbox env or paths are missing.
# PHI-safe: does not print DATA_ROOT paths or row payloads.
#
# Required sandbox env:
#   export DATA_ROOT="/path/to/Microdent-Write-Sandbox/DATA"
#   export SQLITE_PATH="/path/to/MICRODENT_MIRROR_SANDBOX.sqlite"
#   export BACKUP_DIR="/path/to/Microdent-Write-Sandbox/backups"
#
# Usage:
#   bash scripts/pilot-release-signoff.sh
#   pnpm pilot:release-signoff
#
# For dev iteration without sandbox: use pnpm pilot:distribution-checkpoint (warns when sandbox skipped).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

log() { echo "[pilot-release-signoff] $*"; }
fail() { echo "[pilot-release-signoff] FAIL: $*" >&2; exit 1; }

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    fail "${name} is unset — strict signoff requires sandbox env (see scripts/pilot-release-signoff.sh header)"
  fi
}

require_path() {
  local label="$1"
  local value="$2"
  if [[ ! -e "${value}" ]]; then
    fail "${label} path missing on disk — strict signoff cannot run qa:sandbox"
  fi
}

cd "${REPO_ROOT}"

require_env DATA_ROOT
require_env SQLITE_PATH
require_env BACKUP_DIR

require_path DATA_ROOT "${DATA_ROOT}"
require_path SQLITE_PATH "${SQLITE_PATH}"
require_path BACKUP_DIR "${BACKUP_DIR}"

log "pnpm test"
pnpm test

log "pnpm test:pilot-artifacts"
pnpm test:pilot-artifacts

log "pnpm build:web"
pnpm build:web

log "bridge + desktop build"
pnpm --filter @microdent/bridge run build
pnpm --filter @microdent/desktop run build

log "pnpm stage:pilot-release"
pnpm stage:pilot-release

log "pnpm pilot:verify-release"
pnpm pilot:verify-release

log "pnpm pilot:verify-manifest"
pnpm pilot:verify-manifest

log "desktop test + release-smoke"
pnpm --filter @microdent/desktop run test
pnpm --filter @microdent/desktop run release-smoke

log "staged release-smoke (PILOT_STAGED_RELEASE=1)"
PILOT_STAGED_RELEASE=1 pnpm --filter @microdent/desktop run release-smoke

log "pnpm qa:sandbox (strict — sandbox env verified)"
pnpm qa:sandbox

log "pilot-release-signoff complete — release signoff ready"
