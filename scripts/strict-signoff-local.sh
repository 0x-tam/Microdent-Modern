#!/usr/bin/env bash
# PHI-free local strict signoff rehearsal.
# Creates synthetic DBFs, imports a local SQLite mirror, then delegates to the
# existing strict pilot release signoff gate.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

ROOT_REL="services/strict-signoff"
BRIDGE_PORT_VALUE="${BRIDGE_PORT:-17992}"
RUN_SIGNOFF=1

usage() {
  cat <<'EOF'
Usage: pnpm strict-signoff:local [--root <path>] [--port <port>] [--prepare-only]

Creates a PHI-free synthetic strict-signoff workspace, imports the SQLite mirror,
and runs pnpm pilot:release-signoff with DATA_ROOT, SQLITE_PATH, BACKUP_DIR,
BRIDGE_PORT, and BRIDGE_URL set to generated local paths.

Options:
  --root <path>      Workspace path relative to repo root or absolute
                    (default services/strict-signoff)
  --port <port>      Bridge port for sandbox QA (default 17992)
  --prepare-only     Generate synthetic data and import mirror, but do not run signoff
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --)
      shift
      ;;
    --root)
      [[ $# -ge 2 ]] || { echo "ERROR: --root requires a value" >&2; exit 64; }
      ROOT_REL="$2"
      shift 2
      ;;
    --port)
      [[ $# -ge 2 ]] || { echo "ERROR: --port requires a value" >&2; exit 64; }
      BRIDGE_PORT_VALUE="$2"
      shift 2
      ;;
    --prepare-only)
      RUN_SIGNOFF=0
      shift
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "ERROR: unknown argument: $1" >&2
      usage >&2
      exit 64
      ;;
  esac
done

if ! [[ "${BRIDGE_PORT_VALUE}" =~ ^[0-9]+$ ]] || [[ "${BRIDGE_PORT_VALUE}" -lt 1 || "${BRIDGE_PORT_VALUE}" -gt 65535 ]]; then
  echo "ERROR: --port must be an integer between 1 and 65535" >&2
  exit 64
fi

cd "${REPO_ROOT}"

if [[ "${ROOT_REL}" = /* ]]; then
  ROOT_ABS="${ROOT_REL}"
else
  ROOT_ABS="${REPO_ROOT}/${ROOT_REL}"
fi

echo "[strict-signoff:local] preparing synthetic strict-signoff workspace"
node scripts/prepare-strict-signoff-sandbox.mjs --root "${ROOT_ABS}"

export DATA_ROOT="${ROOT_ABS}/Microdent-Write-Sandbox/DATA"
export SQLITE_PATH="${ROOT_ABS}/MICRODENT_MIRROR_SANDBOX.sqlite"
export BACKUP_DIR="${ROOT_ABS}/Microdent-Write-Sandbox/backups"
export BRIDGE_PORT="${BRIDGE_PORT_VALUE}"
export BRIDGE_URL="http://127.0.0.1:${BRIDGE_PORT_VALUE}"

echo "[strict-signoff:local] importing synthetic SQLite mirror"
pnpm mirror:import-safe

echo "[strict-signoff:local] sandbox preflight"
bash scripts/qa-sandbox-preflight.sh

if [[ "${RUN_SIGNOFF}" -eq 0 ]]; then
  echo "[strict-signoff:local] prepare-only complete"
  echo "[strict-signoff:local] DATA_ROOT/SQLITE_PATH/BACKUP_DIR are under ${ROOT_ABS}"
  exit 0
fi

echo "[strict-signoff:local] running strict release signoff on port ${BRIDGE_PORT_VALUE}"
pnpm pilot:release-signoff
