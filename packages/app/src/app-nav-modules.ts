/** Primary sidebar modules with live read-only screens. */
export const APP_SIDEBAR_MODULES = [
  {
    id: "today",
    label: "Today",
    sublabel: "Front desk dashboard",
    description: "Who is on the schedule, what is next, and where to go next.",
  },
  {
    id: "patients",
    label: "Patients",
    sublabel: "Search and open records",
    description:
      "Search by name or chart number to open a record — or use the top bar. Summary, visits, medical screening, treatments, chart, and ledger preview are read-only tabs; sensitive fields stay hidden.",
  },
  {
    id: "schedule",
    label: "Schedule",
    sublabel: "Day and week views",
    description:
      "Day and week views from your copied schedule. Patient names use a safe summary; notes and phones stay hidden.",
  },
  {
    id: "settings",
    label: "Settings",
    sublabel: "Operator control center",
    description:
      "Bridge health, mirror import metadata, write mode, and sandbox status — operator-safe summaries only.",
  },
] as const;

export type AppSidebarModuleId = (typeof APP_SIDEBAR_MODULES)[number]["id"];

export type AppSidebarModule = (typeof APP_SIDEBAR_MODULES)[number];

/** Modules kept out of the sidebar until a dedicated screen exists. */
export const APP_NAV_UNSUPPORTED_MODULES = [
  {
    id: "dental-chart",
    label: "Dental Chart",
    hint: "Open a patient, then use the Chart tab.",
  },
  {
    id: "treatments",
    label: "Treatments",
    hint: "Open a patient, then use the Treatments tab.",
  },
  {
    id: "payments",
    label: "Payments",
    hint: "Not available in this read-only viewer.",
  },
  {
    id: "reports",
    label: "Reports",
    hint: "Not available in this read-only viewer.",
  },
] as const;

export type AppNavUnsupportedModuleId = (typeof APP_NAV_UNSUPPORTED_MODULES)[number]["id"];

/** Placeholder module ids removed from the sidebar; chart/treatments/ledger live under Patients. */
export type AppNavPlaceholderId = AppNavUnsupportedModuleId | "settings";

export type AppNavModuleId = AppSidebarModuleId | AppNavPlaceholderId;

/**
 * Full module list (sidebar + hidden placeholders) for docs and backward-compatible exports.
 * Prefer {@link APP_SIDEBAR_MODULES} for navigation UI.
 */
export const APP_NAV_MODULES = [
  ...APP_SIDEBAR_MODULES,
  { id: "dental-chart", label: "Dental Chart" },
  { id: "treatments", label: "Treatments" },
  { id: "payments", label: "Payments" },
  { id: "reports", label: "Reports" },
  { id: "settings", label: "Settings" },
] as const;

export function isAppNavPlaceholder(id: AppNavModuleId): id is AppNavPlaceholderId {
  return id !== "today" && id !== "patients" && id !== "schedule" && id !== "settings";
}

export function getAppSidebarModule(id: AppSidebarModuleId): AppSidebarModule {
  const module = APP_SIDEBAR_MODULES.find((entry) => entry.id === id);
  if (!module) {
    return APP_SIDEBAR_MODULES[0];
  }
  return module;
}

export type SelectedPatientContext = {
  patientId: string;
  displayName?: string | null;
  chartNumber?: string | null;
};

/** Safe headline for the selected-patient context chip (no raw PHI fields). */
export function formatSelectedPatientContextLabel({
  patientId,
  displayName,
  chartNumber,
}: SelectedPatientContext): string {
  const trimmedName = displayName?.trim();
  const headline = trimmedName && trimmedName.length > 0 ? trimmedName : `Patient ID ${patientId}`;
  const trimmedChart = chartNumber?.trim();
  if (trimmedChart && trimmedChart.length > 0) {
    return `${headline} · Chart ${trimmedChart}`;
  }
  return headline;
}

/** Sidebar note for modules that are intentionally hidden from the rail. */
export function resolveSidebarNavHint(): string {
  const underPatients = APP_NAV_UNSUPPORTED_MODULES.filter(
    (module) => module.id === "dental-chart" || module.id === "treatments",
  )
    .map((module) => module.label)
    .join(", ");
  const unavailable = APP_NAV_UNSUPPORTED_MODULES.filter(
    (module) => module.id === "payments" || module.id === "reports",
  )
    .map((module) => module.label)
    .join(" and ");

  return `${underPatients}, and Ledger preview are under Patients when you open a record. ${unavailable} are not available in this read-only viewer yet.`;
}
