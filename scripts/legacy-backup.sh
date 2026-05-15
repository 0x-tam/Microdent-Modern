#!/usr/bin/env bash
# File-level backup of a legacy workflow table group before future DBF writes.

set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/dev-common.sh"
ROOT="$(dev_repo_root)"
cd "${ROOT}"

missing=()
if [[ -z "${DATA_ROOT:-}" ]] || [[ -z "${DATA_ROOT//[[:space:]]/}" ]]; then
  missing+=("DATA_ROOT")
fi
if [[ -z "${BACKUP_DIR:-}" ]] || [[ -z "${BACKUP_DIR//[[:space:]]/}" ]]; then
  missing+=("BACKUP_DIR")
fi
if [[ -z "${WORKFLOW:-}" ]] || [[ -z "${WORKFLOW//[[:space:]]/}" ]]; then
  missing+=("WORKFLOW")
fi

if [[ ${#missing[@]} -gt 0 ]]; then
  cat >&2 <<'EOF'
ERROR: DATA_ROOT, BACKUP_DIR, and WORKFLOW must be set.

  export DATA_ROOT="/absolute/path/to/disposable/DATA"
  export BACKUP_DIR="/absolute/path/to/backups"
  export WORKFLOW="appointment.statusUpdate"
  pnpm legacy:backup

Never point DATA_ROOT at production Microdent-Legacy.
EOF
  exit 1
fi

if [[ "${DATA_ROOT}" != /* ]]; then
  echo "ERROR: DATA_ROOT must be an absolute path." >&2
  exit 1
fi

if [[ "${BACKUP_DIR}" != /* ]]; then
  echo "ERROR: BACKUP_DIR must be an absolute path." >&2
  exit 1
fi

pnpm --filter @microdent/contracts run build
pnpm --filter @microdent/bridge run build
exec pnpm --filter @microdent/bridge run legacy-backup
