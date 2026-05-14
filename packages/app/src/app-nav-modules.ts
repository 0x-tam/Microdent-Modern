export const APP_NAV_MODULES = [
  { id: "today", label: "Today" },
  { id: "patients", label: "Patients" },
  { id: "schedule", label: "Schedule" },
  { id: "dental-chart", label: "Dental Chart" },
  { id: "treatments", label: "Treatments" },
  { id: "payments", label: "Payments" },
  { id: "reports", label: "Reports" },
  { id: "settings", label: "Settings" },
] as const;

export type AppNavModuleId = (typeof APP_NAV_MODULES)[number]["id"];
