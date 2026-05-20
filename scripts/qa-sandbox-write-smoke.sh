#!/usr/bin/env bash
# PHI-safe sandbox write smoke: status, time move, create, demographics.
# Per workflow: dry-run → backup → commit → restore → hash revert.
# Logs HTTP codes, workflows, operationId, hash prefixes, backup basenames only.
#
# Write confirmation reads SCHEDULE.DBF / PATIENT.DBF directly (qa-sandbox-readback CLI).
# The SQLite mirror is NOT refreshed on commit — do not use mirror tables for post-write readback.
#
# Requires:
#   SQLITE_PATH   — mirror sqlite (fixture ids, sparse dates, optional audit SQL)
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
BRIDGE_PKG="${QA_REPO}/services/bridge"
READBACK_CLI="${BRIDGE_PKG}/dist/cli/qa-sandbox-readback.js"

JQ_WRITE='{operationId, workflow, mode, committed, fieldsChanged, warnings: [.warnings[]? | {code, severity}]}'
CURRENT_WORKFLOW=""

log() { echo "[qa-write-smoke] $*"; }

section_banner() {
  echo ""
  echo "---------- $* ----------"
  echo ""
}

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
if [[ ! -f "${READBACK_CLI}" ]]; then
  log "FAIL: missing ${READBACK_CLI} (run bridge build)"
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

assert_backup_dir() {
  local manifest_path="$1" workflow="$2"
  if [[ -z "${manifest_path}" || ! -d "${manifest_path}" ]]; then
    log "FAIL: backup directory missing workflow=${workflow}"
    exit 1
  fi
  log "backup_dir workflow=${workflow} basename=$(basename "${manifest_path}")"
}

operation_id_from_raw() {
  body_from_raw "$1" | jq -r '.operationId // empty' 2>/dev/null || true
}

dbf_readback() {
  (cd "${BRIDGE_PKG}" && DATA_ROOT="${DATA_ROOT}" node dist/cli/qa-sandbox-readback.js "$@")
}

assert_dbf_schedule_status() {
  local appt_id="$1" expected="$2" workflow="$3"
  local actual
  actual="$(dbf_readback schedule-status "${appt_id}" 2>/dev/null || true)"
  if [[ "${actual}" != "${expected}" ]]; then
    log "FAIL: dbf readback workflow=${workflow} expected_status=${expected} got=${actual:-none}"
    exit 1
  fi
  log "readback workflow=${workflow} source=dbf appointment_id=${appt_id} status=${actual}"
}

assert_dbf_patient_chart() {
  local patient_id="$1" expected="$2" workflow="$3"
  local actual
  actual="$(dbf_readback patient-chart "${patient_id}" 2>/dev/null || true)"
  if [[ "${actual}" != "${expected}" ]]; then
    log "FAIL: dbf readback workflow=${workflow} expected_chart_set=yes got=${actual:-none}"
    exit 1
  fi
  log "readback workflow=${workflow} source=dbf patient_id=${patient_id} chart_number_set=yes"
}

assert_dbf_schedule_exists() {
  local appt_id="$1" workflow="$2"
  local actual
  actual="$(dbf_readback schedule-exists "${appt_id}" 2>/dev/null || true)"
  if [[ "${actual}" != "ok" ]]; then
    log "FAIL: dbf readback workflow=${workflow} appointment_id=${appt_id} not_in_schedule_dbf"
    exit 1
  fi
  log "readback workflow=${workflow} source=dbf appointment_id=${appt_id} schedule_row=present"
}

# Write audit rows are recorded today only for appointment.statusUpdate (see appointment-status-audit.ts).
assert_audit_operation() {
  local op_id="$1" workflow="$2"
  if [[ "${workflow}" != "appointment.statusUpdate" ]]; then
    log "audit workflow=${workflow} skipped (audit not implemented for this workflow)"
    return 0
  fi
  [[ -n "${op_id}" ]] || {
    log "FAIL: audit check workflow=${workflow} missing operationId"
    exit 1
  }
  local audit_raw match
  audit_raw="$(curl -sS "${BRIDGE_URL}/v1/meta/write-audit-recent" 2>/dev/null || true)"
  if echo "${audit_raw}" | jq -e '.sqliteUsable == true' >/dev/null 2>&1; then
    match="$(echo "${audit_raw}" | jq -r --arg op "${op_id}" --arg wf "${workflow}" \
      '[.entries[] | select(.operationId == $op and .workflow == $wf and .terminalStatus == "success")] | length' \
      2>/dev/null || echo "0")"
    if [[ "${match}" -lt 1 ]]; then
      log "FAIL: audit workflow=${workflow} operationId=${op_id} not success in recent"
      exit 1
    fi
    log "audit workflow=${workflow} operationId=${op_id} terminalStatus=success"
    return 0
  fi
  match="$(sqlite3 "${SQLITE_PATH}" \
    "SELECT COUNT(*) FROM write_audit_log WHERE operation_id='${op_id}' AND workflow_type='${workflow}' AND terminal_status='success';" \
    2>/dev/null || echo "0")"
  if [[ "${match}" -lt 1 ]]; then
    log "FAIL: sqlite audit workflow=${workflow} operationId=${op_id} not success"
    exit 1
  fi
  log "audit workflow=${workflow} operationId=${op_id} terminalStatus=success"
}

# Call compiled CLIs directly — qa-sandbox-run.sh already built dist. Avoid pnpm legacy:* wrappers
# here: they rebuild bridge mid-smoke and can kill the live node dist/server.js (curl exit 7).
run_legacy_backup() {
  local workflow="$1"
  export DATA_ROOT BACKUP_DIR WORKFLOW="${workflow}"
  (cd "${QA_REPO}/services/bridge" && node dist/cli/legacy-backup.js) >/dev/null
}

run_legacy_restore() {
  local manifest="$1"
  export BACKUP_MANIFEST="${manifest}" DATA_ROOT
  (cd "${QA_REPO}/services/bridge" && node dist/cli/legacy-restore.js) >/dev/null
}

APPT_ID="$(sqlite3 "${SQLITE_PATH}" "SELECT appointment_id FROM appointments LIMIT 1;")"
PATIENT_ID="$(sqlite3 "${SQLITE_PATH}" "SELECT patient_id FROM patients LIMIT 1;")"

if [[ -z "${APPT_ID}" ]]; then
  log "FAIL: no appointment_id in mirror sqlite"
  exit 1
fi
if [[ -z "${PATIENT_ID}" ]]; then
  log "FAIL: no patient_id in mirror sqlite (run mirror import first)"
  exit 1
fi

STATUS_BEFORE="$(dbf_readback schedule-status "${APPT_ID}" 2>/dev/null || true)"
if [[ -z "${STATUS_BEFORE}" || ! "${STATUS_BEFORE}" =~ ^[0-9]+$ ]]; then
  log "FAIL: could not read baseline STATUS from SCHEDULE.DBF for appointment_id=${APPT_ID}"
  exit 1
fi
STATUS_AFTER=$(( (STATUS_BEFORE + 1) % 6 ))

section_banner "Fixture discovery"
log "appointment_id=${APPT_ID} patient_id_present=yes status_before=${STATUS_BEFORE}"

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
assert_backup_dir "${BACKUP_ST}" "${CURRENT_WORKFLOW}"

raw=$(curl_write PATCH "/v1/schedule/appointments/${APPT_ID}/status" commit "{\"status\":${STATUS_AFTER}}")
http=$(http_from_raw "${raw}")
committed=$(body_from_raw "${raw}" | jq -r '.committed // empty' 2>/dev/null || true)
OP_ST=$(operation_id_from_raw "${raw}")
H2=$(hash_schedule)
log_write_response "${CURRENT_WORKFLOW}" commit "${http}" "${raw}"
if [[ "${http}" != "200" || "${committed}" != "true" || "${H0}" == "${H2}" ]]; then
  log "${CURRENT_WORKFLOW} commit FAIL"
  exit 1
fi
assert_dbf_schedule_status "${APPT_ID}" "${STATUS_AFTER}" "${CURRENT_WORKFLOW}"
assert_audit_operation "${OP_ST}" "${CURRENT_WORKFLOW}"

[[ -n "${BACKUP_ST}" ]] && run_legacy_restore "${BACKUP_ST}"
H3=$(hash_schedule)
if [[ "${H0}" == "${H3}" ]]; then
  assert_dbf_schedule_status "${APPT_ID}" "${STATUS_BEFORE}" "${CURRENT_WORKFLOW}"
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
CANDIDATE_DATES=("2026-05-22" "2026-05-25" "2026-06-01" "${SPARSE_DATES[@]}")

try_time_move_dry_run() {
  local date="$1" time="$2" room="$3"
  local raw http
  raw=$(curl_write PATCH "/v1/schedule/appointments/${APPT_ID}/time" dry-run \
    "{\"date\":\"${date}\",\"time\":\"${time}\",\"room\":${room}}")
  http_from_raw "${raw}"
}

discover_free_slot() {
  local current_slot="$1"
  local date time room http candidate
  for date in "${CANDIDATE_DATES[@]}"; do
    [[ -n "${date}" ]] || continue
    for room in $(seq 1 25); do
      for hour in $(seq 8 17); do
        for min in 00 15 30 45; do
          time=$(printf "%02d:%02d" "${hour}" "${min}")
          candidate="${date}|${time}|${room}"
          if [[ -n "${current_slot}" && "${candidate}" == "${current_slot}" ]]; then
            continue
          fi
          http=$(try_time_move_dry_run "${date}" "${time}" "${room}")
          if [[ "${http}" == "200" ]]; then
            echo "${candidate}"
            return 0
          fi
        done
      done
    done
  done
  return 1
}

log "=== ${CURRENT_WORKFLOW}: discovering conflict-free slot (dry-run) ==="
CURRENT_SLOT="$(dbf_readback schedule-slot "${APPT_ID}" 2>/dev/null || true)"
SLOT="$(discover_free_slot "${CURRENT_SLOT}" || true)"
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
assert_backup_dir "${BACKUP_TM}" "${CURRENT_WORKFLOW}"

raw=$(curl_write PATCH "/v1/schedule/appointments/${APPT_ID}/time" commit \
  "{\"date\":\"${MOVE_DATE}\",\"time\":\"${MOVE_TIME}\",\"room\":${MOVE_ROOM}}")
http=$(http_from_raw "${raw}")
committed=$(body_from_raw "${raw}" | jq -r '.committed // empty' 2>/dev/null || true)
OP_TM=$(operation_id_from_raw "${raw}")
H2=$(hash_schedule)
log_write_response "${CURRENT_WORKFLOW}" commit "${http}" "${raw}"
SLOT_AFTER="$(dbf_readback schedule-slot "${APPT_ID}" 2>/dev/null || true)"
EXPECTED_SLOT="${MOVE_DATE}|${MOVE_TIME}|${MOVE_ROOM}"
if [[ "${http}" != "200" || "${committed}" != "true" ]]; then
  log "${CURRENT_WORKFLOW} commit FAIL"
  exit 1
fi
if [[ "${SLOT_AFTER}" != "${EXPECTED_SLOT}" ]]; then
  log "FAIL: dbf readback workflow=${CURRENT_WORKFLOW} expected_slot=${EXPECTED_SLOT} got=${SLOT_AFTER:-none}"
  exit 1
fi
log "readback workflow=${CURRENT_WORKFLOW} source=dbf appointment_id=${APPT_ID} slot=${SLOT_AFTER}"
assert_audit_operation "${OP_TM}" "${CURRENT_WORKFLOW}"

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
assert_backup_dir "${BACKUP_CR}" "${CURRENT_WORKFLOW}"

raw=$(curl_post "/v1/schedule/appointments" commit "${CREATE_BODY}")
http=$(http_from_raw "${raw}")
committed=$(body_from_raw "${raw}" | jq -r '.committed // empty' 2>/dev/null || true)
OP_CR=$(operation_id_from_raw "${raw}")
CREATE_ID="$(body_from_raw "${raw}" | jq -r '.recordIds[0] // empty' 2>/dev/null || true)"
H2=$(hash_schedule)
log_write_response "${CURRENT_WORKFLOW}" commit "${http}" "${raw}"
if [[ "${http}" != "200" || "${committed}" != "true" || "${H0}" == "${H2}" ]]; then
  log "${CURRENT_WORKFLOW} commit FAIL"
  exit 1
fi
[[ -n "${CREATE_ID}" ]] || {
  log "FAIL: ${CURRENT_WORKFLOW} commit missing recordIds[0]"
  exit 1
}
assert_dbf_schedule_exists "${CREATE_ID}" "${CURRENT_WORKFLOW}"
assert_audit_operation "${OP_CR}" "${CURRENT_WORKFLOW}"

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
assert_backup_dir "${BACKUP_DM}" "${CURRENT_WORKFLOW}"

raw=$(curl_write PATCH "/v1/patients/${PATIENT_ID}/demographics" commit '{"chartNumber":"QA-COMMIT-1"}')
http=$(http_from_raw "${raw}")
committed=$(body_from_raw "${raw}" | jq -r '.committed // empty' 2>/dev/null || true)
OP_DM=$(operation_id_from_raw "${raw}")
H2=$(hash_patient)
log_write_response "${CURRENT_WORKFLOW}" commit "${http}" "${raw}"
if [[ "${http}" != "200" || "${committed}" != "true" || "${H0}" == "${H2}" ]]; then
  log "${CURRENT_WORKFLOW} commit FAIL"
  exit 1
fi
assert_dbf_patient_chart "${PATIENT_ID}" "QA-COMMIT-1" "${CURRENT_WORKFLOW}"
assert_audit_operation "${OP_DM}" "${CURRENT_WORKFLOW}"

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

section_banner "Final summary"
log "=== qa-sandbox-write-smoke complete (4 workflows) ==="
