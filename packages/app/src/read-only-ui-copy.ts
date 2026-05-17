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
