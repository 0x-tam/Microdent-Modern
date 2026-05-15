#!/usr/bin/env bash
# Restore synthetic legacy table files from a backup manifest into a disposable write sandbox.

set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/dev-common.sh"
ROOT="$(dev_repo_root)"
cd "${ROOT}"

missing=()
if [[ -z "${BACKUP_MANIFEST:-}" ]] || [[ -z "${BACKUP_MANIFEST//[[:space:]]/}" ]]; then
  missing+=("BACKUP_MANIFEST")
fi
if [[ -z "${DATA_ROOT:-}" ]] || [[ -z "${DATA_ROOT//[[:space:]]/}" ]]; then
  missing+=("DATA_ROOT")
fi

if [[ ${#missing[@]} -gt 0 ]]; then
  cat >&2 <<'EOF'
ERROR: BACKUP_MANIFEST and DATA_ROOT must be set.

  export BACKUP_MANIFEST="/absolute/path/to/backup/folder"
  export DATA_ROOT="/absolute/path/to/disposable/DATA"
  pnpm legacy:restore

DATA_ROOT must contain .microdent-write-sandbox.json with disposable: true.
Never point DATA_ROOT at Microdent-Legacy or Microdent-Legacy-Copy.
EOF
  exit 1
fi

if [[ "${BACKUP_MANIFEST}" != /* ]]; then
  echo "ERROR: BACKUP_MANIFEST must be an absolute path." >&2
  exit 1
fi

if [[ "${DATA_ROOT}" != /* ]]; then
  echo "ERROR: DATA_ROOT must be an absolute path." >&2
  exit 1
fi

pnpm --filter @microdent/contracts run build
pnpm --filter @microdent/bridge run build
exec pnpm --filter @microdent/bridge run legacy-restore
