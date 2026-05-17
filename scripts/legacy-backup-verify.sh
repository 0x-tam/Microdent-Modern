#!/usr/bin/env bash
# Read-only verification of a legacy backup manifest (hashes + sizes).

set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/dev-common.sh"
ROOT="$(dev_repo_root)"
cd "${ROOT}"

if [[ -z "${BACKUP_MANIFEST:-}" ]] || [[ -z "${BACKUP_MANIFEST//[[:space:]]/}" ]]; then
  cat >&2 <<'EOF'
ERROR: BACKUP_MANIFEST must be set to the backup folder (contains manifest.json and files/).

  export BACKUP_MANIFEST="/absolute/path/to/backups/20260515T120000Z__appointment.statusUpdate__abcd"
  pnpm legacy:backup-verify

Optional: also compare live DATA_ROOT files to the manifest:

  export DATA_ROOT="/absolute/path/to/disposable/DATA"
EOF
  exit 1
fi

if [[ "${BACKUP_MANIFEST}" != /* ]]; then
  echo "ERROR: BACKUP_MANIFEST must be an absolute path." >&2
  exit 1
fi

if [[ -n "${DATA_ROOT:-}" ]] && [[ "${DATA_ROOT}" != /* ]]; then
  echo "ERROR: DATA_ROOT must be an absolute path when set." >&2
  exit 1
fi

pnpm --filter @microdent/contracts run build
pnpm --filter @microdent/bridge run build
exec pnpm --filter @microdent/bridge run legacy-backup-verify
