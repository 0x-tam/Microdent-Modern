#!/usr/bin/env bash
# Strict release signoff — fails when sandbox env or paths are missing.
# PHI-safe: does not print DATA_ROOT paths or row payloads.
#
# Requires write access to BACKUP_DIR — EPERM on backup mkdir = not signoff-ready (not a product bug).
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
# For dev iteration without sandbox: use pnpm pilot:release-check (warns when sandbox skipped).

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

TOTAL_SECTIONS=8
SECTION=0
BLOCKED_REASONS=()

log() { echo "[pilot-release-signoff] $*"; }
fail_env() { echo "[pilot-release-signoff] FAIL: $*" >&2; exit 1; }

section() {
  SECTION=$((SECTION + 1))
  echo ""
  echo "========== [${SECTION}/${TOTAL_SECTIONS}] $* =========="
}

block() {
  BLOCKED_REASONS+=("$1")
  echo "[pilot-release-signoff] BLOCKED: $1" >&2
}

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    fail_env "${name} is unset — sandbox QA not signoff-ready (see scripts/pilot-release-signoff.sh header)"
  fi
}

require_path() {
  local label="$1"
  local value="$2"
  if [[ ! -e "${value}" ]]; then
    fail_env "${label} path missing on disk — sandbox QA not signoff-ready"
  fi
}

cd "${REPO_ROOT}"

require_env DATA_ROOT
require_env SQLITE_PATH
require_env BACKUP_DIR

require_path DATA_ROOT "${DATA_ROOT}"
require_path SQLITE_PATH "${SQLITE_PATH}"
require_path BACKUP_DIR "${BACKUP_DIR}"

section "Tests (pnpm test)"
if ! pnpm test; then
  block "pnpm test failed"
fi

section "Pilot artifact tests (pnpm test:pilot-artifacts)"
if ! pnpm test:pilot-artifacts; then
  block "pnpm test:pilot-artifacts failed"
fi

section "Web build (pnpm build:web)"
if ! pnpm build:web; then
  block "pnpm build:web failed"
fi

section "Bridge + desktop build"
if ! pnpm --filter @microdent/bridge run build; then
  block "bridge build failed"
fi
if ! pnpm --filter @microdent/desktop run build; then
  block "desktop build failed"
fi

section "Stage pilot release (pnpm stage:pilot-release)"
if ! pnpm stage:pilot-release; then
  block "pnpm stage:pilot-release failed"
fi

section "Verify release + manifest"
if ! pnpm pilot:verify-release; then
  block "pnpm pilot:verify-release failed"
fi
if ! pnpm pilot:verify-manifest; then
  block "pnpm pilot:verify-manifest failed"
fi

section "Desktop test + release-smoke"
if ! pnpm --filter @microdent/desktop run test; then
  block "desktop tests failed"
fi
if ! pnpm --filter @microdent/desktop run release-smoke; then
  block "desktop release-smoke failed"
fi
if ! PILOT_STAGED_RELEASE=1 pnpm --filter @microdent/desktop run release-smoke; then
  block "staged release-smoke (PILOT_STAGED_RELEASE=1) failed"
fi

section "Sandbox QA (pnpm qa:sandbox)"
if ! pnpm qa:sandbox; then
  block "pnpm qa:sandbox failed — check BACKUP_DIR is writable (EPERM = not signoff-ready)"
fi

print_tier_summary() {
  local tier1="$1"
  echo ""
  echo "========== Pilot readiness status (3-tier) =========="
  echo "Tier 1 — Mac-side release readiness:     ${tier1}"
  echo "Tier 2 — Windows-test readiness:         READY (field pack in staged tree)"
  echo "Tier 3 — Windows execution status:       Deferred / Not yet run"
  echo "Clinic go-live:                          BLOCKED (package evidence + field evidence link + commercial/go-live evidence)"
  echo ""
  echo "Mac signoff does not substitute for Windows field execution."
  echo "Field pack: docs/FIELD-TEST-START-HERE.md — file package evidence before clinic PC field evidence."
}

echo ""
if [[ ${#BLOCKED_REASONS[@]} -eq 0 ]]; then
  echo "PILOT RELEASE SIGNOFF: READY"
  print_tier_summary "READY"
  exit 0
fi

echo "PILOT RELEASE SIGNOFF: BLOCKED"
for reason in "${BLOCKED_REASONS[@]}"; do
  echo "  - ${reason}"
done
print_tier_summary "NOT READY"
exit 1
