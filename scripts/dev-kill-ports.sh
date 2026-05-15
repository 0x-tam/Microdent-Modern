#!/usr/bin/env bash
# Terminate only processes listening on bridge/web dev ports.

set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/dev-common.sh"
dev_require_lsof

declare -a kill_pids=()

echo "Listeners on ports ${DEV_PORTS[*]}:"

for port in "${DEV_PORTS[@]}"; do
  pids="$(dev_listen_pids "${port}")"
  [[ -z "${pids}" ]] && continue
  while IFS= read -r pid; do
    [[ -z "${pid}" ]] && continue
    cmd="$(ps -p "${pid}" -o command= 2>/dev/null || echo "?")"
    echo "  PID ${pid} (port ${port}): ${cmd}"
    kill_pids+=("${pid}")
  done <<<"${pids}"
done

if [[ ${#kill_pids[@]} -eq 0 ]]; then
  echo "No listeners on ports ${DEV_PORTS[*]}."
  exit 0
fi

echo
echo "Will send SIGTERM to listeners on ports ${DEV_PORTS[*]} only:"
echo

seen_pids=""
for pid in "${kill_pids[@]}"; do
  if [[ " ${seen_pids} " == *" ${pid} "* ]]; then
    continue
  fi
  seen_pids="${seen_pids} ${pid}"
  kill -TERM "${pid}" 2>/dev/null || true
done

sleep 0.5

for port in "${DEV_PORTS[@]}"; do
  remaining="$(dev_listen_pids "${port}")"
  if [[ -n "${remaining}" ]]; then
    echo "Port ${port} still has listener(s); sending SIGKILL to: ${remaining}"
    while IFS= read -r pid; do
      [[ -z "${pid}" ]] && continue
      kill -KILL "${pid}" 2>/dev/null || true
    done <<<"${remaining}"
  fi
done

echo "Done. Run 'pnpm dev:ports' to verify ports are free."
