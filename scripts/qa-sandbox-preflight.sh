#!/usr/bin/env bash
# Fast preflight for sandbox QA — env, marker, built bridge dist (no server start).
set -euo pipefail

: "${DATA_ROOT:?DATA_ROOT required}"
: "${SQLITE_PATH:?SQLITE_PATH required}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QA_REPO="${QA_REPO:-"$(cd "${SCRIPT_DIR}/.." && pwd)"}"
BRIDGE_DIST="${QA_REPO}/services/bridge/dist"

log() { echo "[qa-sandbox-preflight] $*"; }

for cmd in curl jq; do
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    log "FAIL: ${cmd} required"
    exit 1
  fi
done
if ! command -v sqlite3 >/dev/null 2>&1; then
  if ! node --no-warnings -e "require('node:sqlite')" >/dev/null 2>&1; then
    log "FAIL: sqlite3 required, or Node must provide node:sqlite"
    exit 1
  fi
fi

if ! realpath "${DATA_ROOT}" 2>/dev/null | grep -q 'Microdent-Write-Sandbox'; then
  log "FAIL: DATA_ROOT must resolve under Microdent-Write-Sandbox"
  exit 1
fi
if [[ ! -f "${DATA_ROOT}/.microdent-write-sandbox.json" ]]; then
  log "FAIL: missing sandbox marker under DATA_ROOT"
  exit 1
fi
if [[ ! -f "${SQLITE_PATH}" ]]; then
  log "FAIL: SQLITE_PATH not found"
  exit 1
fi
for artifact in server.js cli/legacy-backup.js cli/legacy-restore.js cli/qa-sandbox-readback.js; do
  if [[ ! -f "${BRIDGE_DIST}/${artifact}" ]]; then
    log "FAIL: missing ${BRIDGE_DIST}/${artifact} (run bridge build)"
    exit 1
  fi
done

log "preflight ok tools=ok marker=ok dist=ok sqlite=ok"
