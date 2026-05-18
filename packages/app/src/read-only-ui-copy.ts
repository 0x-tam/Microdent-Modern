/**
 * Shared user-visible copy for the read-only clinic viewer.
 * Import from here so empty/offline/privacy wording stays consistent across screens.
 */

export const READ_ONLY_VIEWER_LABEL = "Read-only viewer";

export const READ_ONLY_CONNECTED_LABEL = "Connected to copied clinic data";

export const READ_ONLY_MODE_LABEL = "Read-only mode";

export const READ_ONLY_BANNER_BODY =
  "This viewer cannot change clinic data. Names, phones, notes, and payment amounts stay hidden in this read-only viewer.";

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

export const MODULE_PLACEHOLDER_TITLE = "Not available yet";

export const MODULE_PLACEHOLDER_DESCRIPTION =
  "This module is not available in the read-only viewer yet. Use Today, Patients, or Schedule for live data from your copy.";

export const TAB_UNAVAILABLE_TITLE = "Not available in this read-only viewer";

export const MIRROR_STALE_BANNER_LABEL = "Local copy may be outdated";

export const MIRROR_STALE_BANNER_BODY =
  "The SQLite mirror has not been refreshed recently. Search and schedule may show older data until your operator runs a safe mirror import.";

export const MIRROR_ACTIVE_BANNER_LABEL = "SQLite mirror active";

export const MIRROR_ACTIVE_BANNER_BODY =
  "Search and schedule use your imported SQLite mirror. Run a safe mirror import when you need fresher copied data.";

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
  "Sandbox write mode — changes affect disposable data only.";

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

export const SETTINGS_PANEL_LEDE =
  "Bridge, mirror, write mode, and sandbox status for operators. No patient data is shown here.";

export const SETTINGS_BRIDGE_SECTION = "Clinic service";

export const SETTINGS_MIRROR_SECTION = "Mirror import";

export const SETTINGS_WRITE_SECTION = "Write mode";

export const SETTINGS_SANDBOX_SECTION = "Sandbox";

export const SETTINGS_BACKUP_SECTION = "Backup";

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

export const SETTINGS_MIRROR_USABLE = "Mirror in use for search and schedule";

export const SETTINGS_MIRROR_FALLBACK = "Using DBF fallback";

export const SETTINGS_MIRROR_IMPORTED_COUNT = "Imported tables";

export const SETTINGS_MIRROR_REFRESH = "Refresh status";

export const SETTINGS_MIRROR_NO_RUNS = "No import runs recorded.";

export const SETTINGS_MIRROR_NO_RUNS_HINT =
  "Run a safe mirror import from the command line, then refresh status here.";

export const SETTINGS_MIRROR_DOC_LINK = "Mirror import operator guide";

export const SETTINGS_MIRROR_STALE_CALLOUT =
  "Mirror metadata is older than 48 hours. Search and schedule may be stale until you import again.";

export const SETTINGS_SANDBOX_PILOT_ON = "Sandbox write pilot enabled in this app build";

export const SETTINGS_SANDBOX_PILOT_OFF = "Sandbox write pilot not enabled in this app build";
