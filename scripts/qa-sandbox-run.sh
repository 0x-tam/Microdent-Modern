#!/usr/bin/env bash
# Start a stable bridge (built dist, not tsx watch), wait for readiness, run sandbox write smoke.
# PHI-safe logs — paths and payloads are not printed.
#
# Requires:
#   DATA_ROOT     — disposable Microdent-Write-Sandbox/DATA
#   SQLITE_PATH   — mirror sqlite (smoke + optional audit)
#
# Optional:
#   BRIDGE_URL    — default http://127.0.0.1:17890
#   BACKUP_DIR    — default sibling of DATA_ROOT/backups
#   QA_REPO       — default repo root
#   WRITE_MODE    — default enabled (smoke needs commit)
#   ALLOW_LEGACY_WRITES — default I_UNDERSTAND_THIS_IS_A_DISPOSABLE_COPY

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QA_REPO="${QA_REPO:-"$(cd "${SCRIPT_DIR}/.." && pwd)"}"

: "${DATA_ROOT:?DATA_ROOT required}"
: "${SQLITE_PATH:?SQLITE_PATH required}"

BRIDGE_URL="${BRIDGE_URL:-http://127.0.0.1:17890}"
BACKUP_DIR="${BACKUP_DIR:-"$(dirname "${DATA_ROOT}")/backups"}"
WRITE_MODE="${WRITE_MODE:-enabled}"
ALLOW_LEGACY_WRITES="${ALLOW_LEGACY_WRITES:-I_UNDERSTAND_THIS_IS_A_DISPOSABLE_COPY}"
BRIDGE_HOST="${BRIDGE_HOST:-127.0.0.1}"
BRIDGE_PORT="${BRIDGE_PORT:-17890}"

BRIDGE_PID=""
BRIDGE_LOG=""

log() { echo "[qa-sandbox-run] $*"; }

section_banner() {
  echo ""
  echo "========== $* =========="
  echo ""
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log "FAIL: $1 required"
    exit 1
  fi
}

require_cmd curl
require_cmd jq

section_banner "1/5 Preflight"
bash "${SCRIPT_DIR}/qa-sandbox-preflight.sh"

if ! realpath "${DATA_ROOT}" 2>/dev/null | grep -q 'Microdent-Write-Sandbox'; then
  log "FAIL: DATA_ROOT must resolve under Microdent-Write-Sandbox"
  exit 1
fi
if [[ ! -f "${DATA_ROOT}/.microdent-write-sandbox.json" ]]; then
  log "FAIL: missing sandbox marker under DATA_ROOT"
  exit 1
fi

cleanup() {
  if [[ -n "${BRIDGE_PID}" ]] && kill -0 "${BRIDGE_PID}" 2>/dev/null; then
    log "stopping bridge pid=${BRIDGE_PID}"
    kill "${BRIDGE_PID}" 2>/dev/null || true
    wait "${BRIDGE_PID}" 2>/dev/null || true
  fi
  [[ -n "${BRIDGE_LOG}" && -f "${BRIDGE_LOG}" ]] && rm -f "${BRIDGE_LOG}"
}
trap cleanup EXIT INT TERM

section_banner "2/5 Bridge build and start"
log "building bridge (contracts + dist)"
(cd "${QA_REPO}" && pnpm --filter @microdent/contracts run build >/dev/null)
(cd "${QA_REPO}" && pnpm --filter @microdent/bridge run build >/dev/null)

BRIDGE_LOG="$(mktemp)"
log "starting bridge (node dist/server.js, writeMode=${WRITE_MODE})"
(
  cd "${QA_REPO}/services/bridge"
  export DATA_ROOT SQLITE_PATH BACKUP_DIR WRITE_MODE ALLOW_LEGACY_WRITES
  export BRIDGE_HOST BRIDGE_PORT
  exec node dist/server.js
) >>"${BRIDGE_LOG}" 2>&1 &
BRIDGE_PID=$!

curl_get() {
  local path="$1"
  local attempt=1 raw stderr_tmp curl_exit
  while [[ "${attempt}" -le 3 ]]; do
    stderr_tmp="$(mktemp)"
    set +e
    raw="$(curl -sS "${BRIDGE_URL}${path}" 2>"${stderr_tmp}")"
    curl_exit=$?
    set -e
    if [[ "${curl_exit}" -eq 0 ]]; then
      rm -f "${stderr_tmp}"
      echo "${raw}"
      return 0
    fi
    if [[ "${curl_exit}" -eq 52 ]] || grep -qiE 'empty reply|connection reset|recv failure' "${stderr_tmp}" 2>/dev/null; then
      if [[ "${attempt}" -lt 3 ]]; then
        log "curl GET transient failure path=${path} attempt=${attempt}"
        sleep $((attempt * 2))
        attempt=$((attempt + 1))
        rm -f "${stderr_tmp}"
        continue
      fi
    fi
    rm -f "${stderr_tmp}"
    log "FAIL: curl GET ${path} exit=${curl_exit}"
    return "${curl_exit}"
  done
}

wait_for_health() {
  local attempt=1 max=45
  while [[ "${attempt}" -le "${max}" ]]; do
    if raw="$(curl_get /health 2>/dev/null)" && echo "${raw}" | jq -e '.ok == true' >/dev/null 2>&1; then
      log "health ok attempt=${attempt}"
      return 0
    fi
    sleep 1
    attempt=$((attempt + 1))
  done
  log "FAIL: /health not ok after ${max}s"
  return 1
}

wait_for_write_capability() {
  local attempt=1 max=45
  while [[ "${attempt}" -le "${max}" ]]; do
    if raw="$(curl_get /v1/meta/write-capability 2>/dev/null)" \
      && echo "${raw}" | jq -e '.writableSandbox == true and .writeMode == "enabled"' >/dev/null 2>&1; then
      log "write-capability ready attempt=${attempt}"
      return 0
    fi
    sleep 1
    attempt=$((attempt + 1))
  done
  log "FAIL: /v1/meta/write-capability not writableSandbox+enabled after ${max}s"
  return 1
}

section_banner "3/5 Health and write-capability"
wait_for_health
wait_for_write_capability

section_banner "4/5 Mirror freshness advisory (warn only)"
if mirror_raw="$(curl_get /v1/mirror/status 2>/dev/null)" \
  && echo "${mirror_raw}" | jq -e '.sqliteConfigured == true' >/dev/null 2>&1; then
  imported="$(echo "${mirror_raw}" | jq -r '.importedTables | length' 2>/dev/null || echo 0)"
  runs="$(echo "${mirror_raw}" | jq -r '.latestImportRuns | length' 2>/dev/null || echo 0)"
  log "mirror advisory: imported_tables=${imported} latest_runs=${runs} (stale mirror does not fail write proof)"
  stale_count="$(echo "${mirror_raw}" | jq -r '
    [.latestImportRuns[]? | select(.finishedAt != null)
      | select((now - (.finishedAt | fromdateiso8601)) > 172800)] | length
  ' 2>/dev/null || echo 0)"
  if [[ "${stale_count}" != "0" && "${stale_count}" != "null" ]]; then
    log "WARN: mirror metadata includes imports older than 48h — re-run mirror:import-safe before relying on search/schedule"
  fi
  partial_failed="$(echo "${mirror_raw}" | jq -r '
    [.latestImportRuns[]? | select(.status == "partial" or .status == "failed")] | length
  ' 2>/dev/null || echo 0)"
  if [[ "${partial_failed}" != "0" && "${partial_failed}" != "null" ]]; then
    log "WARN: mirror has partial/failed table imports — DBF remains source of truth for writes"
  fi
else
  log "mirror advisory: status unavailable (skipped)"
fi

section_banner "5/5 Sandbox write smoke (DBF readback)"
export BRIDGE_URL DATA_ROOT SQLITE_PATH BACKUP_DIR QA_REPO
log "running qa-sandbox-write-smoke"
bash "${SCRIPT_DIR}/qa-sandbox-write-smoke.sh"
section_banner "qa:sandbox complete"
log "qa:sandbox complete"
