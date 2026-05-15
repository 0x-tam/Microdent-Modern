#!/usr/bin/env bash
# Shared helpers for local dev port scripts (macOS-first; requires lsof).

set -euo pipefail

# Bridge default + Vite dev/preview (apps/web/vite.config.ts).
readonly DEV_PORTS=(17890 5173 4173)

dev_repo_root() {
  cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd
}

dev_require_lsof() {
  if ! command -v lsof >/dev/null 2>&1; then
    echo "ERROR: lsof is required. These scripts are macOS-oriented for now." >&2
    exit 1
  fi
}

# PIDs listening on TCP port (LISTEN only — not outbound clients).
dev_listen_pids() {
  local port="$1"
  lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true
}

dev_describe_port() {
  local port="$1"
  echo "=== Port ${port} ==="
  if pids="$(dev_listen_pids "${port}")" && [[ -n "${pids}" ]]; then
    lsof -nP -iTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true
  else
    echo "(nothing listening)"
  fi
}
