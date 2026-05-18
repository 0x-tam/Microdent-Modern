/** Primary sidebar modules with live read-only screens. */
export const APP_SIDEBAR_MODULES = [
  { id: "today", label: "Today" },
  { id: "patients", label: "Patients" },
  { id: "schedule", label: "Schedule" },
  { id: "settings", label: "Settings" },
] as const;

export type AppSidebarModuleId = (typeof APP_SIDEBAR_MODULES)[number]["id"];

/** Placeholder module ids removed from the sidebar; chart/treatments/ledger live under Patients. */
export type AppNavPlaceholderId = "dental-chart" | "treatments" | "payments" | "reports" | "settings";

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
