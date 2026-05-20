#!/usr/bin/env bash
# Dev-only release check — same as pilot:distribution-checkpoint with an explicit not-signoff banner.
# PHI-safe: does not print DATA_ROOT paths or row payloads.
#
# Usage:
#   pnpm pilot:release-check
#
# For strict signoff (sandbox required): pnpm pilot:release-signoff

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[pilot:release-check] WARNING: dev iteration only — NOT release signoff." >&2
echo "[pilot:release-check] Sandbox QA may be skipped. Use pnpm pilot:release-signoff when DATA_ROOT/SQLITE_PATH/BACKUP_DIR are set." >&2
echo "" >&2

exec bash "${SCRIPT_DIR}/pilot-distribution-checkpoint.sh"
