/**
 * Shared user-visible copy for the read-only clinic viewer.
 * Import from here so empty/offline/privacy wording stays consistent across screens.
 */

export const READ_ONLY_VIEWER_LABEL = "Read-only viewer";

export const READ_ONLY_CONNECTED_LABEL = "Connected to copied clinic data";

export const READ_ONLY_MODE_LABEL = "Read-only mode";

export const READ_ONLY_BANNER_BODY =
  "Pilot read-only viewer. Names, phones, notes, and payment amounts stay hidden.";

export const HIDDEN_IN_READONLY_VIEWER = "hidden in this read-only viewer";

export const CLINIC_SERVICE_OFFLINE_TITLE = "Clinic service offline";

export const CLINIC_SERVICE_OFFLINE_PANEL =
  "Start the clinic service and wait for Connected in the top bar, then try again.";

export const CLINIC_SERVICE_OFFLINE_SECTION = "Connect the clinic service to load this section.";

export const CLINIC_SERVICE_CHECKING = "Waiting for the clinic service…";

export const CLINIC_SERVICE_CONNECT_SCHEDULE = "Connect the clinic service to load your schedule.";

export const SCHEDULE_LOAD_ERROR =
  "Could not load the schedule. Check the clinic service connection and tap Refresh.";

export const CLINIC_SERVICE_CONNECT_TODAY =
  "Connect the clinic service to load today’s appointments from your copy.";

export const PATIENT_PROFILE_READONLY_NOTE =
  "Read-only patient record — safe fields from your copied data only. Nothing here can be edited.";

export const PATIENT_PAGE_SEARCH_TITLE = "Find a patient";

export const PATIENT_PAGE_SEARCH_LEDE =
  "Search by name or chart number when connected. Only query matches are shown.";

export const PATIENT_PAGE_SEARCH_EXAMPLE =
  "Example: type a last name or a chart number (at least 2 characters).";

export const PATIENT_SEARCH_FIELD_LABEL = "Find a patient";

export const PATIENT_PAGE_SEARCH_PRIVACY =
  "Uses your copied clinic data. Names, chart numbers, record ids, and masked phone hints only — no notes, addresses, or payment fields.";

export const PATIENT_MODULE_TABS_HINT =
  "After you open a patient, use the Chart, Treatments, and Ledger preview tabs for dental chart, procedure history, and ledger metadata (read-only; sensitive fields stay hidden).";

export const PATIENT_CHANGE_PATIENT_LABEL = "Search another patient";

export const PATIENT_NO_SELECTION_TITLE = "No patient selected";

export const PATIENT_NO_SELECTION_DESCRIPTION =
  "Search by name or chart number, then pick a row to open the record.";

export const PATIENT_RECENT_SESSION_TITLE = "Recent this session";

export const PATIENT_RECENT_SESSION_HINT =
  "Up to five patients opened this session — not saved after you close the app. Names and chart numbers only.";

export const PATIENT_RECENT_SESSION_EMPTY = "No recent patients yet — open a record from search.";

export const PATIENT_PROFILE_LOADING = "Loading profile…";

export const PATIENT_PROFILE_WAITING_TITLE = "Waiting for the clinic service";

export const PATIENT_TAB_SUMMARY_LEDE =
  "Safe demographics from your copied patient file. Addresses, coverage details, and clinical notes stay hidden.";

export const PATIENT_TAB_APPOINTMENTS_LEDE =
  "Appointment history is read-only. Schedule note text and unlisted patient fields stay hidden.";

export const PATIENT_TAB_LOADING_APPOINTMENTS = "Loading appointment history…";

export const PATIENT_TAB_MEDICAL_LEDE =
  "Medical summary is read-only. Detailed notes and allergy text stay hidden.";

export const PATIENT_TAB_LOADING_MEDICAL = "Loading medical summary…";

export const PATIENT_TAB_TREATMENTS_LEDE =
  "Procedure history is read-only. Memos, per-line descriptions, and fees stay hidden.";

export const PATIENT_TAB_LOADING_TREATMENTS = "Loading treatments…";

export const PATIENT_TAB_OFFLINE_TREATMENTS = "Connect the clinic service to load treatment history.";

export const PATIENT_TAB_OFFLINE_MEDICAL = "Connect the clinic service to load the medical summary.";

export const PATIENT_TAB_OFFLINE_CHART = "Connect the clinic service to load the dental chart.";

export const PATIENT_TAB_OFFLINE_LEDGER = "Connect the clinic service to load the ledger preview.";

export const PATIENT_TAB_CHART_LEDE =
  "Dental chart is read-only. Chart memos and clinical labels stay hidden.";

export const PATIENT_TAB_LOADING_CHART = "Loading dental chart…";

export const PATIENT_TAB_LEDGER_LEDE =
  "Ledger lines are read-only. Amounts, memo text, and insurance identifiers stay hidden.";

export const PATIENT_TAB_LOADING_LEDGER = "Loading ledger preview…";

export const PATIENT_TAB_DESC_SUMMARY =
  "Safe demographics from your copied patient file. Editing previews may appear when enabled in this build.";

export const PATIENT_TAB_DESC_APPOINTMENTS =
  "Visit history for a date range. Schedule note text stays hidden.";

export const PATIENT_TAB_DESC_MEDICAL =
  "Screening questionnaire summary. Clinical free text stays hidden.";

export const PATIENT_TAB_DESC_TREATMENTS =
  "Procedure codes and provider labels. Memos and fees stay hidden.";

export const PATIENT_TAB_DESC_CHART =
  "Tooth-level chart rows. Chart memos and legends stay hidden.";

export const PATIENT_TAB_DESC_LEDGER =
  "Charge and payment type codes. Amounts and memo text stay hidden.";

export const PATIENT_TAB_DESC_TIMELINE =
  "Merged safe dated events from appointments, procedures, ledger, and medical summary. Notes and amounts stay hidden.";

export const PATIENT_TAB_TIMELINE_LEDE =
  "Longitudinal read-only context grouped by date. Click a row to open the related section.";

export const PATIENT_TAB_LOADING_TIMELINE = "Loading patient timeline…";

export const PATIENT_TAB_OFFLINE_TIMELINE = "Connect the clinic service to load the patient timeline.";

export const PATIENT_TIMELINE_RANGE_BANNER_PREFIX = "Appointments in timeline range";

export const PATIENT_TIMELINE_CHART_SNAPSHOT = "Chart snapshot";

export const PATIENT_TIMELINE_EVENT_APPOINTMENT = "Appointment";

export const PATIENT_TIMELINE_EVENT_TREATMENT = "Procedure";

export const PATIENT_TIMELINE_EVENT_LEDGER = "Ledger line";

export const PATIENT_TIMELINE_EVENT_MEDICAL = "Medical summary";

export const PATIENT_TIMELINE_EVENT_PROFILE = "Profile";

export const PATIENT_TIMELINE_ROW_ARIA = "Open related patient section";

export const PATIENT_TIMELINE_KIND_FILTER_ARIA = "Filter timeline by event type";

export const PATIENT_TIMELINE_VIEW_IN_TAB = (tabLabel: string): string => `View in ${tabLabel}`;

export const PATIENT_TIMELINE_EMPTY_RANGE =
  "No dated events in this read-only timeline yet. Connect the clinic service or refresh after data loads.";

export const PATIENT_TIMELINE_EMPTY_FILTER = "No events match the selected kind filter. Try another filter or clear filters.";

export const PATIENT_TIMELINE_UNDATED_ONLY =
  "Only undated chart snapshot rows are available — open the Chart tab for tooth-level detail.";

export const FILTER_CLEAR_LABEL = "Clear filters";

export const PATIENT_APPT_RANGE_CAP_BANNER =
  "This year preset is capped at 365 days by the appointments API. Results may not include the full calendar year.";

export const PATIENT_APPT_STATUS_MIX_ARIA = "Visit status mix in range";

export const SCHEDULE_ROOMS_IN_USE = (count: number): string =>
  count === 1 ? "1 room in use" : `${count} rooms in use`;

export const TODAY_RECENT_PATIENTS_TITLE = "Recent patients";

export const TODAY_REOPEN_RECENT = "Re-open recent";

export const WRITE_REFRESH_NUDGE = "Refresh the profile or schedule view after a successful commit to see updated read-only data.";

/** Single post-commit operator note (replaces separate refresh + mirror nudges). */
export const WRITE_POST_COMMIT_COMBINED_NUDGE =
  "Refresh the profile or schedule view to see updated data. Local copy may lag — refresh import from Settings when ready.";

export const WRITE_PLAN_LABEL_WORKFLOW = "Workflow";

export const WRITE_PLAN_LABEL_RECORD_ID = "Record id";

export const PATIENT_CHART_TOOTH_FILTER_LABEL = "Showing chart entries for";

export const PATIENT_CHART_TOOTH_FILTER_CLEAR = "Show all teeth";

export const PATIENT_SUMMARY_MINI_CARD_TIMELINE = "Timeline";

export const PATIENT_TAB_HIDDEN_FIELDS_NOTE = `Sensitive fields stay ${HIDDEN_IN_READONLY_VIEWER}.`;

export const SENSITIVE_MEDICAL_BANNER =
  "This patient has medical details on file in the legacy system. Problem descriptions, allergy text, and clinical notes stay hidden in this read-only viewer.";

export const MEDICAL_SENSITIVE_STILL_HIDDEN = [
  "Problem descriptions and clinical narrative text",
  "Allergy free-text and reaction details",
  "Medical notes and memo fields from the legacy record",
  "Individual screening flag labels when sensitive details are on file",
] as const;

export const MEDICAL_SENSITIVE_STILL_SHOWN = [
  "Questionnaire last-updated and last dental visit dates",
  "Total count of screening flags marked yes",
] as const;

export const PATIENT_TAB_CHART_EXPLAINER =
  "Read-only chart preview grouped by tooth. Chart memos and decoded clinical legends stay hidden — only safe tooth numbers, opaque type codes, and treated/not-treated flags are shown.";

export const TRUNCATED_LIST_BANNER =
  "Showing a capped list only. Additional lines are omitted in this read-only viewer.";

export const PATIENT_TAB_LEDGER_AMOUNTS_HIDDEN =
  "Dollar amounts, running balances, and payment totals are never shown in this preview — only opaque type codes and dates.";

export const PATIENT_TAB_LEDGER_AMOUNTS_CHIP = "Amounts intentionally hidden";

export const PATIENT_TAB_SECTION_UNDATED = "Date unknown";

export const PATIENT_TAB_FILTER_ALL = "All";

export const PATIENT_TAB_CHART_FILTER_ALL = "All entries";

export const PATIENT_TAB_CHART_FILTER_TREATED = "Treated only";

export function chartSummaryStripLabel(stats: {
  totalEntries: number;
  uniqueTeeth: number;
  treatedCount: number;
  notTreatedCount: number;
}): string {
  const entryWord = stats.totalEntries === 1 ? "entry" : "entries";
  const toothWord = stats.uniqueTeeth === 1 ? "tooth" : "teeth";
  return `${stats.totalEntries} chart ${entryWord} · ${stats.uniqueTeeth} unique ${toothWord} · ${stats.treatedCount} treated · ${stats.notTreatedCount} not treated`;
}

export const PATIENT_TAB_LEDGER_FILTER_CHARGE = "Charges";

export const PATIENT_TAB_LEDGER_FILTER_ADJUSTMENT = "Adjustments";

export const PATIENT_TAB_LEDGER_FILTER_PAYMENT = "Payments";

export const medicalFlaggedCountPartialNote = (flaggedCount: number): string =>
  `${flaggedCount} screening flags marked yes (some categories summarized as count only)`;

export const treatmentsToolbarSummary = (
  shown: number,
  total: number,
  filterActive: boolean,
): string => {
  if (filterActive && shown !== total) {
    return shown === 1
      ? `1 of ${total} procedures shown (filtered)`
      : `${shown} of ${total} procedures shown (filtered)`;
  }
  return total === 1 ? "1 procedure" : `${total} procedures`;
};

/** Top provider counts for treatments toolbar — safe labels only, no PHI tokens. */
export function treatmentsProviderStatsLine(
  stats: readonly { label: string; count: number }[],
): string | null {
  if (stats.length === 0) return null;
  return stats.map((s) => `${s.label} (${s.count})`).join(" · ");
}

export const ledgerToolbarSummary = (shown: number, total: number, filterActive: boolean): string => {
  if (filterActive && shown !== total) {
    return shown === 1
      ? `1 of ${total} ledger lines shown (filtered)`
      : `${shown} of ${total} ledger lines shown (filtered)`;
  }
  return total === 1 ? "1 ledger line" : `${total} ledger lines`;
};

export const PATIENT_TAB_SECTION_QUESTIONNAIRE = "Questionnaire summary";

export const PATIENT_TAB_QUESTIONNAIRE_LAST_UPDATED = "Questionnaire last updated";

export const PATIENT_TAB_QUESTIONNAIRE_DENTAL_VISIT = "Last dental visit";

export const PATIENT_TAB_SECTION_GENERAL_SCREENING = "General screening";

export const PATIENT_TAB_SECTION_ADDITIONAL_MARKERS = "Additional markers";

/** @deprecated Use PATIENT_TAB_SECTION_GENERAL_SCREENING and PATIENT_TAB_SECTION_ADDITIONAL_MARKERS */
export const PATIENT_TAB_SECTION_SCREENING = "Screening flags marked yes";

export const PATIENT_TAB_SECTION_PROCEDURE_HISTORY = "Procedure history";

export const PATIENT_TAB_SECTION_CHART_ENTRIES = "Chart entries";

export const PATIENT_TAB_SECTION_LEDGER_ENTRIES = "Transaction lines";

/** Patient workspace summary mini-cards and cross-tab actions (Workstream A). */
export const PATIENT_PROFILE_LAST_REFRESHED = "Last refreshed";

export const PATIENT_SUMMARY_MINI_CARD_APPOINTMENTS = "Appointments";
export const PATIENT_SUMMARY_MINI_CARD_MEDICAL = "Medical";
export const PATIENT_SUMMARY_MINI_CARD_TREATMENTS = "Treatments";
export const PATIENT_SUMMARY_MINI_CARD_CHART = "Chart";
export const PATIENT_SUMMARY_MINI_CARD_LEDGER = "Ledger preview";

export const PATIENT_SUMMARY_MINI_LOADING = "Loading…";
export const PATIENT_SUMMARY_MINI_UNAVAILABLE = "Unavailable";
export const PATIENT_SUMMARY_MINI_EMPTY = "None in range";
export const PATIENT_SUMMARY_MINI_NO_RECORD = "No record on file";
export const PATIENT_SUMMARY_MINI_SENSITIVE = "Sensitive details hidden";
export const PATIENT_SUMMARY_MINI_TRUNCATED = "List capped";

export const PATIENT_SUMMARY_CROSS_TAB_ARIA = "Open patient sections";

export function patientSummaryViewTabLabel(tabLabel: string): string {
  return `View ${tabLabel.toLowerCase()}`;
}

/** Patient appointment history filters and schedule link (Workstream B). */
export const PATIENT_APPT_PRESET_DEFAULT = "Default";
export const PATIENT_APPT_TIME_ALL = "All";
export const PATIENT_APPT_TIME_PAST = "Past";
export const PATIENT_APPT_TIME_UPCOMING = "Upcoming";
export const PATIENT_APPT_FILTER_STATUS_ARIA = "Filter by visit status";
export const PATIENT_APPT_FILTER_ROOM_ARIA = "Filter by room";
export const PATIENT_APPT_FILTER_ALL_STATUSES = "All statuses";
export const PATIENT_APPT_FILTER_ALL_ROOMS = "All rooms";
export const PATIENT_APPT_FILTER_PROVIDER_ARIA = "Filter by provider";
export const PATIENT_APPT_FILTER_ALL_PROVIDERS = "All providers";
export const PATIENT_APPT_OPEN_IN_SCHEDULE = "Open in Schedule";

export const SCHEDULE_PRIVACY_LEDE =
  "Read-only schedule. Names and chart numbers use a safe patient summary; notes and phone numbers stay hidden.";

export const TODAY_PRIVACY_LEDE =
  "Read-only today list — safe names and chart numbers only. Notes, phones, and payment fields stay hidden.";

export const TODAY_LOADING = "Loading today's schedule from your clinic copy…";

export const TODAY_NEXT_LOADING = "Loading next appointment…";

export const TODAY_NEXT_OFFLINE =
  "Connect the clinic service to see the next appointment today.";

export const TODAY_NEXT_NO_UPCOMING = "No more appointments scheduled for today.";

export const TODAY_NOW_CARD_TITLE = "Now";

export const TODAY_REMINDERS_FOOTNOTE =
  "Reminders are not available in this pilot build.";

export const TODAY_REMINDERS_EMPTY =
  "Reminders are not in this pilot. Use Schedule or Patients for live data from your copy.";

export const TODAY_REMINDERS_PILOT_UNAVAILABLE =
  "Reminders are not in this pilot. Use Schedule or Patients for live data.";

export const TODAY_HERO_KICKER = "Command center";

/** Today page hero (Wave 2 — workflow-first). */
export const TODAY_HERO_SUBTITLE =
  "Today's schedule, patient shortcuts, and clinic service status.";

export const TODAY_SCHEDULE_PANEL_TITLE = "Today's schedule";

export const TODAY_NEXT_PANEL_TITLE = "Next up";

export const TODAY_QUICK_ACTIONS_TITLE = "Quick actions";

export const TODAY_CLINIC_STATUS_TITLE = "Clinic status";

export const TODAY_STATUS_VIEW_SETTINGS = "View details in Settings";

export const TODAY_CONTINUE_WORKING_LABEL = "Continue working";

export const TODAY_CONTINUE_EMPTY_HINT =
  "Recent patients appear here after you open a record.";

export const TODAY_STATUS_COUNT_TITLE = "Appointments";

export const TODAY_METRIC_NEXT_LABEL = "Next visit";

export const TODAY_METRIC_SCHEDULE_LABEL = "Schedule";

export const TODAY_METRIC_ON_SCHEDULE = "On the schedule today";

export const TODAY_STATUS_MIRROR_TITLE = "Data freshness";

export const TODAY_STATUS_MIRROR_ACTIVE =
  "Local copy ready — search and schedule use your imported data.";

export const TODAY_STATUS_MIRROR_STALE =
  "Local copy may be outdated — today’s list may be stale until you re-import (Settings → Local copy import).";

export const TODAY_STATUS_MIRROR_FALLBACK =
  "Using copied clinic files — schedule reads legacy files until local copy import succeeds.";

export const TODAY_STATUS_MIRROR_OFFLINE =
  "Connect the clinic service to check local copy freshness.";

export const TODAY_STATUS_MIRROR_UNKNOWN =
  "Local copy status unknown until the clinic service connects.";

export const TODAY_MIRROR_STALE_ADVISORY =
  "Local copy may be outdated — re-import from Settings if today’s list looks wrong.";

export const TODAY_SCHEDULE_UNAVAILABLE =
  "Could not load today's schedule. Connect the clinic service, then tap Refresh today.";

export const TODAY_SELECTED_PATIENT_TITLE = "Selected patient";

export const TODAY_SELECTED_PATIENT_OPEN = "Open record";

export const TODAY_OPEN_PATIENT = "Open patient record";

export const TODAY_OPEN_SETTINGS = "Open settings";

export const TODAY_PILOT_READINESS_HINT =
  "Pilot readiness checklist, local copy import, and editing status are in Settings.";

export const TODAY_REFRESH = "Refresh today";

export const TODAY_EMPTY_TITLE = "No appointments today";

export const TODAY_EMPTY_DESCRIPTION =
  "Your board is clear. Open Schedule for other days or search for a patient.";

export const TODAY_OPEN_SCHEDULE = "Open schedule";

export const TODAY_SEARCH_PATIENT = "Search patient";

export const TODAY_QUICK_ACTIONS_LEDE = "Shortcuts to schedule, patients, and settings.";

export const PATIENT_SEARCH_HINT_CONNECTED = "Uses your copied clinic data. Names and safe hints only.";

export const PATIENT_SEARCH_HINT_OFFLINE = "Search is off until the clinic service is connected.";

export const PATIENT_SEARCH_OFFLINE_BANNER =
  "Patient search needs the clinic service. Connect the clinic service and wait until the top bar shows Connected.";

export const PATIENT_SEARCH_OFFLINE_STATUS = "Connect the clinic service to search patients.";

export const PATIENT_SEARCH_IDLE = "Type a name or chart number (at least 2 characters).";

export const PATIENT_SEARCH_TOO_SHORT = "Enter at least 2 letters or numbers.";

export const PATIENT_SEARCH_SEARCHING = "Searching…";

export const PATIENT_SEARCH_NO_MATCH =
  "No patients matched. Try a different spelling or chart number.";

export const PATIENT_SEARCH_DROPDOWN_NO_MATCH = "No patients matched.";

export const PATIENT_SEARCH_OPEN_RECORD_PREFIX = "Open record:";

export const SCHEDULE_VIEW_LABEL = "Schedule view";

export const SCHEDULE_VIEW_WEEK = "Week";

export const SCHEDULE_VIEW_DAY = "Day";

export const SCHEDULE_NAV_PREV_DAY = "Previous day";

export const SCHEDULE_NAV_PREV_WEEK = "Previous week";

export const SCHEDULE_NAV_NEXT_DAY = "Next day";

export const SCHEDULE_NAV_NEXT_WEEK = "Next week";

export const SCHEDULE_LOADING = "Loading schedule from your clinic copy…";

export const READONLY_STATE_RETRY = "Retry";

export const SCHEDULE_EMPTY_TITLE = "No appointments in this range";

export const SCHEDULE_EMPTY_DESCRIPTION =
  "Shift the range, reset filters, or refresh once the clinic service connects.";

export const SCHEDULE_ROOM_FILTER_LABEL = "Room";

export const SCHEDULE_ROOM_ALL = "All rooms";

export const SCHEDULE_KEYBOARD_HINT = "Tip: ← → move the range; T jumps to today.";

export const SCHEDULE_NAV_TODAY = "Today";

/** Shown under the range heading when the visible range includes the current local day. */
export const SCHEDULE_RANGE_INCLUDES_TODAY = "Includes today";

export const SCHEDULE_RANGE_APPOINTMENT_COUNT = (count: number): string =>
  count === 1 ? "1 appointment in this range" : `${count} appointments in this range`;

/** Wave 2 E — horizontal summary strip (not stat cards). */
export const SCHEDULE_SUMMARY_ARIA = "Range at a glance";

export const SCHEDULE_SUMMARY_SHOWN_LABEL = "In view";

export const SCHEDULE_SUMMARY_SLOTS_LABEL = "Booked time";

export const SCHEDULE_SUMMARY_SLOTS_HINT = "Total booked minutes in this range";

export const SCHEDULE_SUMMARY_ROOMS_LABEL = "Rooms";

export const SCHEDULE_SUMMARY_PROVIDERS_LABEL = "Providers";

export const SCHEDULE_SUMMARY_STATUS_LABEL = "By status";

export const SCHEDULE_PAGE_SUBTITLE =
  "Day and week views from your copied schedule — filter by room, status, or provider.";

export const SCHEDULE_ROOM_FILTER_LOADING = "Loading rooms…";

export const SCHEDULE_ROOM_FILTER_EMPTY = "No rooms loaded";

export const SCHEDULE_MIRROR_STALE_ADVISORY =
  "Local copy may be outdated — this range may not reflect the latest copied data until import runs again.";

export const SCHEDULE_MIRROR_STALE_FILTER_NOTE =
  " Active room, status, or provider filters may hide rows that changed on the source system.";

export const SCHEDULE_FILTER_PROVIDER_ARIA = "Filter by provider";

export const SCHEDULE_FILTER_ALL_PROVIDERS = "All providers";

export const SCHEDULE_DAY_APPOINTMENT_COUNT = (count: number): string =>
  count === 1 ? "1 appointment" : `${count} appointments`;

export const SCHEDULE_FILTER_EMPTY_TITLE = "No appointments match";

export const SCHEDULE_FILTER_EMPTY_DESCRIPTION =
  "Try clearing status or provider filters, another day or week, or a different room.";

export const SCHEDULE_ROOM_FILTER_CONTEXT = (roomLabel: string, count: number): string =>
  count === 1 ? `${roomLabel} · 1 appointment` : `${roomLabel} · ${count} appointments`;

export const SCHEDULE_OPEN_PATIENT = TODAY_OPEN_PATIENT;

export const TODAY_STATUS_MIX_UNAVAILABLE = "Status mix unavailable until today's list loads.";

export const TODAY_APPT_ROW_CURRENT_LABEL = "Current appointment";

export const TODAY_APPT_ROW_NEXT_LABEL = "Next appointment";

export const CLINIC_AT_A_GLANCE_TITLE = "Clinic at a glance";

export const FRONT_DESK_OVERVIEW_BRIDGE_LABEL = "Clinic service";

export const FRONT_DESK_OVERVIEW_BRIDGE_CONNECTED = "Connected";

export const FRONT_DESK_OVERVIEW_BRIDGE_CHECKING = "Checking connection…";

export const FRONT_DESK_OVERVIEW_BRIDGE_OFFLINE = "Offline";

export const FRONT_DESK_OVERVIEW_GUIDANCE_LABEL = "Next step";

export const FRONT_DESK_OVERVIEW_CONNECT_GUIDANCE =
  "Connect the clinic service in Settings to load schedule and search.";

export const FRONT_DESK_OVERVIEW_MIRROR_LABEL = "Data freshness";

export const FRONT_DESK_OVERVIEW_WRITE_MODE_LABEL = "Write mode";

export const FRONT_DESK_OVERVIEW_WRITE_MODE_UNKNOWN = "Unknown until capability loads";

export const FRONT_DESK_OVERVIEW_TODAY_LABEL = "Today's schedule";

export const FRONT_DESK_OVERVIEW_TODAY_UNAVAILABLE = "—";

export const FRONT_DESK_OVERVIEW_TODAY_COUNT = (count: number): string =>
  count === 1 ? "1 appointment" : `${count} appointments`;

export const FRONT_DESK_OVERVIEW_SELECTED_PATIENT_LABEL = "Selected patient";

export const FRONT_DESK_OVERVIEW_SANDBOX_PILOT_LABEL = "Sandbox pilot";

export const FRONT_DESK_OVERVIEW_SESSION_RECENT_LABEL = "Recent this session";

export const FRONT_DESK_OVERVIEW_SESSION_RECENT_COUNT = (count: number): string =>
  count === 1 ? "1 patient" : `${count} patients`;

export const FRONT_DESK_OVERVIEW_STATUS_MIX_LABEL = "Status mix";

export const FRONT_DESK_OVERVIEW_OPEN_SETTINGS = "Open Settings";

/** One-line discoverability hint above schedule row write panels. */
export const SCHEDULE_WRITE_DISCOVERABILITY_HINT =
  "Expand row for write actions (pilot env required).";

export const APPOINTMENT_CREATE_DOCTOR_NONE = "None (unassigned)";

export const MODULE_PLACEHOLDER_TITLE = "Not available yet";

export const MODULE_PLACEHOLDER_DESCRIPTION =
  "This module is not available in the read-only viewer yet. Use Today, Patients, or Schedule for live data from your copy.";

export const TAB_UNAVAILABLE_TITLE = "Not available in this read-only viewer";

export const MIRROR_STALE_BANNER_LABEL = "Local copy may be outdated";

export const MIRROR_STALE_BANNER_BODY =
  "The local copy has not been refreshed recently. Search and schedule may show older data until your operator runs a safe import (see Settings → Local copy import).";

export const MIRROR_ACTIVE_BANNER_LABEL = "Local copy ready";

export const MIRROR_ACTIVE_BANNER_BODY =
  "Search and schedule use your imported local copy. Run a safe import when copied data must be fresher.";

export const MIRROR_FALLBACK_BANNER_LABEL = "Using copied clinic files";

export const MIRROR_FALLBACK_BANNER_BODY =
  "The local copy is unavailable. Search and schedule read copied clinic files directly until import succeeds.";

export const WRITE_MODE_DISABLED_BANNER_LABEL = "Writes disabled";

export const WRITE_MODE_DISABLED_BANNER_BODY =
  "The clinic service will not apply changes. Dry-run and commit routes stay blocked until an operator enables editing on the server.";

export const WRITE_MODE_DRY_RUN_BANNER_LABEL = "Editing: dry-run";

export const WRITE_MODE_DRY_RUN_BANNER_BODY =
  "The clinic service validates write plans only. Nothing is saved until editing is set to enabled on a disposable sandbox.";

export const WRITE_MODE_ENABLED_BANNER_LABEL = "Editing: enabled";

export const WRITE_MODE_ENABLED_BANNER_BODY =
  "The clinic service may commit changes when routes and safety gates allow. Use only on disposable test data you can restore.";

export const SANDBOX_WRITE_WARNING_BANNER_LABEL = "Disposable sandbox";

export const SANDBOX_WRITE_WARNING_BANNER_BODY =
  "Writable sandbox is active. Commits change disposable DATA only — never production legacy folders.";

/** Schedule header when write pilots are visible (one line). */
export const SANDBOX_WRITE_PILOT_BANNER =
  "Write edits use disposable test data only — never production legacy folders. Preview each row before applying.";

/** In-panel write banner (friendly, no repeated restore CLI). */
export const SANDBOX_WRITE_PILOT_PANEL_BANNER =
  "Write edits use disposable test data only. Follow Edit → Preview → Apply.";

/** Short hint under the step strip inside write panels. */
export const SANDBOX_WRITE_PANEL_HINT =
  "Preview runs a dry-run plan first. Apply stays disabled until preview succeeds. Backup, restore, and audit details are in Settings.";

/** Once per schedule view when write pilots are active. */
export const SCHEDULE_SANDBOX_WRITE_PILOT_BANNER =
  `${SANDBOX_WRITE_PILOT_BANNER} Preview each row before applying.`;

export const APPOINTMENT_WRITE_ACTIONS_SUMMARY = "Write action";

export const PATIENT_SANDBOX_DEMOGRAPHICS_TITLE = "Demographics write (pilot)";

export const PATIENT_DEMOGRAPHICS_DOCTOR_ID_HINT =
  "Numeric doctor id from the profile only — no names from clinic data.";

export const APPOINTMENT_WRITE_TAB_STATUS = "Change status";

export const APPOINTMENT_WRITE_TAB_MOVE = "Move time/room";

export const APPOINTMENT_STATUS_PREVIEW_LABEL = "Preview status change";

export const APPOINTMENT_STATUS_APPLY_LABEL = "Apply status change";

export const APPOINTMENT_TIME_MOVE_PREVIEW_LABEL = "Preview move";

export const APPOINTMENT_TIME_MOVE_APPLY_LABEL = "Apply move";

export const WRITE_MODE_CHIP_DISABLED = "Read-only";

export const WRITE_MODE_CHIP_DRY_RUN = "Preview only";

export const WRITE_MODE_CHIP_ENABLED = "Editing on";

export const WRITE_OPERATION_ID_PREFIX = "Operation";

export const WRITE_BACKUP_CREATED_LINE = "Backup created for this change.";

export const WRITE_BACKUP_NOT_CREATED_LINE = "No backup was recorded for this change.";

export const WRITE_BACKUP_SKIPPED_LINE = "Backup not applicable (dry-run or uncommitted).";

export const WRITE_AUDIT_NOT_CONFIGURED = "Audit log: not configured on this clinic service.";

export const WRITE_AUDIT_UNAVAILABLE = "Audit log: unavailable.";

export const WRITE_AUDIT_EMPTY = "Audit log: no recent entries.";

/** Legacy long-form hints — Settings and operator docs only. */
export const WRITE_RESTORE_CLI_HINT =
  "Restore (sandbox pilot only): use legacy-restore CLI on Write-Sandbox DATA — see docs/pilot-backup-restore-audit.md in your package.";

export const WRITE_RESTORE_SANDBOX_ONLY_NOTE =
  "Restore is for disposable Write-Sandbox DATA only — never production legacy folders.";

export const WRITE_FAILED_GUIDANCE =
  "If the commit failed: keep the operation id, check clinic service status codes only, and restore from backup if clinic files may have changed.";

export const WRITE_AUDIT_STATUS_UPDATE_NOTE =
  "Audit detail is fullest for status-update commits today; other workflows show operation id, backup, and restore hints.";

/** One-line pointer after sandbox commits (replaces repeated restore/audit paragraphs in panels). */
export const WRITE_FEEDBACK_SETTINGS_LINK =
  "Backup folder, restore steps, and audit log: open Settings.";

/** Headline when a sandbox commit succeeded. */
export function writeResultCommittedHeadline(successLabel: string, mode?: string): string {
  return mode ? `Committed: true — ${successLabel} (${mode}).` : `Committed: true — ${successLabel}.`;
}

/** Headline when preview or commit did not persist (dry-run / blocked commit). */
export function writeResultUncommittedHeadline(mode?: string): string {
  return mode
    ? `Committed: false — dry-run plan only; nothing was saved (${mode}).`
    : "Committed: false — dry-run plan only; nothing was saved.";
}

export const WRITE_BLOCKED_PANEL_TITLE = "Writes blocked";

export const WRITE_FLOW_STEP_EDIT = "Edit";

export const WRITE_FLOW_STEP_PREVIEW = "Preview";

export const WRITE_FLOW_STEP_APPLY = "Apply";

export const SANDBOX_WRITE_BLOCKED_WRITE_MODE =
  "Sandbox writes are blocked — clinic service editing is off. Open Settings to review editing mode and sandbox paths.";

export const SANDBOX_WRITE_BLOCKED_SANDBOX =
  "Sandbox writes are not ready on this clinic service. Open Settings to confirm editing mode, sandbox path, and backup.";

export const APPOINTMENT_CREATE_SUMMARY = "Write: new appointment";

export const APPOINTMENT_CREATE_PATIENT_ID_HINT =
  "Enter the numeric patient record id from search or the profile header — there is no patient lookup in this pilot.";

export const APPOINTMENT_CREATE_PREVIEW_LABEL = "Preview create";

export const APPOINTMENT_CREATE_APPLY_LABEL = "Create appointment";

export const PATIENT_DEMOGRAPHICS_PREVIEW_LABEL = "Preview changes";

export const PATIENT_DEMOGRAPHICS_APPLY_LABEL = "Apply demographics";

export const PATIENT_DEMOGRAPHICS_PREVIEWING_LABEL = "Previewing…";

export const PATIENT_DEMOGRAPHICS_APPLYING_LABEL = "Applying…";

export const WRITE_POST_COMMIT_MIRROR_NUDGE =
  "Local copy may lag; refresh import from Settings when ready.";

export const SETTINGS_PANEL_LEDE =
  "Pilot status for clinic service, local copy, editing, sandbox readiness, and build id. No patient data is shown here — follow docs/PILOT-HANDOFF-PACK.md for the operator walkthrough.";

export const SETTINGS_BRIDGE_SECTION = "Clinic service";

export const SETTINGS_DATA_PATHS_SECTION = "Data paths";

export const SETTINGS_MIRROR_SECTION = "Local copy refresh";

export const SETTINGS_WRITE_SECTION = "Writes";

export const SETTINGS_SANDBOX_SECTION = "Sandbox";

export const SETTINGS_SQLITE_MIRROR_SECTION = "Fast local copy";

export const SETTINGS_SQLITE_MIRROR_UNKNOWN = "Local copy status unknown";

export const SETTINGS_BACKUP_SECTION = "Backup";

export const SETTINGS_PILOT_SECTION = "Sandbox pilot";

export const SETTINGS_DESKTOP_SECTION = "Desktop app";

export const SETTINGS_BRIDGE_CONNECTED = "Connected";

export const SETTINGS_BRIDGE_OFFLINE = "Offline";

export const SETTINGS_BRIDGE_CHECKING = "Checking connection…";

export const SETTINGS_QUICK_FIX_RESTART_SERVICE = "Restart clinic service";

export const SETTINGS_QUICK_FIX_RESTARTING_SERVICE = "Restarting clinic service…";

export const SETTINGS_QUICK_FIX_RESTART_SERVICE_SUCCESS =
  "Clinic service restarted. Refresh status if the page does not update automatically.";

export const SETTINGS_QUICK_FIX_RESTART_SERVICE_FAILED =
  "Clinic service could not restart. Close and reopen Microdent Modern, then contact support if it repeats.";

export const SETTINGS_QUICK_FIX_REFRESH_LOCAL_COPY = "Refresh local copy";

export const SETTINGS_QUICK_FIX_REFRESHING_LOCAL_COPY = "Refreshing local copy…";

export const SETTINGS_QUICK_FIX_REFRESH_LOCAL_COPY_SUCCESS =
  "Local copy refreshed. Search and schedule can use the latest copied data.";

export const SETTINGS_QUICK_FIX_REFRESH_LOCAL_COPY_FAILED =
  "Local copy refresh failed. Previous local copy was kept.";

export const SETTINGS_QUICK_FIX_EXPORT_SUPPORT_LOG = "Export support log";

export const SETTINGS_QUICK_FIX_EXPORTING_SUPPORT_LOG = "Exporting support log…";

export const SETTINGS_QUICK_FIX_EXPORT_SUPPORT_LOG_SUCCESS =
  "Support log exported. It contains operational events only, with paths sanitized.";

export const SETTINGS_QUICK_FIX_EXPORT_SUPPORT_LOG_FAILED =
  "Support log could not be exported. Restart Microdent Modern and try again.";

export const SETTINGS_QUICK_FIX_VIEW_DIAGNOSTICS = "View diagnostics summary";

export const SETTINGS_QUICK_FIX_LOADING_DIAGNOSTICS = "Loading diagnostics…";

export const SETTINGS_QUICK_FIX_VIEW_DIAGNOSTICS_FAILED =
  "Diagnostics summary could not be loaded. Restart Microdent Modern and try again.";

export const SETTINGS_QUICK_FIX_PREVIEW_SUPPORT_LOG = "Preview support log";

export const SETTINGS_QUICK_FIX_PREVIEWING_SUPPORT_LOG = "Loading support log preview…";

export const SETTINGS_QUICK_FIX_PREVIEW_SUPPORT_LOG_FAILED =
  "Support log preview could not be loaded. Export a support log first, then try again.";

export const SETTINGS_QUICK_FIX_CHECK_PORT = "Check service port";

export const SETTINGS_QUICK_FIX_CHECKING_PORT = "Checking service port…";

export const SETTINGS_QUICK_FIX_CHECK_PORT_FAILED =
  "Clinic service port check could not run. Restart Microdent Modern and try again.";

export const SETTINGS_QUICK_FIX_PORT_CLEANUP_POLICY = "View port cleanup policy";

export const SETTINGS_QUICK_FIX_LOADING_PORT_POLICY = "Loading port cleanup policy…";

export const SETTINGS_QUICK_FIX_PORT_CLEANUP_POLICY_FAILED =
  "Port cleanup policy could not be loaded. Restart Microdent Modern and try again.";

export const SETTINGS_SANDBOX_VALID = "Disposable sandbox valid";

export const SETTINGS_SANDBOX_INVALID = "Sandbox not valid for writes";

export const SETTINGS_SANDBOX_UNKNOWN = "Sandbox status unknown";

export const SETTINGS_BACKUP_CONFIGURED = "Backup folder configured";

export const SETTINGS_BACKUP_NOT_CONFIGURED = "Backup not configured";

export const SETTINGS_BACKUP_NOT_REQUIRED = "Not required while writes are off";

export const SETTINGS_BACKUP_UNKNOWN = "Backup status unknown";

export const SETTINGS_MIRROR_SQLITE_CONFIGURED = "Local copy path configured";

export const SETTINGS_MIRROR_SQLITE_MISSING = "Local copy path not configured";

export const SETTINGS_MIRROR_USABLE = "Local copy in use for search and schedule";

export const SETTINGS_MIRROR_FALLBACK = "Using copied clinic files";

export const SETTINGS_MIRROR_IMPORTED_COUNT = "Imported tables";

export const SETTINGS_MIRROR_REFRESH = "Refresh status";

export const SETTINGS_MIRROR_NO_RUNS = "No import runs recorded.";

export const SETTINGS_MIRROR_NO_RUNS_HINT =
  "Complete first-run setup or refresh the local copy after choosing a copied clinic data folder, then refresh status here.";

export const SETTINGS_MIRROR_DOC_LINK = "Local copy operator guide";

export const SETTINGS_MIRROR_STALE_CALLOUT =
  "Local copy metadata is older than 48 hours — search and schedule may show stale data until the local copy is refreshed.";

export const SETTINGS_MIRROR_DBF_SOURCE_TRUTH =
  "Copied clinic files remain the source of truth for sandbox edits. The local copy is a read snapshot — refresh it after sandbox commits when search or schedule must match the copied files.";

export const SETTINGS_READINESS_DISTRIBUTION_HINT =
  "Before IT handoff: run pnpm pilot:distribution-checkpoint on the build machine, or pnpm pilot:release-signoff when sandbox env is configured.";

export const SETTINGS_SANDBOX_PILOT_ON = "Sandbox write pilot enabled in this app build";

export const SETTINGS_SANDBOX_PILOT_OFF =
  "Sandbox write pilot UI is off in this build — read-only Today, Patients, and Schedule remain available.";

export const SETTINGS_DATA_ROOT_CONFIGURED = "Clinic data folder configured";

export const SETTINGS_DATA_ROOT_MISSING = "Clinic data folder not configured";

export const SETTINGS_DATA_ROOT_UNKNOWN = "Clinic data folder status unknown";

export const SETTINGS_DESKTOP_FILE_PROTOCOL =
  "Running as the packaged desktop app (local file protocol). Paths come from desktop setup config.";

export const SETTINGS_DESKTOP_BROWSER =
  "Running in the browser. Use the desktop installer for clinic file paths and clinic service supervision.";

export const SETTINGS_MIRROR_IMPORT_CLI =
  "Refresh the local copy, then refresh status here.";

export const SETTINGS_ENABLED_NON_SANDBOX_BANNER_LABEL = "Writes enabled outside sandbox";

export const SETTINGS_ENABLED_NON_SANDBOX_BANNER_BODY =
  "Editing is enabled but the clinic data folder did not pass the disposable sandbox guard. Stop the clinic service and fix paths before committing changes.";

export const SETTINGS_BRIDGE_OFFLINE_BANNER_LABEL = "Clinic service offline";

export const SETTINGS_BRIDGE_OFFLINE_BANNER_BODY =
  "Settings cannot load clinic service metadata until the clinic service is connected.";

export const SETTINGS_MIRROR_RUN_STATUS_SUCCESS = "Success";

export const SETTINGS_MIRROR_RUN_STATUS_PARTIAL = "Partial";

export const SETTINGS_MIRROR_RUN_STATUS_FAILED = "Failed";

export const SETTINGS_MIRROR_RUN_STATUS_RUNNING = "Running";

export const SETTINGS_MIRROR_IMPORT_COMMAND =
  "Use first-run setup to choose a copied clinic data folder. The app prepares the fast local copy automatically.";

export const SETTINGS_PILOT_READINESS_TITLE = "Pilot readiness";

export const SETTINGS_READINESS_READ_ONLY = "Read-only safe (writes off)";

export const SETTINGS_READINESS_WRITES_ACTIVE = "Writes active — sandbox pilot only";

export const SETTINGS_READINESS_MIRROR_ACTIVE = "Local copy active for search/schedule";

export const SETTINGS_READINESS_MIRROR_STALE = "Local copy stale (>48h) — refresh recommended";

export const SETTINGS_READINESS_MIRROR_FALLBACK = "Local copy unavailable — using copied clinic files";

export const SETTINGS_READINESS_MIRROR_UNKNOWN = "Local copy status unknown";

export const SETTINGS_READINESS_SANDBOX_READY = "Sandbox pilot ready (marker + paths)";

export const SETTINGS_READINESS_SANDBOX_NOT_READY = "Sandbox not ready for commits";

export const SETTINGS_READINESS_BRIDGE_OFFLINE = "Clinic service offline — complete setup first";

export const SETTINGS_READINESS_BACKUP_CONFIGURED = "Backup folder configured";

export const SETTINGS_READINESS_BACKUP_NOT_CONFIGURED = "Backup not configured — required for commits";

export const SETTINGS_READINESS_READONLY_QA_HINT = "Read-only QA: run pnpm test + build:web";

export const SETTINGS_READINESS_SANDBOX_QA_HINT = "Sandbox QA: run phase-7 runbook (pnpm qa:sandbox)";

export const SETTINGS_READINESS_WINDOWS_EXECUTION_DEFERRED =
  "Windows execution: Deferred / not yet run";

export const SETTINGS_READINESS_FIELD_TEST_DOC_HINT =
  "Windows field test pack ready when scheduled — start at docs/FIELD-TEST-START-HERE.md in your staged package (not Mac signoff alone).";

export const SETTINGS_PILOT_CHECKLIST_TITLE = "Pilot checklist";

export const SETTINGS_CHECKLIST_DATA_ROOT_SAFE = "Clinic data folder safe (not production legacy)";

export const SETTINGS_CHECKLIST_MIRROR_IMPORT = "Latest local copy refresh healthy";

export const SETTINGS_NEXT_STEP_LABEL = "Next step";

export const SETTINGS_NEXT_STEP_BRIDGE =
  "Start the clinic service — wait for Connected in Settings.";

export const SETTINGS_NEXT_STEP_DESKTOP_SETUP =
  "Complete desktop first-run setup to choose a copied clinic data folder and prepare the local copy before the clinic service starts.";

export const SETTINGS_NEXT_STEP_DATA_ROOT =
  "Choose a disposable sandbox clinic data folder in desktop setup before enabling edits.";

export const SETTINGS_NEXT_STEP_DATA_ROOT_FORBIDDEN =
  "The clinic data folder did not pass the disposable sandbox guard. Point the clinic service at a marked sandbox folder — never production legacy.";

export const SETTINGS_NEXT_STEP_WRITE_DISABLED =
  "Writes are off. Enable dry-run or enabled only on a disposable sandbox after backup is configured.";

export const SETTINGS_NEXT_STEP_WRITE_DRY_RUN =
  "Dry-run validates only. Preview in Schedule or Patient pilots, then enable commits when ready.";

export const SETTINGS_NEXT_STEP_WRITE_ENABLED =
  "Writes are enabled on the sandbox. Use pilot panels only; never point the clinic service at production legacy.";

export const SETTINGS_NEXT_STEP_SANDBOX =
  "Fix the clinic data folder: use a disposable sandbox folder with the write-sandbox marker before enabling commits.";

export const SETTINGS_NEXT_STEP_BACKUP =
  "Set a backup folder in desktop setup before committing sandbox changes.";

export const SETTINGS_NEXT_STEP_PILOT_BUILD =
  "Rebuild the web app with VITE_SANDBOX_WRITE_PILOT=true to show write pilots in this UI.";

export const SETTINGS_NEXT_STEP_MIRROR_IMPORT =
  "Refresh the local copy from the operator guide, then Refresh status here.";

export const SETTINGS_NEXT_STEP_MIRROR_REFRESH = "Tap Refresh status after the clinic service connects.";

export const SETTINGS_NEXT_STEP_MIRROR_STALE =
  "Local copy is stale. Refresh it — copied clinic files stay the write source of truth.";

/** Recovery pointers — link to repo docs/PILOT-START-HERE.md (no URL with PHI). */
export const PILOT_TROUBLESHOOTING_DOC = "PILOT-START-HERE.md";

export const SETTINGS_RECOVERY_BRIDGE_OFFLINE =
  "Clinic service offline: complete desktop setup, confirm the release package includes the clinic service, and ensure port 17890 is free. See PILOT-START-HERE.md § Troubleshooting.";

export const SETTINGS_RECOVERY_MIRROR_STALE =
  "Local copy stale: refresh the local copy from the operator guide, then Refresh status in Settings. Copied clinic files stay the write source of truth.";

export const SETTINGS_RECOVERY_BACKUP_MISSING =
  "Backup not configured: set a backup folder in desktop setup before enabling sandbox commits.";

export const SETTINGS_RECOVERY_SANDBOX_INVALID =
  "Sandbox not ready: the clinic data folder must be a disposable Write-Sandbox with the marker — never the live production legacy data tree.";

export const SETTINGS_RECOVERY_WRITE_BLOCKED =
  "Writes blocked: keep read-only mode or follow phase-7 sandbox pilot steps before enabling commits.";

export const SETTINGS_RECOVERY_DATA_ROOT_INVALID =
  "Invalid clinic data folder: re-open desktop setup and use an absolute sandbox folder that exists on disk.";

export const SETTINGS_BACKUP_NOT_CONFIGURED_BANNER_LABEL = "Backup required for commits";

export const SETTINGS_BACKUP_NOT_CONFIGURED_BANNER_BODY =
  "Editing is enabled but backup is not configured. Set a backup folder before committing sandbox changes.";

export const SETTINGS_PILOT_BUILD_SECTION = "Pilot build";

export const SETTINGS_PILOT_BUILD_LOADING = "Loading build metadata…";

export const SETTINGS_PILOT_BUILD_UNAVAILABLE =
  "Build metadata unavailable — packaged builds include web/pilot-build.json after staging.";

export const SETTINGS_PILOT_BUILD_PACKAGE_VERSION = "Package version";

export const SETTINGS_PILOT_BUILD_APP_VERSION = "App version";

export const SETTINGS_PILOT_BUILD_COMMIT = "Commit";

export const SETTINGS_PILOT_BUILD_CHANNEL = "Channel";

export const SETTINGS_PILOT_BUILD_BUILT = "Built";

/** Patient profile workflow strip (Wave 2 F). */
export const PATIENT_WORKFLOW_STRIP_ARIA = "Record workflow";

/** Patient workspace at-a-glance strip (Workstream A). */
export const PATIENT_SUMMARY_AT_GLANCE_TITLE = "At a glance";

export const PATIENT_PROFILE_FRESHNESS_LOADED = "Loaded";

export const PATIENT_SUMMARY_AT_GLANCE_APPT_UPCOMING = "Next visit";

export const PATIENT_SUMMARY_AT_GLANCE_APPT_RECENT = "Latest visit";

export const PATIENT_SUMMARY_AT_GLANCE_APPT_NONE = "No upcoming visits in range";

export const PATIENT_SUMMARY_AT_GLANCE_TREATMENTS = (count: number): string =>
  count === 1 ? "1 procedure" : `${count} procedures`;

export const PATIENT_SUMMARY_AT_GLANCE_CHART = (count: number): string =>
  count === 1 ? "1 chart entry" : `${count} chart entries`;

export const PATIENT_SUMMARY_AT_GLANCE_LEDGER = (count: number): string =>
  count === 1 ? "1 ledger line" : `${count} ledger lines`;

export const PATIENT_SUMMARY_AT_GLANCE_MEDICAL = (state: string): string => `Screening: ${state}`;

export const PATIENT_SUMMARY_TIMELINE_ABOUT_COUNT = (count: number): string =>
  count === 1 ? "About 1 event" : `About ${count} events`;

export const PATIENT_SUMMARY_TIMELINE_EXACT_COUNT = (count: number): string =>
  count === 1 ? "1 event loaded" : `${count} events loaded`;

/** Per-tab hidden-field one-liners (Workstream A). */
export const PATIENT_TAB_HIDDEN_TREATMENTS = "Procedure descriptions and fees stay hidden in this preview.";

export const PATIENT_TAB_HIDDEN_LEDGER = "Dollar amounts and memo text stay hidden in this preview.";

export const PATIENT_TAB_HIDDEN_MEDICAL = "Clinical free text and allergy details stay hidden in this preview.";

export const PATIENT_TAB_HIDDEN_CHART = "Chart memos and decoded legends stay hidden in this preview.";

/** Patients page workflow (Wave 3). */
export const PATIENTS_PAGE_RESULTS_TITLE = "Search results";

export const PATIENTS_OPEN_WORKSPACE_LABEL = "Open workspace";

export const PATIENTS_EMPTY_FOCUS_HINT =
  "Focus the search field above and enter at least 2 characters.";

/** Profile / tab empty-state titles (Wave 3). */
export const PATIENT_NOT_FOUND_TITLE = "Patient not found";

export const PATIENT_NOT_FOUND_DESCRIPTION =
  "That record may be missing from the copy. Search again.";

export const PATIENT_TAB_EMPTY_APPOINTMENTS_TITLE = "No appointments in range";

export const PATIENT_TAB_EMPTY_APPOINTMENTS_BODY =
  "Nothing scheduled in this date range. Try another preset or refresh.";

export const PATIENT_TAB_EMPTY_APPOINTMENTS_FILTERED_TITLE = "No appointments match";

export const PATIENT_TAB_EMPTY_APPOINTMENTS_FILTERED_BODY =
  "Clear filters or widen the date preset.";

export const PATIENT_TAB_EMPTY_TREATMENTS_TITLE = "No procedures found";

export const PATIENT_TAB_EMPTY_CHART_TITLE = "No chart entries";

export const PATIENT_TAB_EMPTY_LEDGER_TITLE = "No ledger lines";

export const PATIENT_TIMELINE_EMPTY_TITLE = "No timeline events";

export const PATIENT_TIMELINE_EMPTY_FILTER_TITLE = "No matching events";

export const PATIENT_TIMELINE_UNDATED_TITLE = "Undated events only";

export const PATIENT_SEARCH_NO_MATCH_TITLE = "No patients matched";

/** Sparse-data guided empty states (Workstream A). */
export const PATIENT_TAB_EMPTY_TREATMENTS = "No procedures in the loaded preview range.";

export const PATIENT_TAB_EMPTY_TREATMENTS_FILTERED = "No procedures match the active filters.";

export const PATIENT_TAB_EMPTY_CHART = "No chart entries in the loaded preview.";

export const PATIENT_TAB_EMPTY_CHART_FILTERED = "No chart entries match the active filters.";

export const PATIENT_TAB_EMPTY_LEDGER = "No ledger lines in the loaded preview.";

export const PATIENT_TAB_EMPTY_LEDGER_FILTERED = "No ledger lines match the active type filter.";

export const PATIENT_TAB_EMPTY_MEDICAL_TITLE = "No medical record";

export const PATIENT_TAB_EMPTY_MEDICAL = "No medical questionnaire on file for this patient.";

export function patientSummaryCrossTabWithCount(tabLabel: string, count: number | null): string {
  if (count === null || count === 0) {
    return patientSummaryViewTabLabel(tabLabel);
  }
  return `View ${count} ${tabLabel.toLowerCase()}`;
}

/** Timeline temporal grouping (Workstream B). */
export const PATIENT_TIMELINE_TEMPORAL_UPCOMING = "Upcoming";

export const PATIENT_TIMELINE_TEMPORAL_RECENT = "Recent (last 30 days)";

export const PATIENT_TIMELINE_TEMPORAL_OLDER = "Older";

export const PATIENT_TIMELINE_SUMMARY_BAR = (total: number, upcoming: number, recent: number): string => {
  const parts = [`${total} event${total === 1 ? "" : "s"} loaded`];
  if (upcoming > 0) parts.push(`${upcoming} upcoming`);
  if (recent > 0) parts.push(`${recent} recent`);
  return parts.join(" · ");
};

export const PATIENT_TIMELINE_LIMITATIONS =
  "Appointments are limited to ±365 days. Undated chart snapshot rows appear separately.";

/** Schedule operational summary (Workstream C). */
export const SCHEDULE_FILTER_ACTIVE_PREFIX = "Filters active";

export const SCHEDULE_WRITE_MODE_CHIP_OFFLINE =
  "Write pilots require pilot build and clinic service editing — see Settings.";

/** Today command center (Workstream G). */
export const TODAY_OPEN_SCHEDULE_FOR_TODAY = "Open schedule for today";

export const TODAY_OPEN_PATIENT_APPOINTMENTS = "Open patient appointments";

export const TODAY_SCHEDULE_READINESS_OFFLINE = "Schedule unavailable until the clinic service connects.";

export const TODAY_SCHEDULE_READINESS_STALE =
  "Local copy may be stale — today's list might not reflect the latest import.";

export const TODAY_SCHEDULE_READINESS_READY = "Schedule ready from your copied data.";

export const FRONT_DESK_OVERVIEW_BACKUP_LABEL = "Backup";

/** Settings cross-link (Workstream J). */
export const SETTINGS_TODAY_OVERVIEW_HINT =
  "Front-desk overview on Today shows clinic service, local copy, and editing readiness at a glance.";

export const SETTINGS_OPEN_TODAY_BUTTON = "Open Today overview";

/** Grouped Settings sections (Wave 2 G). */
export const SETTINGS_SECTION_DIAGNOSTICS = "Diagnostics";

export const SETTINGS_SECTION_LOCAL_COPY = "Local copy & import";

export const SETTINGS_SECTION_EDITING = "Editing & sandbox";

export const SETTINGS_SECTION_BACKUP = "Backup & recovery";

export const SETTINGS_SECTION_PACKAGE = "Package & build";

export const SETTINGS_SECTION_FIELD_TEST = "Field test & pilot notes";

export const SETTINGS_SECTION_DIAGNOSTICS_LEDE =
  "Clinic service connection, clinic data folder, desktop shell, and fast local copy status.";

export const SETTINGS_SECTION_LOCAL_COPY_LEDE =
  "Copied clinic files, refresh runs, and freshness for search and schedule.";

export const SETTINGS_SECTION_EDITING_LEDE =
  "Write mode, disposable sandbox marker, and whether this build shows sandbox write panels.";

export const SETTINGS_SECTION_BACKUP_LEDE =
  "Backup folder required before commits; not needed while the clinic service stays read-only.";

export const SETTINGS_SECTION_PACKAGE_LEDE = "Packaged build id and release channel for support handoff.";

export const SETTINGS_SECTION_FIELD_TEST_LEDE =
  "Windows field execution checklist, operator walkthrough, and reminders moved off Today.";

/** Absorbed from Today pilot notes / mirror advisory (Settings-only). */
export const SETTINGS_PILOT_NOTES_READINESS =
  "Pilot readiness checklist, local copy import, and editing status live on this page — use the chips and checklist above.";

export const SETTINGS_PILOT_NOTES_REMINDERS =
  "Reminders are not in this pilot. Use Schedule or Patients for live data from your copy.";

export const SETTINGS_PILOT_NOTES_FOOTNOTE =
  "Reminders are not available in this pilot build.";

export const SETTINGS_PILOT_NOTES_TITLE = "Operator notes";

export const SETTINGS_MIRROR_FRESHNESS_ACTIVE =
  "Local copy ready — search and schedule use your imported data.";

export const SETTINGS_MIRROR_FRESHNESS_STALE =
  "Local copy may be outdated — re-import when today’s list or search looks wrong.";

export const SETTINGS_MIRROR_FRESHNESS_FALLBACK =
  "Using copied clinic files — schedule reads legacy files until local copy import succeeds.";

export const SETTINGS_MIRROR_FRESHNESS_OFFLINE =
  "Connect the clinic service to check local copy freshness.";

export const SETTINGS_MIRROR_FRESHNESS_UNKNOWN =
  "Local copy status unknown until the clinic service connects.";

export const SETTINGS_BACKUP_READONLY_NOTE =
  "Backup is not required while writes are off. Configure a backup folder before enabling sandbox commits.";

/** Backup folder setup guidance (no backend call — operator config only). */
export const SETTINGS_BACKUP_SETUP_BUTTON = "Set up backup folder";

export const SETTINGS_BACKUP_SETUP_HINT =
  "Create a folder next to your data directory and select it in desktop setup. Backup is required before any sandbox commits.";

/** Local copy import prompt when no import runs exist. */
export const SETTINGS_IMPORT_LOCAL_COPY_BUTTON = "Refresh local copy";

export const SETTINGS_IMPORT_LOCAL_COPY_HINT =
  "The desktop app prepares this automatically from your copied clinic data folder. No command line is required.";

/** Next steps section for new operators. */
export const SETTINGS_NEXT_STEPS_TITLE = "Getting started";

export const SETTINGS_NEXT_STEPS_LEDE =
  "Complete these steps in order to set up your clinic data viewer.";

export const SETTINGS_NEXT_STEP_CHOOSE_DATA = "Choose data folder";

export const SETTINGS_NEXT_STEP_CHOOSE_DATA_DONE = "Data folder configured";

export const SETTINGS_NEXT_STEP_IMPORT_COPY = "Import local copy";

export const SETTINGS_NEXT_STEP_IMPORT_COPY_DONE = "Local copy active";

export const SETTINGS_NEXT_STEP_SETUP_BACKUP = "Set up backup folder";

export const SETTINGS_NEXT_STEP_SETUP_BACKUP_DONE = "Backup configured";

export const SETTINGS_NEXT_STEP_REVIEW_DATA = "Review read-only data";

export const SETTINGS_NEXT_STEP_REVIEW_DATA_DONE = "Ready to review data";

/** Medical clinical toolbar (Workstream F). */
export function medicalToolbarSummary(flaggedCount: number, sectionCount: number): string {
  const flagPart =
    flaggedCount === 0
      ? "No screening flags marked yes"
      : flaggedCount === 1
        ? "1 screening flag marked yes"
        : `${flaggedCount} screening flags marked yes`;
  const sectionPart = sectionCount === 1 ? "1 section" : `${sectionCount} sections`;
  return `${flagPart} · ${sectionPart}`;
}

/** Chart clinical toolbar (Workstream F). */
export function chartToolbarSummary(
  shown: number,
  total: number,
  filterActive: boolean,
  statsLine: string | null,
): string {
  let base: string;
  if (filterActive && shown !== total) {
    base = shown === 1 ? `1 of ${total} entries shown (filtered)` : `${shown} of ${total} entries shown (filtered)`;
  } else {
    base = total === 1 ? "1 chart entry" : `${total} chart entries`;
  }
  return statsLine ? `${base} · ${statsLine}` : base;
}

/** Write context panels (Workstream D). */
export const APPOINTMENT_MOVE_CONTEXT_TITLE = "Current appointment";

export const APPOINTMENT_CREATE_PATIENT_CONTEXT = "Creating for selected patient";

export const WRITE_BLOCKED_INVALID_HINT = "Check required fields before preview.";

/** Settings operator control center — clinic-friendly section labels (Workstream D + F). */
export const SETTINGS_SECTION_CLINIC_SERVICE = "Clinic service";
export const SETTINGS_SECTION_CLINIC_SERVICE_LEDE =
  "Connection status, port, and controls for the clinic background service.";
export const SETTINGS_SECTION_DATA_SOURCE = "Data source";
export const SETTINGS_SECTION_DATA_SOURCE_LEDE =
  "Where your clinic data lives — the folder the app reads from.";
export const SETTINGS_SECTION_BACKUP_READINESS = "Backup readiness";
export const SETTINGS_SECTION_BACKUP_READINESS_LEDE =
  "Backup folder status and controls for protecting your data.";
export const SETTINGS_SECTION_EDITING_MODE = "Editing mode";
export const SETTINGS_SECTION_EDITING_MODE_LEDE =
  "How the app handles changes — read-only, sandbox preview, or disabled.";

/** Clinic service status labels. */
export const SETTINGS_SERVICE_RUNNING = "Service running";
export const SETTINGS_SERVICE_STOPPED = "Service stopped";
export const SETTINGS_SERVICE_UNKNOWN = "Service status unknown";
export const SETTINGS_SERVICE_PORT_MASKED = "Port: ****";
export const SETTINGS_SERVICE_RESTART_ACTION = "Restart service";
export const SETTINGS_SERVICE_START_ACTION = "Start service";

/** Data source status labels. */
export const SETTINGS_DATA_SOURCE_CONFIGURED = "Data folder configured";
export const SETTINGS_DATA_SOURCE_NOT_CONFIGURED = "No data folder selected";
export const SETTINGS_DATA_SOURCE_MASKED_HINT = "Folder: C:\\…\\Write-Sandbox\\DATA";
export const SETTINGS_DATA_SOURCE_CHANGE_ACTION = "Change data folder";

/** Backup readiness labels. */
export const SETTINGS_BACKUP_FOLDER_READY = "Backup folder ready";
export const SETTINGS_BACKUP_FOLDER_MISSING = "Backup folder not set up";
export const SETTINGS_BACKUP_FOLDER_NOT_WRITABLE = "Backup folder exists but is not writable";
export const SETTINGS_BACKUP_CHANGE_ACTION = "Change backup folder";

/** Editing mode labels (clinic-friendly). */
export const SETTINGS_EDITING_READ_ONLY = "Read-only";
export const SETTINGS_EDITING_READ_ONLY_EXPLAIN =
  "The app shows your data without making any changes. Safe for reviewing records.";
export const SETTINGS_EDITING_SANDBOX = "Sandbox preview";
export const SETTINGS_EDITING_SANDBOX_EXPLAIN =
  "Changes are saved to a disposable copy first. Back up before applying to real data.";
export const SETTINGS_EDITING_DISABLED = "Editing disabled";
export const SETTINGS_EDITING_DISABLED_EXPLAIN =
  "This build of the app does not support editing. Contact support to enable.";
export const SETTINGS_EDITING_DRY_RUN = "Preview mode";
export const SETTINGS_EDITING_DRY_RUN_EXPLAIN =
  "You can preview changes but they are not saved yet. Turn on commits when ready.";
export const SETTINGS_EDITING_UNKNOWN = "Checking editing status…";

/** First-run / setup action labels. */
export const SETTINGS_SETUP_RERUN_BUTTON = "Re-run first-run setup";
export const SETTINGS_SETUP_RERUN_HINT =
  "Open the setup wizard again to change your data folder, backup folder, or clinic service settings.";

/** Field test readiness labels. */
export const SETTINGS_FIELD_TEST_READY = "Field test ready";
export const SETTINGS_FIELD_TEST_NOT_READY = "Field test not ready";
export const SETTINGS_FIELD_TEST_PENDING = "Field test pending";

/** Diagnostics section labels. */
export const SETTINGS_DIAGNOSTICS_COLLAPSED_LABEL = "Show technical details";
export const SETTINGS_DIAGNOSTICS_EXPANDED_LABEL = "Hide technical details";

/** Package/build deferred notice. */
export const SETTINGS_BUILD_WINDOWS_DEFERRED_NOTICE =
  "Windows packaged build execution is deferred until field test scheduling is confirmed.";
