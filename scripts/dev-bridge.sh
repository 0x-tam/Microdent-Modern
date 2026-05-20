#!/usr/bin/env bash
# Start the local bridge with DATA_ROOT from the environment.

set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/dev-common.sh"
ROOT="$(dev_repo_root)"
cd "${ROOT}"

if [[ -z "${DATA_ROOT:-}" ]] || [[ -z "${DATA_ROOT//[[:space:]]/}" ]]; then
  cat >&2 <<'EOF'
ERROR: DATA_ROOT is not set.

The bridge needs an absolute path to a read-only copy of legacy DATA (never commit real clinic data).

  export DATA_ROOT="/absolute/path/to/your/DATA-copy"
  pnpm dev:bridge

Fixture-only testing (no real patient tables):

  export DATA_ROOT="/absolute/path/to/Microdent-Modern/services/bridge/fixtures/sandbox"
  pnpm dev:bridge
EOF
  exit 1
fi

if [[ "${DATA_ROOT}" != /* ]]; then
  echo "ERROR: DATA_ROOT must be an absolute path." >&2
  exit 1
fi

echo "Starting bridge (DATA_ROOT set, not printed). Listening on 127.0.0.1:17890 by default."
echo "Health check: curl -sS http://127.0.0.1:17890/health"
echo

pnpm --filter @microdent/contracts run build
exec pnpm --filter @microdent/bridge run dev
