#!/usr/bin/env bash
set -euo pipefail

export QA_REPO="/Users/Tamam/Desktop/Microdent/Microdent-Modern"
export SANDBOX_ROOT="/Users/Tamam/Desktop/Microdent/Microdent-Write-Sandbox"
export DATA_ROOT="${SANDBOX_ROOT}/DATA"
export BACKUP_DIR="${SANDBOX_ROOT}/backups"
export SQLITE_PATH="/Users/Tamam/Desktop/Microdent/MICRODENT_MIRROR_SANDBOX.sqlite"
export BRIDGE_URL="http://127.0.0.1:17890"
LOG="${QA_REPO}/qa-runs/2026-05-18-e2e-commands.log"
GLOG="${QA_REPO}/qa-runs/2026-05-18-phase-g.log"
cd "${QA_REPO}"

JQ_WRITE='{operationId, workflow, mode, committed, fieldsChanged, warnings: [.warnings[]? | {code, severity}]}'

log() { echo "[G] $*" | tee -a "$LOG" | tee -a "$GLOG"; }
record() { echo "$1|$2|$3|$4" >> "${QA_REPO}/qa-runs/2026-05-18-phase-g-results.tsv"; }

APPT_ID=$(sqlite3 "${SQLITE_PATH}" "SELECT appointment_id FROM appointments LIMIT 1;")
PATIENT_ID=$(sqlite3 "${SQLITE_PATH}" "SELECT patient_id FROM patients LIMIT 1;")
STATUS_BEFORE=$(sqlite3 "${SQLITE_PATH}" "SELECT status_code FROM appointments WHERE appointment_id='${APPT_ID}' LIMIT 1;")
STATUS_AFTER=$(( (STATUS_BEFORE + 1) % 6 ))
APPT_DATE=$(sqlite3 "${SQLITE_PATH}" "SELECT appointment_date FROM appointments WHERE appointment_id='${APPT_ID}' LIMIT 1;")
APPT_TIME=$(sqlite3 "${SQLITE_PATH}" "SELECT start_time FROM appointments WHERE appointment_id='${APPT_ID}' LIMIT 1;")

# sandbox guards
if ! realpath "${DATA_ROOT}" | grep -q 'Microdent-Write-Sandbox'; then
  log "FAIL sandbox realpath"; exit 1
fi
test -f "${DATA_ROOT}/.microdent-write-sandbox.json" || { log "FAIL marker"; exit 1; }

hash_schedule() { shasum -a 256 "${DATA_ROOT}/SCHEDULE.DBF" 2>/dev/null | awk '{print $1}'; }
hash_patient() { shasum -a 256 "${DATA_ROOT}/PATIENT.DBF" 2>/dev/null | awk '{print $1}'; }

curl_write() {
  local method="$1" url="$2" intent="$3" body="$4"
  curl -sS -w "\n__HTTP__%{http_code}" -X "$method" "${BRIDGE_URL}${url}" \
    -H "Content-Type: application/json" -H "Accept: application/json" \
    -H "X-Write-Intent: ${intent}" -d "$body"
}

parse_response() {
  local raw="$1"
  local http body
  http=$(echo "$raw" | grep '__HTTP__' | sed 's/.*__HTTP__//')
  body=$(echo "$raw" | sed '/__HTTP__/d')
  echo "$http"
  echo "$body" | jq "$JQ_WRITE" 2>/dev/null || echo "$body"
}

# --- G1 status ---
log "=== G1 appointment.statusUpdate appt=$APPT_ID before=$STATUS_BEFORE after=$STATUS_AFTER ==="
H0=$(hash_schedule)
log "baseline SCHEDULE hash=$H0"

raw=$(curl_write PATCH "/v1/schedule/appointments/${APPT_ID}/status" dry-run "{\"status\":${STATUS_AFTER}}")
http=$(echo "$raw" | grep '__HTTP__' | sed 's/.*__HTTP__//')
H1=$(hash_schedule)
if [[ "$http" == "200" && "$H0" == "$H1" ]]; then record "G1-dry-run" "pass" "$http" "hash unchanged"; else record "G1-dry-run" "fail" "$http" "hash $H0->$H1"; fi
log "G1 dry-run http=$http hash_unchanged=$([[ "$H0" == "$H1" ]] && echo yes || echo no)"

export DATA_ROOT BACKUP_DIR WORKFLOW=appointment.statusUpdate
pnpm legacy:backup 2>&1 | tee -a "$GLOG" | tee -a "$LOG"
BACKUP_G1=$(ls -1dt "${BACKUP_DIR}"/*appointment.statusUpdate* 2>/dev/null | head -1)
log "G1 backup=$BACKUP_G1"

raw=$(curl_write PATCH "/v1/schedule/appointments/${APPT_ID}/status" commit "{\"status\":${STATUS_AFTER}}")
http=$(echo "$raw" | grep '__HTTP__' | sed 's/.*__HTTP__//')
committed=$(echo "$raw" | sed '/__HTTP__/d' | jq -r '.committed // empty')
H2=$(hash_schedule)
SC=$(sqlite3 "${SQLITE_PATH}" "SELECT status_code FROM appointments WHERE appointment_id='${APPT_ID}' LIMIT 1;")
if [[ "$http" == "200" && "$committed" == "true" && "$H0" != "$H2" ]]; then record "G1-commit" "pass" "$http" "mirror status still $SC (stale until reimport)"; else record "G1-commit" "fail" "$http" "committed=$committed"; fi
log "G1 commit http=$http committed=$committed hash_changed=$([[ "$H0" != "$H2" ]] && echo yes || echo no)"

export BACKUP_MANIFEST="$BACKUP_G1" DATA_ROOT
pnpm legacy:restore 2>&1 | tee -a "$GLOG" | tee -a "$LOG"
H3=$(hash_schedule)
SC2=$(sqlite3 "${SQLITE_PATH}" "SELECT status_code FROM appointments WHERE appointment_id='${APPT_ID}' LIMIT 1;")
if [[ "$H0" == "$H3" ]]; then record "G1-restore" "pass" "0" "hash reverted"; else record "G1-restore" "fail" "0" "hash $H0 vs $H3"; fi
log "G1 restore hash_match=$([[ "$H0" == "$H3" ]] && echo yes || echo no)"

# blocked key spot check G1
raw=$(curl_write PATCH "/v1/schedule/appointments/${APPT_ID}/status" commit '{"status":1,"COMMENT":"x"}')
http=$(echo "$raw" | grep '__HTTP__' | sed 's/.*__HTTP__//')
record "G1-blocked-COMMENT" "$([[ "$http" == "400" ]] && echo pass || echo fail)" "$http" "expected 400"

# --- G2 time move ---
TIME_NEW="18:00"
DATE_NEW="$APPT_DATE"
log "=== G2 appointment.timeMove date=$DATE_NEW time=$TIME_NEW ==="
H0=$(hash_schedule)
raw=$(curl_write PATCH "/v1/schedule/appointments/${APPT_ID}/time" dry-run "{\"date\":\"${DATE_NEW}\",\"time\":\"${TIME_NEW}\",\"room\":1}")
http=$(echo "$raw" | grep '__HTTP__' | sed 's/.*__HTTP__//')
H1=$(hash_schedule)
record "G2-dry-run" "$([[ "$http" == "200" && "$H0" == "$H1" ]] && echo pass || echo fail)" "$http" "hash"

export WORKFLOW=appointment.timeMove
pnpm legacy:backup 2>&1 | tee -a "$GLOG" >> "$LOG"
BACKUP_G2=$(ls -1dt "${BACKUP_DIR}"/*appointment.timeMove* 2>/dev/null | head -1)

raw=$(curl_write PATCH "/v1/schedule/appointments/${APPT_ID}/time" commit "{\"date\":\"${DATE_NEW}\",\"time\":\"${TIME_NEW}\",\"room\":1}")
http=$(echo "$raw" | grep '__HTTP__' | sed 's/.*__HTTP__//')
H2=$(hash_schedule)
record "G2-commit" "$([[ "$http" == "200" && "$H0" != "$H2" ]] && echo pass || echo fail)" "$http" "hash"

export BACKUP_MANIFEST="$BACKUP_G2" DATA_ROOT
pnpm legacy:restore 2>&1 | tee -a "$GLOG" >> "$LOG"
H3=$(hash_schedule)
record "G2-restore" "$([[ "$H0" == "$H3" ]] && echo pass || echo fail)" "0" "hash"

raw=$(curl_write PATCH "/v1/schedule/appointments/${APPT_ID}/time" commit "{\"date\":\"${DATE_NEW}\",\"time\":\"${TIME_NEW}\",\"room\":1,\"PAT_NAME\":\"x\"}")
http=$(echo "$raw" | grep '__HTTP__' | sed 's/.*__HTTP__//')
record "G2-blocked-PAT_NAME" "$([[ "$http" == "400" ]] && echo pass || echo fail)" "$http" "expected 400"

# --- G3 create ---
CREATE_BODY="{\"patId\":\"${PATIENT_ID}\",\"date\":\"2026-05-22\",\"time\":\"09:00\",\"room\":1,\"durationSlots\":1}"
log "=== G3 appointment.create ==="
H0=$(hash_schedule)
raw=$(curl -sS -w "\n__HTTP__%{http_code}" -X POST "${BRIDGE_URL}/v1/schedule/appointments" \
  -H "Content-Type: application/json" -H "X-Write-Intent: dry-run" -d "$CREATE_BODY")
http=$(echo "$raw" | grep '__HTTP__' | sed 's/.*__HTTP__//')
H1=$(hash_schedule)
record "G3-dry-run" "$([[ "$http" == "200" && "$H0" == "$H1" ]] && echo pass || echo fail)" "$http" "hash"

export WORKFLOW=appointment.create
pnpm legacy:backup 2>&1 | tee -a "$GLOG" >> "$LOG"
BACKUP_G3=$(ls -1dt "${BACKUP_DIR}"/*appointment.create* 2>/dev/null | head -1)

raw=$(curl -sS -w "\n__HTTP__%{http_code}" -X POST "${BRIDGE_URL}/v1/schedule/appointments" \
  -H "Content-Type: application/json" -H "X-Write-Intent: commit" -d "$CREATE_BODY")
http=$(echo "$raw" | grep '__HTTP__' | sed 's/.*__HTTP__//')
H2=$(hash_schedule)
record "G3-commit" "$([[ "$http" == "200" && "$H0" != "$H2" ]] && echo pass || echo fail)" "$http" "hash"

export BACKUP_MANIFEST="$BACKUP_G3" DATA_ROOT
pnpm legacy:restore 2>&1 | tee -a "$GLOG" >> "$LOG"
H3=$(hash_schedule)
record "G3-restore" "$([[ "$H0" == "$H3" ]] && echo pass || echo fail)" "0" "hash"

raw=$(curl -sS -w "\n__HTTP__%{http_code}" -X POST "${BRIDGE_URL}/v1/schedule/appointments" \
  -H "Content-Type: application/json" -H "X-Write-Intent: commit" -d "{\"patId\":\"${PATIENT_ID}\",\"date\":\"2026-05-22\",\"time\":\"09:00\",\"room\":1,\"durationSlots\":1,\"TELEPHONE\":\"x\"}")
http=$(echo "$raw" | grep '__HTTP__' | sed 's/.*__HTTP__//')
record "G3-blocked-TELEPHONE" "$([[ "$http" == "400" ]] && echo pass || echo fail)" "$http" "expected 400"

# --- G4 demographics ---
log "=== G4 patient.demographics.update patient=$PATIENT_ID ==="
H0=$(hash_patient)
raw=$(curl_write PATCH "/v1/patients/${PATIENT_ID}/demographics" dry-run '{"chartNumber":"QA-DRY-ONLY"}')
http=$(echo "$raw" | grep '__HTTP__' | sed 's/.*__HTTP__//')
H1=$(hash_patient)
record "G4-dry-run" "$([[ "$http" == "200" && "$H0" == "$H1" ]] && echo pass || echo fail)" "$http" "hash"

export WORKFLOW=patient.demographics.update
pnpm legacy:backup 2>&1 | tee -a "$GLOG" >> "$LOG"
BACKUP_G4=$(ls -1dt "${BACKUP_DIR}"/*patient.demographics.update* 2>/dev/null | head -1)

raw=$(curl_write PATCH "/v1/patients/${PATIENT_ID}/demographics" commit '{"chartNumber":"QA-COMMIT-1"}')
http=$(echo "$raw" | grep '__HTTP__' | sed 's/.*__HTTP__//')
H2=$(hash_patient)
record "G4-commit" "$([[ "$http" == "200" && "$H0" != "$H2" ]] && echo pass || echo fail)" "$http" "hash"

export BACKUP_MANIFEST="$BACKUP_G4" DATA_ROOT
pnpm legacy:restore 2>&1 | tee -a "$GLOG" >> "$LOG"
H3=$(hash_patient)
record "G4-restore" "$([[ "$H0" == "$H3" ]] && echo pass || echo fail)" "0" "hash"

raw=$(curl_write PATCH "/v1/patients/${PATIENT_ID}/demographics" commit '{"chartNumber":"QA","HOME_PHONE":"555"}')
http=$(echo "$raw" | grep '__HTTP__' | sed 's/.*__HTTP__//')
record "G4-blocked-HOME_PHONE" "$([[ "$http" == "400" ]] && echo pass || echo fail)" "$http" "expected 400"

# audit check
log "=== G audit (ids only) ==="
sqlite3 "${SQLITE_PATH}" "SELECT operation_id, workflow_type, execution_mode, status FROM write_audit_log ORDER BY requested_at DESC LIMIT 5;" 2>&1 | tee -a "$GLOG" || log "audit table N/A or empty"

# list backups created
log "=== backups ==="
ls -1 "${BACKUP_DIR}" 2>/dev/null | tee -a "$GLOG"

log "=== G done ==="
