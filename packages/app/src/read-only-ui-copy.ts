/**
 * Shared user-visible copy for the read-only clinic viewer.
 * Import from here so empty/offline/privacy wording stays consistent across screens.
 */

export const READ_ONLY_VIEWER_LABEL = "Read-only viewer";

export const READ_ONLY_CONNECTED_LABEL = "Connected to copied clinic data";

export const READ_ONLY_MODE_LABEL = "Read-only mode";

export const READ_ONLY_BANNER_BODY =
  "Pilot read-only viewer — clinic data cannot be changed here. Names, phones, notes, and payment amounts stay hidden.";

export const HIDDEN_IN_READONLY_VIEWER = "hidden in this read-only viewer";

export const CLINIC_SERVICE_OFFLINE_TITLE = "Clinic service offline";

export const CLINIC_SERVICE_OFFLINE_PANEL =
  "Connect the bridge and wait until the top bar shows Connected, then try again.";

export const CLINIC_SERVICE_OFFLINE_SECTION = "Connect the bridge to load this section.";

export const CLINIC_SERVICE_CHECKING = "Waiting for the clinic service…";

export const CLINIC_SERVICE_CONNECT_SCHEDULE = "Connect the clinic service to load your schedule.";

export const SCHEDULE_LOAD_ERROR =
  "Could not load the schedule. Check the clinic service connection and tap Refresh.";

export const CLINIC_SERVICE_CONNECT_TODAY =
  "Connect the clinic service to load today’s appointments from your copied data.";

export const PATIENT_PROFILE_READONLY_NOTE =
  "Read-only patient record — safe fields from your copied data only. Nothing here can be edited.";

export const PATIENT_PAGE_SEARCH_TITLE = "Find a patient";

export const PATIENT_PAGE_SEARCH_LEDE =
  "Search by name or chart number when the clinic service is connected. There is no full patient directory in this read-only viewer — only matches for your query are shown.";

export const PATIENT_PAGE_SEARCH_PRIVACY =
  "Uses your copied clinic data. Names, chart numbers, record ids, and masked phone hints only — no notes, addresses, or payment fields.";

export const PATIENT_MODULE_TABS_HINT =
  "After you open a patient, use the Chart, Treatments, and Ledger preview tabs for dental chart, procedure history, and ledger metadata (read-only; sensitive fields stay hidden).";

export const PATIENT_CHANGE_PATIENT_LABEL = "Search another patient";

export const PATIENT_NO_SELECTION_DESCRIPTION =
  "Search below or in the top bar, pick a row when the clinic service is connected, and this area will open their record.";

export const PATIENT_TAB_SUMMARY_LEDE =
  "Safe demographics from your copied patient file. Addresses, coverage details, and clinical notes stay hidden.";

export const PATIENT_TAB_APPOINTMENTS_LEDE =
  "Appointment history is read-only. Schedule note text and unlisted patient fields stay hidden.";

export const PATIENT_TAB_MEDICAL_LEDE =
  "Medical summary is read-only. Detailed notes and allergy text stay hidden.";

export const PATIENT_TAB_TREATMENTS_LEDE =
  "Procedure history is read-only. Memos, per-line descriptions, and fees stay hidden.";

export const PATIENT_TAB_CHART_LEDE =
  "Dental chart is read-only. Chart memos and clinical labels stay hidden.";

export const PATIENT_TAB_LEDGER_LEDE =
  "Ledger lines are read-only. Amounts, memo text, and insurance identifiers stay hidden.";

export const SENSITIVE_MEDICAL_BANNER =
  "This patient has medical details on file in the legacy system. Sensitive fields are hidden in this read-only viewer.";

export const TRUNCATED_LIST_BANNER =
  "Showing a capped list only. Additional lines are omitted in this read-only viewer.";

export const SCHEDULE_PRIVACY_LEDE =
  "Read-only schedule. Names and chart numbers use a safe patient summary; notes and phone numbers stay hidden.";

export const TODAY_PRIVACY_LEDE =
  "Read-only day list. Names and chart numbers use a safe patient summary; notes, phones, and payment fields stay hidden.";

export const TODAY_LOADING = "Loading today's schedule from your clinic copy…";

export const TODAY_NEXT_LOADING = "Loading next appointment…";

export const TODAY_EMPTY_TITLE = "No appointments today";

export const TODAY_EMPTY_DESCRIPTION =
  "Today's list is clear. Open the full schedule to check other days, or search for a patient.";

export const TODAY_OPEN_SCHEDULE = "Open schedule";

export const TODAY_SEARCH_PATIENT = "Search patient";

export const TODAY_NEXT_OFFLINE =
  "Connect the clinic service to see the next appointment on today's copy.";

export const TODAY_NEXT_NO_UPCOMING = "No upcoming appointments on the schedule for today.";

export const TODAY_REMINDERS_EMPTY =
  "No reminders in this read-only viewer. Connect the clinic service and use Schedule or Patients for live data from your copy.";


export const TODAY_QUICK_ACTIONS_LEDE = "Front-desk shortcuts when the clinic service is connected.";

export const PATIENT_SEARCH_HINT_CONNECTED = "Uses your copied clinic data. Names and safe hints only.";

export const PATIENT_SEARCH_HINT_OFFLINE = "Search is off until the clinic service is connected.";

export const PATIENT_SEARCH_OFFLINE_BANNER =
  "Patient search needs the clinic service. Connect the bridge and wait until the top bar shows Connected.";

export const PATIENT_SEARCH_OFFLINE_STATUS = "Connect the clinic service to search patients.";


export const PATIENT_SEARCH_IDLE = "Type a name or chart number (at least 2 characters).";

export const PATIENT_SEARCH_TOO_SHORT = "Enter at least 2 letters or numbers.";

export const PATIENT_SEARCH_SEARCHING = "Searching…";

export const PATIENT_SEARCH_NO_MATCH =
  "No patients matched. Try a different spelling or chart number.";

export const PATIENT_SEARCH_DROPDOWN_NO_MATCH = "No patients matched.";

export const SCHEDULE_VIEW_LABEL = "Schedule view";

export const SCHEDULE_VIEW_WEEK = "Week";

export const SCHEDULE_VIEW_DAY = "Day";

export const SCHEDULE_NAV_PREV_DAY = "Previous day";

export const SCHEDULE_NAV_PREV_WEEK = "Previous week";

export const SCHEDULE_NAV_NEXT_DAY = "Next day";

export const SCHEDULE_NAV_NEXT_WEEK = "Next week";

export const SCHEDULE_LOADING = "Loading schedule from your clinic copy…";

export const READONLY_STATE_RETRY = "Retry";

export const PATIENT_PROFILE_LOADING = "Loading profile…";

export const PATIENT_PROFILE_WAITING_TITLE = "Waiting for the clinic service";

export const PATIENT_TAB_LOADING_APPOINTMENTS = "Loading appointment history…";

export const PATIENT_TAB_LOADING_MEDICAL = "Loading medical summary…";

export const PATIENT_TAB_LOADING_TREATMENTS = "Loading treatments…";

export const PATIENT_TAB_LOADING_CHART = "Loading dental chart…";

export const PATIENT_TAB_LOADING_LEDGER = "Loading ledger preview…";

export const PATIENT_TAB_OFFLINE_TREATMENTS = "Connect the bridge to load treatment history.";

export const PATIENT_SANDBOX_DEMOGRAPHICS_TITLE = "Sandbox demographics (pilot)";

export const PATIENT_DEMOGRAPHICS_DOCTOR_ID_HINT =
  "Numeric doctor id from the profile only — no names from clinic data.";


export const SCHEDULE_EMPTY_TITLE = "No appointments in this range";

export const SCHEDULE_EMPTY_DESCRIPTION =
  "Try another day or week, change the room filter, or refresh after the clinic service loads data.";

export const SCHEDULE_ROOM_FILTER_LABEL = "Room";

export const SCHEDULE_ROOM_ALL = "All rooms";

export const SCHEDULE_KEYBOARD_HINT = "Tip: ← → move the range; T jumps to today.";

export const MODULE_PLACEHOLDER_TITLE = "Not available yet";

export const MODULE_PLACEHOLDER_DESCRIPTION =
  "This module is not available in the read-only viewer yet. Use Today, Patients, or Schedule for live data from your copy.";

export const TAB_UNAVAILABLE_TITLE = "Not available in this read-only viewer";

export const MIRROR_STALE_BANNER_LABEL = "Local copy may be outdated";

export const MIRROR_STALE_BANNER_BODY =
  "The SQLite mirror has not been refreshed recently. Search and schedule may show older data until your operator runs a safe mirror import (see Settings → Mirror import).";

export const MIRROR_ACTIVE_BANNER_LABEL = "SQLite mirror active";

export const MIRROR_ACTIVE_BANNER_BODY =
  "Search and schedule use your imported SQLite mirror. Run a safe mirror import when copied data must be fresher — DBF remains the write source of truth.";

export const MIRROR_FALLBACK_BANNER_LABEL = "Using DBF fallback";

export const MIRROR_FALLBACK_BANNER_BODY =
  "The SQLite mirror is unavailable. Search and schedule read legacy DBF files directly until mirror import succeeds.";

export const WRITE_MODE_DISABLED_BANNER_LABEL = "Writes disabled";

export const WRITE_MODE_DISABLED_BANNER_BODY =
  "The bridge will not apply changes. Dry-run and commit routes stay blocked until an operator enables write mode on the server.";

export const WRITE_MODE_DRY_RUN_BANNER_LABEL = "Write mode: dry-run";

export const WRITE_MODE_DRY_RUN_BANNER_BODY =
  "The bridge validates write plans only. Nothing is saved until write mode is set to enabled on a disposable sandbox.";

export const WRITE_MODE_ENABLED_BANNER_LABEL = "Write mode: enabled";

export const WRITE_MODE_ENABLED_BANNER_BODY =
  "The bridge may commit changes when routes and safety gates allow. Use only on disposable test data you can restore.";

export const SANDBOX_WRITE_WARNING_BANNER_LABEL = "Disposable sandbox";

export const SANDBOX_WRITE_WARNING_BANNER_BODY =
  "Writable sandbox is active. Commits change disposable DATA only — never production legacy folders.";

/** Per-row / panel sandbox write pilot warning (schedule + patient). */
export const SANDBOX_WRITE_PILOT_PANEL_BANNER =
  "Sandbox write pilot — commits change disposable DATA only. Capture operation id and backup lines for IT feedback.";

/** Once per schedule view when sandbox write pilots are active. */
export const SCHEDULE_SANDBOX_WRITE_PILOT_BANNER =
  "Sandbox write pilot — status and time changes affect disposable data only. Preview each row before applying; restore from backup if needed.";

export const APPOINTMENT_WRITE_ACTIONS_SUMMARY = "Sandbox write";

export const APPOINTMENT_WRITE_TAB_STATUS = "Change status";

export const APPOINTMENT_WRITE_TAB_MOVE = "Move time/room";

export const APPOINTMENT_STATUS_PREVIEW_LABEL = "Preview status change";

export const APPOINTMENT_STATUS_APPLY_LABEL = "Apply status change";

export const APPOINTMENT_TIME_MOVE_PREVIEW_LABEL = "Preview move";

export const APPOINTMENT_TIME_MOVE_APPLY_LABEL = "Apply move";

export const WRITE_MODE_CHIP_DISABLED = "Writes off";

export const WRITE_MODE_CHIP_DRY_RUN = "Dry-run";

export const WRITE_MODE_CHIP_ENABLED = "Writes on";

export const WRITE_OPERATION_ID_PREFIX = "Operation";

export const WRITE_BACKUP_CREATED_LINE = "Backup created for this change.";

export const WRITE_BACKUP_NOT_CREATED_LINE = "No backup was recorded for this change.";

export const WRITE_BACKUP_SKIPPED_LINE = "Backup not applicable (dry-run or uncommitted).";

export const WRITE_AUDIT_NOT_CONFIGURED = "Audit log: not configured on this bridge.";

export const WRITE_AUDIT_UNAVAILABLE = "Audit log: unavailable.";

export const WRITE_AUDIT_EMPTY = "Audit log: no recent entries.";

export const WRITE_RESTORE_CLI_HINT =
  "Restore (sandbox only): use legacy-restore CLI on Write-Sandbox DATA — see docs/pilot-backup-restore-audit.md in your package.";

export const WRITE_FAILED_GUIDANCE =
  "If the commit failed: keep the operation id, check bridge status codes only, and restore from backup if DBF may have changed.";

export const WRITE_AUDIT_STATUS_UPDATE_NOTE =
  "Audit detail is fullest for status-update commits today; other workflows show operation id, backup, and restore hints.";

export const SETTINGS_PANEL_LEDE =
  "Pilot status for bridge, mirror, writes, and sandbox readiness. No patient data is shown here — see docs/PILOT-HANDOFF-PACK.md for the full operator flow.";

export const SETTINGS_BRIDGE_SECTION = "Clinic service";

export const SETTINGS_DATA_PATHS_SECTION = "Data paths";

export const SETTINGS_MIRROR_SECTION = "Mirror import";

export const SETTINGS_WRITE_SECTION = "Writes";

export const SETTINGS_SANDBOX_SECTION = "Sandbox";

export const SETTINGS_SQLITE_MIRROR_SECTION = "SQLite mirror";

export const SETTINGS_BACKUP_SECTION = "Backup";

export const SETTINGS_PILOT_SECTION = "Sandbox pilot";

export const SETTINGS_DESKTOP_SECTION = "Desktop app";

export const SETTINGS_BRIDGE_CONNECTED = "Connected";

export const SETTINGS_BRIDGE_OFFLINE = "Offline";

export const SETTINGS_BRIDGE_CHECKING = "Checking connection…";

export const SETTINGS_SANDBOX_VALID = "Disposable sandbox valid";

export const SETTINGS_SANDBOX_INVALID = "Sandbox not valid for writes";

export const SETTINGS_SANDBOX_UNKNOWN = "Sandbox status unknown";

export const SETTINGS_BACKUP_CONFIGURED = "Backup folder configured";

export const SETTINGS_BACKUP_NOT_CONFIGURED = "Backup not configured";

export const SETTINGS_BACKUP_NOT_REQUIRED = "Not required while writes are off";

export const SETTINGS_BACKUP_UNKNOWN = "Backup status unknown";

export const SETTINGS_MIRROR_SQLITE_CONFIGURED = "SQLite path configured";

export const SETTINGS_MIRROR_SQLITE_MISSING = "SQLite path not configured";

export const SETTINGS_SQLITE_MIRROR_UNKNOWN = "SQLite mirror status unknown";


export const SETTINGS_MIRROR_USABLE = "Mirror in use for search and schedule";

export const SETTINGS_MIRROR_FALLBACK = "Using DBF fallback";

export const SETTINGS_MIRROR_IMPORTED_COUNT = "Imported tables";

export const SETTINGS_MIRROR_REFRESH = "Refresh status";

export const SETTINGS_MIRROR_NO_RUNS = "No import runs recorded.";

export const SETTINGS_MIRROR_NO_RUNS_HINT =
  "Run a safe mirror import from the command line (see docs/PILOT-HANDOFF-PACK.md § Mirror import), then refresh status here.";

export const SETTINGS_MIRROR_DOC_LINK = "Mirror import operator guide";

export const SETTINGS_MIRROR_STALE_CALLOUT =
  "Mirror metadata is older than 48 hours. Search and schedule may be stale until you import again.";

export const SETTINGS_MIRROR_DBF_SOURCE_TRUTH =
  "DBF files are the source of truth for writes. SQLite is a read snapshot — re-run safe mirror import after sandbox commits when search/schedule must match DBF.";

export const SETTINGS_READINESS_DISTRIBUTION_HINT =
  "Before IT handoff: run pnpm pilot:distribution-checkpoint on the build machine, or pnpm pilot:release-signoff when sandbox env is configured.";

export const SETTINGS_SANDBOX_PILOT_ON = "Sandbox write pilot enabled in this app build";

export const SETTINGS_SANDBOX_PILOT_OFF = "Sandbox write pilot not enabled in this app build";

export const SETTINGS_DATA_ROOT_CONFIGURED = "DATA_ROOT configured";

export const SETTINGS_DATA_ROOT_MISSING = "DATA_ROOT not configured";

export const SETTINGS_DATA_ROOT_UNKNOWN = "DATA_ROOT status unknown";

export const SETTINGS_DESKTOP_FILE_PROTOCOL =
  "Running as the packaged desktop app (local file protocol). Paths come from desktop setup config.";

export const SETTINGS_DESKTOP_BROWSER =
  "Running in the browser. Use the desktop installer for clinic file paths and bridge supervision.";

export const SETTINGS_MIRROR_IMPORT_CLI =
  "Run safe import from the command line, then refresh status here.";

export const SETTINGS_ENABLED_NON_SANDBOX_BANNER_LABEL = "Writes enabled outside sandbox";

export const SETTINGS_ENABLED_NON_SANDBOX_BANNER_BODY =
  "Write mode is enabled but DATA_ROOT did not pass the disposable sandbox guard. Stop the bridge and fix paths before committing changes.";

export const SETTINGS_BRIDGE_OFFLINE_BANNER_LABEL = "Clinic service offline";

export const SETTINGS_BRIDGE_OFFLINE_BANNER_BODY =
  "Settings cannot load bridge metadata until the clinic service is connected.";

export const SETTINGS_MIRROR_RUN_STATUS_SUCCESS = "Success";

export const SETTINGS_MIRROR_RUN_STATUS_PARTIAL = "Partial";

export const SETTINGS_MIRROR_RUN_STATUS_FAILED = "Failed";

export const SETTINGS_MIRROR_RUN_STATUS_RUNNING = "Running";

export const SETTINGS_MIRROR_IMPORT_COMMAND =
  "Set DATA_ROOT and SQLITE_PATH in PowerShell or bash, then run: pnpm mirror:import-safe (or pnpm --filter @microdent/sqlite-mirror run import-safe).";

export const SETTINGS_PILOT_READINESS_TITLE = "Pilot readiness";

export const SETTINGS_READINESS_READ_ONLY = "Read-only safe (writes off)";

export const SETTINGS_READINESS_WRITES_ACTIVE = "Writes active — sandbox pilot only";

export const SETTINGS_READINESS_MIRROR_ACTIVE = "Mirror active for search/schedule";

export const SETTINGS_READINESS_MIRROR_STALE = "Mirror stale (>48h) — re-import recommended";

export const SETTINGS_READINESS_MIRROR_FALLBACK = "Mirror unavailable — DBF fallback";

export const SETTINGS_READINESS_MIRROR_UNKNOWN = "Mirror status unknown";

export const SETTINGS_READINESS_SANDBOX_READY = "Sandbox pilot ready (marker + paths)";

export const SETTINGS_READINESS_SANDBOX_NOT_READY = "Sandbox not ready for commits";

export const SETTINGS_READINESS_BRIDGE_OFFLINE = "Clinic service offline — complete setup first";

export const SETTINGS_READINESS_BACKUP_CONFIGURED = "Backup folder configured";

export const SETTINGS_READINESS_BACKUP_NOT_CONFIGURED = "Backup not configured — required for commits";

export const SETTINGS_READINESS_READONLY_QA_HINT = "Read-only QA: run pnpm test + build:web";

export const SETTINGS_READINESS_SANDBOX_QA_HINT = "Sandbox QA: run phase-7 runbook (pnpm qa:sandbox)";

export const SETTINGS_PILOT_CHECKLIST_TITLE = "Pilot checklist";

export const SETTINGS_CHECKLIST_DATA_ROOT_SAFE = "DATA_ROOT safe (not production legacy)";

export const SETTINGS_CHECKLIST_MIRROR_IMPORT = "Latest mirror import healthy";

export const SETTINGS_NEXT_STEP_LABEL = "Next step";

export const SETTINGS_NEXT_STEP_BRIDGE =
  "Start the clinic service (desktop app or bridge) and wait until Settings shows Connected.";

export const SETTINGS_NEXT_STEP_DESKTOP_SETUP =
  "Complete desktop first-run setup to configure DATA_ROOT and SQLITE_PATH before the clinic service can start.";

export const SETTINGS_NEXT_STEP_DATA_ROOT =
  "Set DATA_ROOT in desktop setup or bridge env to your disposable Write-Sandbox DATA folder.";

export const SETTINGS_NEXT_STEP_DATA_ROOT_FORBIDDEN =
  "DATA_ROOT did not pass the disposable sandbox guard. Point the bridge at a sandbox folder with the marker — never production legacy.";

export const SETTINGS_NEXT_STEP_WRITE_DISABLED =
  "Writes are off. Enable dry-run or enabled only on a disposable sandbox after backup is configured.";

export const SETTINGS_NEXT_STEP_WRITE_DRY_RUN =
  "Dry-run plans changes only. Use Schedule or Patient write pilots to preview, then enable commits when ready.";

export const SETTINGS_NEXT_STEP_WRITE_ENABLED =
  "Writes are enabled on the sandbox. Use pilot panels only; never point DATA_ROOT at production legacy.";

export const SETTINGS_NEXT_STEP_SANDBOX =
  "Fix DATA_ROOT: point the bridge at a disposable sandbox folder with the write-sandbox marker before enabling commits.";

export const SETTINGS_NEXT_STEP_BACKUP =
  "Set BACKUP_DIR in desktop setup or bridge env before committing sandbox changes.";

export const SETTINGS_NEXT_STEP_PILOT_BUILD =
  "Rebuild the web app with VITE_SANDBOX_WRITE_PILOT=true to show write pilots in this UI.";

export const SETTINGS_NEXT_STEP_MIRROR_IMPORT =
  "Run the safe mirror import command from the operator guide, then Refresh status here.";

export const SETTINGS_NEXT_STEP_MIRROR_REFRESH = "Tap Refresh status after the clinic service connects.";

export const SETTINGS_NEXT_STEP_MIRROR_STALE =
  "Mirror metadata is stale. Re-run safe import; DBF remains the source of truth for writes.";

/** Recovery pointers — link to repo docs/PILOT-START-HERE.md (no URL with PHI). */
export const PILOT_TROUBLESHOOTING_DOC = "PILOT-START-HERE.md";

export const SETTINGS_RECOVERY_BRIDGE_OFFLINE =
  "Clinic service offline: complete desktop setup, confirm bridge dist is built, and ensure port 17890 is free. See PILOT-START-HERE.md § Troubleshooting.";

export const SETTINGS_RECOVERY_MIRROR_STALE =
  "Mirror stale: run safe mirror import from the operator guide, then Refresh status in Settings. DBF stays the write source of truth.";

export const SETTINGS_RECOVERY_BACKUP_MISSING =
  "Backup not configured: set BACKUP_DIR in desktop setup before enabling sandbox commits.";

export const SETTINGS_RECOVERY_SANDBOX_INVALID =
  "Sandbox not ready: DATA_ROOT must be a disposable Write-Sandbox with the marker — never live Microdent-Legacy.";

export const SETTINGS_RECOVERY_WRITE_BLOCKED =
  "Writes blocked: keep read-only mode or follow phase-7 sandbox pilot steps before enabling commits.";

export const SETTINGS_RECOVERY_DATA_ROOT_INVALID =
  "Invalid DATA_ROOT: re-open desktop setup and use an absolute sandbox folder that exists on disk.";

export const SETTINGS_BACKUP_NOT_CONFIGURED_BANNER_LABEL = "Backup required for commits";

export const SETTINGS_BACKUP_NOT_CONFIGURED_BANNER_BODY =
  "Write mode is enabled but BACKUP_DIR is not configured. Set a backup folder before committing sandbox changes.";
