#!/usr/bin/env bash
# PHI-safe sandbox write smoke: status, time move, create, demographics.
# Per workflow: dry-run → backup → commit → restore → hash revert.
# Logs HTTP codes, workflows, operationId, hash prefixes, backup basenames only.
#
# Requires:
#   SQLITE_PATH   — mirror sqlite (appointment/patient ids; optional audit SQL)
#   BRIDGE_URL    — e.g. http://127.0.0.1:17890
#   DATA_ROOT     — must resolve under Microdent-Write-Sandbox/DATA
#
# Optional: BACKUP_DIR, QA_REPO (defaults from repo / DATA_ROOT sibling).

set -euo pipefail

: "${SQLITE_PATH:?SQLITE_PATH required}"
: "${BRIDGE_URL:?BRIDGE_URL required}"
: "${DATA_ROOT:?DATA_ROOT required}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QA_REPO="${QA_REPO:-"$(cd "${SCRIPT_DIR}/.." && pwd)"}"
BACKUP_DIR="${BACKUP_DIR:-"$(dirname "${DATA_ROOT}")/backups"}"

JQ_WRITE='{operationId, workflow, mode, committed, fieldsChanged, warnings: [.warnings[]? | {code, severity}]}'
CURRENT_WORKFLOW=""

log() { echo "[qa-write-smoke] $*"; }

if ! command -v sqlite3 >/dev/null 2>&1; then
  log "FAIL: sqlite3 required"
  exit 1
fi
if ! command -v curl >/dev/null 2>&1; then
  log "FAIL: curl required"
  exit 1
fi
if ! command -v jq >/dev/null 2>&1; then
  log "FAIL: jq required"
  exit 1
fi

if ! realpath "${DATA_ROOT}" 2>/dev/null | grep -q 'Microdent-Write-Sandbox'; then
  log "FAIL: DATA_ROOT must be under Microdent-Write-Sandbox"
  exit 1
fi
if [[ ! -f "${DATA_ROOT}/.microdent-write-sandbox.json" ]]; then
  log "FAIL: missing sandbox marker under DATA_ROOT"
  exit 1
fi
if [[ ! -f "${DATA_ROOT}/SCHEDULE.DBF" ]]; then
  log "FAIL: SCHEDULE.DBF not found under DATA_ROOT"
  exit 1
fi
if [[ ! -f "${DATA_ROOT}/PATIENT.DBF" ]]; then
  log "FAIL: PATIENT.DBF not found under DATA_ROOT"
  exit 1
fi

hash_schedule() { shasum -a 256 "${DATA_ROOT}/SCHEDULE.DBF" 2>/dev/null | awk '{print $1}'; }
hash_patient() { shasum -a 256 "${DATA_ROOT}/PATIENT.DBF" 2>/dev/null | awk '{print $1}'; }
hash_prefix() { echo "${1:0:12}"; }

http_from_raw() { echo "$1" | grep '__HTTP__' | sed 's/.*__HTTP__//'; }
body_from_raw() { echo "$1" | sed '/__HTTP__/d'; }

curl_transient() {
  local exit_code="$1" stderr_file="$2"
  [[ "${exit_code}" -eq 52 ]] && return 0
  grep -qiE 'empty reply|connection reset|recv failure' "${stderr_file}" 2>/dev/null
}

curl_write() {
  local method="$1" url="$2" intent="$3" body="$4"
  local attempt=1 raw="" stderr_tmp curl_exit
  while [[ "${attempt}" -le 3 ]]; do
    stderr_tmp="$(mktemp)"
    set +e
    raw="$(curl -sS -w "\n__HTTP__%{http_code}" -X "${method}" "${BRIDGE_URL}${url}" \
      -H "Content-Type: application/json" -H "Accept: application/json" \
      -H "X-Write-Intent: ${intent}" -d "${body}" 2>"${stderr_tmp}")"
    curl_exit=$?
    set -e
    if [[ "${curl_exit}" -eq 0 ]]; then
      rm -f "${stderr_tmp}"
      echo "${raw}"
      return 0
    fi
    if curl_transient "${curl_exit}" "${stderr_tmp}" && [[ "${attempt}" -lt 3 ]]; then
      log "curl transient workflow=${CURRENT_WORKFLOW:-unknown} attempt=${attempt}"
      sleep $((attempt * 2))
      attempt=$((attempt + 1))
      rm -f "${stderr_tmp}"
      continue
    fi
    rm -f "${stderr_tmp}"
    log "curl FAIL workflow=${CURRENT_WORKFLOW:-unknown} exit=${curl_exit}"
    return "${curl_exit}"
  done
}

curl_post() {
  local url="$1" intent="$2" body="$3"
  CURRENT_WORKFLOW="${CURRENT_WORKFLOW:-appointment.create}"
  local attempt=1 raw="" stderr_tmp curl_exit
  while [[ "${attempt}" -le 3 ]]; do
    stderr_tmp="$(mktemp)"
    set +e
    raw="$(curl -sS -w "\n__HTTP__%{http_code}" -X POST "${BRIDGE_URL}${url}" \
      -H "Content-Type: application/json" -H "Accept: application/json" \
      -H "X-Write-Intent: ${intent}" -d "${body}" 2>"${stderr_tmp}")"
    curl_exit=$?
    set -e
    if [[ "${curl_exit}" -eq 0 ]]; then
      rm -f "${stderr_tmp}"
      echo "${raw}"
      return 0
    fi
    if curl_transient "${curl_exit}" "${stderr_tmp}" && [[ "${attempt}" -lt 3 ]]; then
      log "curl transient workflow=${CURRENT_WORKFLOW} attempt=${attempt}"
      sleep $((attempt * 2))
      attempt=$((attempt + 1))
      rm -f "${stderr_tmp}"
      continue
    fi
    rm -f "${stderr_tmp}"
    log "curl FAIL workflow=${CURRENT_WORKFLOW} exit=${curl_exit}"
    return "${curl_exit}"
  done
}

log_write_response() {
  local workflow="$1" phase="$2" http="$3" raw="$4"
  local filtered op_id committed
  filtered="$(body_from_raw "${raw}" | jq -c "${JQ_WRITE}" 2>/dev/null || echo '{}')"
  op_id="$(echo "${filtered}" | jq -r '.operationId // empty' 2>/dev/null || true)"
  committed="$(echo "${filtered}" | jq -r '.committed // empty' 2>/dev/null || true)"
  log "workflow=${workflow} phase=${phase} http=${http} operationId=${op_id:-none} committed=${committed:-n/a}"
}

latest_backup_basename() {
  local pattern="$1"
  local path
  path="$(ls -1dt "${BACKUP_DIR}"/${pattern}* 2>/dev/null | head -1 || true)"
  [[ -n "${path}" ]] && basename "${path}" || echo "none"
}

run_legacy_backup() {
  local workflow="$1"
  export DATA_ROOT BACKUP_DIR WORKFLOW="${workflow}"
  (cd "${QA_REPO}" && pnpm legacy:backup) >/dev/null
}

run_legacy_restore() {
  local manifest="$1"
  export BACKUP_MANIFEST="${manifest}" DATA_ROOT
  (cd "${QA_REPO}" && pnpm legacy:restore) >/dev/null
}

APPT_ID="$(sqlite3 "${SQLITE_PATH}" "SELECT appointment_id FROM appointments LIMIT 1;")"
PATIENT_ID="$(sqlite3 "${SQLITE_PATH}" "SELECT patient_id FROM patients LIMIT 1;")"
STATUS_BEFORE="$(sqlite3 "${SQLITE_PATH}" "SELECT status_code FROM appointments WHERE appointment_id='${APPT_ID}' LIMIT 1;")"
STATUS_AFTER=$(( (STATUS_BEFORE + 1) % 6 ))

if [[ -z "${APPT_ID}" ]]; then
  log "FAIL: no appointment_id in mirror sqlite"
  exit 1
fi
if [[ -z "${PATIENT_ID}" ]]; then
  log "FAIL: no patient_id in mirror sqlite (run mirror import first)"
  exit 1
fi

log "appointment_id=${APPT_ID} patient_id_present=yes"

# --- 1. appointment.statusUpdate ---
CURRENT_WORKFLOW="appointment.statusUpdate"
log "=== ${CURRENT_WORKFLOW} ==="
H0=$(hash_schedule)
log "baseline hash_prefix=$(hash_prefix "${H0}")"

raw=$(curl_write PATCH "/v1/schedule/appointments/${APPT_ID}/status" dry-run "{\"status\":${STATUS_AFTER}}")
http=$(http_from_raw "${raw}")
H1=$(hash_schedule)
log_write_response "${CURRENT_WORKFLOW}" dry-run "${http}" "${raw}"
if [[ "${http}" != "200" || "${H0}" != "${H1}" ]]; then
  log "${CURRENT_WORKFLOW} dry-run FAIL"
  exit 1
fi

run_legacy_backup "${CURRENT_WORKFLOW}"
BACKUP_ST=$(ls -1dt "${BACKUP_DIR}"/*appointment.statusUpdate* 2>/dev/null | head -1 || true)
log "backup workflow=${CURRENT_WORKFLOW} basename=$(latest_backup_basename '*appointment.statusUpdate')"

raw=$(curl_write PATCH "/v1/schedule/appointments/${APPT_ID}/status" commit "{\"status\":${STATUS_AFTER}}")
http=$(http_from_raw "${raw}")
committed=$(body_from_raw "${raw}" | jq -r '.committed // empty' 2>/dev/null || true)
H2=$(hash_schedule)
log_write_response "${CURRENT_WORKFLOW}" commit "${http}" "${raw}"
if [[ "${http}" != "200" || "${committed}" != "true" || "${H0}" == "${H2}" ]]; then
  log "${CURRENT_WORKFLOW} commit FAIL"
  exit 1
fi

[[ -n "${BACKUP_ST}" ]] && run_legacy_restore "${BACKUP_ST}"
H3=$(hash_schedule)
if [[ "${H0}" == "${H3}" ]]; then
  log "${CURRENT_WORKFLOW} restore PASS hash_prefix=$(hash_prefix "${H3}")"
else
  log "${CURRENT_WORKFLOW} restore FAIL"
  exit 1
fi

# --- 2. appointment.timeMove (conflict-free slot discovery) ---
CURRENT_WORKFLOW="appointment.timeMove"
SPARSE_DATES=()
while IFS= read -r line; do
  [[ -n "${line}" ]] && SPARSE_DATES+=("${line}")
done < <(
  sqlite3 "${SQLITE_PATH}" "
    SELECT appointment_date FROM appointments
    GROUP BY appointment_date
    ORDER BY COUNT(*) ASC
    LIMIT 8;
  " 2>/dev/null || true
)
CANDIDATE_DATES=("${SPARSE_DATES[@]}" "2026-05-22" "2026-05-25" "2026-06-01")

try_time_move_dry_run() {
  local date="$1" time="$2" room="$3"
  local raw http
  raw=$(curl_write PATCH "/v1/schedule/appointments/${APPT_ID}/time" dry-run \
    "{\"date\":\"${date}\",\"time\":\"${time}\",\"room\":${room}}")
  http_from_raw "${raw}"
}

discover_free_slot() {
  local date time room http
  for date in "${CANDIDATE_DATES[@]}"; do
    [[ -n "${date}" ]] || continue
    for room in $(seq 1 25); do
      for hour in $(seq 8 17); do
        for min in 00 15 30 45; do
          time=$(printf "%02d:%02d" "${hour}" "${min}")
          http=$(try_time_move_dry_run "${date}" "${time}" "${room}")
          if [[ "${http}" == "200" ]]; then
            echo "${date}|${time}|${room}"
            return 0
          fi
        done
      done
    done
  done
  return 1
}

log "=== ${CURRENT_WORKFLOW}: discovering conflict-free slot (dry-run) ==="
SLOT="$(discover_free_slot || true)"
if [[ -z "${SLOT}" ]]; then
  log "FAIL: no dry-run 200 slot for time move"
  exit 1
fi
IFS='|' read -r MOVE_DATE MOVE_TIME MOVE_ROOM <<< "${SLOT}"
log "slot_found date=${MOVE_DATE} time=${MOVE_TIME} room=${MOVE_ROOM}"

H0=$(hash_schedule)
log "baseline hash_prefix=$(hash_prefix "${H0}")"

raw=$(curl_write PATCH "/v1/schedule/appointments/${APPT_ID}/time" dry-run \
  "{\"date\":\"${MOVE_DATE}\",\"time\":\"${MOVE_TIME}\",\"room\":${MOVE_ROOM}}")
http=$(http_from_raw "${raw}")
H1=$(hash_schedule)
log_write_response "${CURRENT_WORKFLOW}" dry-run "${http}" "${raw}"
if [[ "${http}" != "200" || "${H0}" != "${H1}" ]]; then
  log "${CURRENT_WORKFLOW} dry-run FAIL"
  exit 1
fi

run_legacy_backup "${CURRENT_WORKFLOW}"
BACKUP_TM=$(ls -1dt "${BACKUP_DIR}"/*appointment.timeMove* 2>/dev/null | head -1 || true)
log "backup workflow=${CURRENT_WORKFLOW} basename=$(latest_backup_basename '*appointment.timeMove')"

raw=$(curl_write PATCH "/v1/schedule/appointments/${APPT_ID}/time" commit \
  "{\"date\":\"${MOVE_DATE}\",\"time\":\"${MOVE_TIME}\",\"room\":${MOVE_ROOM}}")
http=$(http_from_raw "${raw}")
committed=$(body_from_raw "${raw}" | jq -r '.committed // empty' 2>/dev/null || true)
H2=$(hash_schedule)
log_write_response "${CURRENT_WORKFLOW}" commit "${http}" "${raw}"
if [[ "${http}" != "200" || "${committed}" != "true" || "${H0}" == "${H2}" ]]; then
  log "${CURRENT_WORKFLOW} commit FAIL"
  exit 1
fi

[[ -n "${BACKUP_TM}" ]] && run_legacy_restore "${BACKUP_TM}"
H3=$(hash_schedule)
if [[ "${H0}" != "${H3}" ]]; then
  log "${CURRENT_WORKFLOW} restore FAIL"
  exit 1
fi
log "${CURRENT_WORKFLOW} restore PASS hash_prefix=$(hash_prefix "${H3}")"

# --- 3. appointment.create ---
CURRENT_WORKFLOW="appointment.create"
CREATE_DATE="2026-05-22"
CREATE_TIME="10:30"
CREATE_ROOM=2
CREATE_BODY="{\"patId\":\"${PATIENT_ID}\",\"date\":\"${CREATE_DATE}\",\"time\":\"${CREATE_TIME}\",\"room\":${CREATE_ROOM},\"durationSlots\":1}"

log "=== ${CURRENT_WORKFLOW} ==="
H0=$(hash_schedule)
log "baseline hash_prefix=$(hash_prefix "${H0}")"

raw=$(curl_post "/v1/schedule/appointments" dry-run "${CREATE_BODY}")
http=$(http_from_raw "${raw}")
H1=$(hash_schedule)
if [[ "${http}" != "200" || "${H0}" != "${H1}" ]]; then
  CREATE_DATE="2026-05-25"
  CREATE_TIME="09:00"
  CREATE_BODY="{\"patId\":\"${PATIENT_ID}\",\"date\":\"${CREATE_DATE}\",\"time\":\"${CREATE_TIME}\",\"room\":1,\"durationSlots\":1}"
  raw=$(curl_post "/v1/schedule/appointments" dry-run "${CREATE_BODY}")
  http=$(http_from_raw "${raw}")
  H1=$(hash_schedule)
fi
log_write_response "${CURRENT_WORKFLOW}" dry-run "${http}" "${raw}"
if [[ "${http}" != "200" || "${H0}" != "${H1}" ]]; then
  log "${CURRENT_WORKFLOW} dry-run FAIL"
  exit 1
fi

run_legacy_backup "${CURRENT_WORKFLOW}"
BACKUP_CR=$(ls -1dt "${BACKUP_DIR}"/*appointment.create* 2>/dev/null | head -1 || true)
log "backup workflow=${CURRENT_WORKFLOW} basename=$(latest_backup_basename '*appointment.create')"

raw=$(curl_post "/v1/schedule/appointments" commit "${CREATE_BODY}")
http=$(http_from_raw "${raw}")
committed=$(body_from_raw "${raw}" | jq -r '.committed // empty' 2>/dev/null || true)
H2=$(hash_schedule)
log_write_response "${CURRENT_WORKFLOW}" commit "${http}" "${raw}"
if [[ "${http}" != "200" || "${committed}" != "true" || "${H0}" == "${H2}" ]]; then
  log "${CURRENT_WORKFLOW} commit FAIL"
  exit 1
fi

[[ -n "${BACKUP_CR}" ]] && run_legacy_restore "${BACKUP_CR}"
H3=$(hash_schedule)
if [[ "${H0}" != "${H3}" ]]; then
  log "${CURRENT_WORKFLOW} restore FAIL"
  exit 1
fi
log "${CURRENT_WORKFLOW} restore PASS hash_prefix=$(hash_prefix "${H3}")"

# --- 4. patient.demographics.update ---
CURRENT_WORKFLOW="patient.demographics.update"
log "=== ${CURRENT_WORKFLOW} ==="
H0=$(hash_patient)
log "baseline hash_prefix=$(hash_prefix "${H0}")"

raw=$(curl_write PATCH "/v1/patients/${PATIENT_ID}/demographics" dry-run '{"chartNumber":"QA-DRY-ONLY"}')
http=$(http_from_raw "${raw}")
H1=$(hash_patient)
log_write_response "${CURRENT_WORKFLOW}" dry-run "${http}" "${raw}"
if [[ "${http}" != "200" || "${H0}" != "${H1}" ]]; then
  log "${CURRENT_WORKFLOW} dry-run FAIL"
  exit 1
fi

run_legacy_backup "${CURRENT_WORKFLOW}"
BACKUP_DM=$(ls -1dt "${BACKUP_DIR}"/*patient.demographics.update* 2>/dev/null | head -1 || true)
log "backup workflow=${CURRENT_WORKFLOW} basename=$(latest_backup_basename '*patient.demographics.update')"

raw=$(curl_write PATCH "/v1/patients/${PATIENT_ID}/demographics" commit '{"chartNumber":"QA-COMMIT-1"}')
http=$(http_from_raw "${raw}")
committed=$(body_from_raw "${raw}" | jq -r '.committed // empty' 2>/dev/null || true)
H2=$(hash_patient)
log_write_response "${CURRENT_WORKFLOW}" commit "${http}" "${raw}"
if [[ "${http}" != "200" || "${committed}" != "true" || "${H0}" == "${H2}" ]]; then
  log "${CURRENT_WORKFLOW} commit FAIL"
  exit 1
fi

[[ -n "${BACKUP_DM}" ]] && run_legacy_restore "${BACKUP_DM}"
H3=$(hash_patient)
if [[ "${H0}" != "${H3}" ]]; then
  log "${CURRENT_WORKFLOW} restore FAIL"
  exit 1
fi
log "${CURRENT_WORKFLOW} restore PASS hash_prefix=$(hash_prefix "${H3}")"

# --- audit (ids / workflow / status only) ---
if [[ -f "${SQLITE_PATH}" ]]; then
  log "=== write audit (safe fields) ==="
  audit_raw=""
  set +e
  audit_raw="$(curl -sS "${BRIDGE_URL}/v1/meta/write-audit-recent" 2>/dev/null)"
  set -e
  if echo "${audit_raw}" | jq -e '.sqliteUsable == true' >/dev/null 2>&1; then
    echo "${audit_raw}" | jq -r '.entries[:5][] | "audit operationId=\(.operationId) workflow=\(.workflow) status=\(.terminalStatus)"' 2>/dev/null \
      | while IFS= read -r line; do log "${line}"; done || true
  else
    sqlite3 "${SQLITE_PATH}" \
      "SELECT operation_id, workflow_type, status FROM write_audit_log ORDER BY requested_at DESC LIMIT 5;" 2>/dev/null \
      | while IFS='|' read -r op wf st; do
          log "audit operationId=${op} workflow=${wf} status=${st}"
        done || log "audit unavailable"
  fi
fi

log "=== qa-sandbox-write-smoke complete (4 workflows) ==="
