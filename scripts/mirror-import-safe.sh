#!/usr/bin/env bash
# Build the SQLite mirror from safe tables only (read-only DATA_ROOT copy).

set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/dev-common.sh"
ROOT="$(dev_repo_root)"
cd "${ROOT}"

missing=()
if [[ -z "${DATA_ROOT:-}" ]] || [[ -z "${DATA_ROOT//[[:space:]]/}" ]]; then
  missing+=("DATA_ROOT")
fi
if [[ -z "${SQLITE_PATH:-}" ]] || [[ -z "${SQLITE_PATH//[[:space:]]/}" ]]; then
  missing+=("SQLITE_PATH")
fi

if [[ ${#missing[@]} -gt 0 ]]; then
  cat >&2 <<'EOF'
ERROR: DATA_ROOT and SQLITE_PATH must be set to absolute paths.

  export DATA_ROOT="/absolute/path/to/read-only/DATA-copy"
  export SQLITE_PATH="/absolute/path/to/MICRODENT_MIRROR.sqlite"
  pnpm mirror:import-safe

Never point DATA_ROOT at production Microdent-Legacy. Use Microdent-Legacy-Copy only.
EOF
  exit 1
fi

if [[ "${DATA_ROOT}" != /* ]]; then
  echo "ERROR: DATA_ROOT must be an absolute path." >&2
  exit 1
fi

if [[ "${SQLITE_PATH}" != /* ]]; then
  echo "ERROR: SQLITE_PATH must be an absolute path." >&2
  exit 1
fi

pnpm --filter @microdent/contracts run build
pnpm --filter @microdent/bridge run build
exec pnpm --filter @microdent/sqlite-mirror run import-safe
