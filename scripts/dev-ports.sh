#!/usr/bin/env bash
# Show processes listening on bridge/web dev ports.

set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/dev-common.sh"
dev_require_lsof

echo "Listening processes on dev ports (bridge 17890, Vite 5173/4173):"
echo

for port in "${DEV_PORTS[@]}"; do
  dev_describe_port "${port}"
  echo
done
