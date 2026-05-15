#!/usr/bin/env bash
# Copy read-only legacy DATA into a disposable write sandbox (marker + backups/).

set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/dev-common.sh"
ROOT="$(dev_repo_root)"
cd "${ROOT}"

missing=()
if [[ -z "${SOURCE_DATA_ROOT:-}" ]] || [[ -z "${SOURCE_DATA_ROOT//[[:space:]]/}" ]]; then
  missing+=("SOURCE_DATA_ROOT")
fi
if [[ -z "${SANDBOX_ROOT:-}" ]] || [[ -z "${SANDBOX_ROOT//[[:space:]]/}" ]]; then
  missing+=("SANDBOX_ROOT")
fi

if [[ ${#missing[@]} -gt 0 ]]; then
  cat >&2 <<'EOF'
ERROR: SOURCE_DATA_ROOT and SANDBOX_ROOT must be set.

  export SOURCE_DATA_ROOT="/absolute/path/to/read-only/DATA"
  export SANDBOX_ROOT="/absolute/path/to/Microdent-Write-Sandbox"
  pnpm legacy:create-sandbox

Never point SOURCE_DATA_ROOT at production Microdent-Legacy.
Never place SANDBOX_ROOT inside Microdent-Legacy or Microdent-Legacy-Copy.
EOF
  exit 1
fi

if [[ "${SOURCE_DATA_ROOT}" != /* ]]; then
  echo "ERROR: SOURCE_DATA_ROOT must be an absolute path." >&2
  exit 1
fi

if [[ "${SANDBOX_ROOT}" != /* ]]; then
  echo "ERROR: SANDBOX_ROOT must be an absolute path." >&2
  exit 1
fi

pnpm --filter @microdent/contracts run build
pnpm --filter @microdent/bridge run build
exec pnpm --filter @microdent/bridge run legacy-create-sandbox
