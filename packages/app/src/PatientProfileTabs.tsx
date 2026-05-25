import {
  PATIENT_TAB_DESC_APPOINTMENTS,
  PATIENT_TAB_DESC_CHART,
  PATIENT_TAB_DESC_LEDGER,
  PATIENT_TAB_DESC_MEDICAL,
  PATIENT_TAB_DESC_SUMMARY,
  PATIENT_TAB_DESC_TIMELINE,
  PATIENT_TAB_DESC_TREATMENTS,
} from "./read-only-ui-copy.js";

export type ProfileTab =
  | "summary"
  | "timeline"
  | "appointments"
  | "medical"
  | "treatments"
  | "chart"
  | "ledger";

export const PROFILE_TAB_ORDER: readonly { id: ProfileTab; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "timeline", label: "Timeline" },
  { id: "appointments", label: "Appointments" },
  { id: "medical", label: "Medical" },
  { id: "treatments", label: "Treatments" },
  { id: "chart", label: "Chart" },
  { id: "ledger", label: "Ledger preview" },
];

export const PROFILE_TAB_DESCRIPTIONS: Record<ProfileTab, string> = {
  summary: PATIENT_TAB_DESC_SUMMARY,
  timeline: PATIENT_TAB_DESC_TIMELINE,
  appointments: PATIENT_TAB_DESC_APPOINTMENTS,
  medical: PATIENT_TAB_DESC_MEDICAL,
  treatments: PATIENT_TAB_DESC_TREATMENTS,
  chart: PATIENT_TAB_DESC_CHART,
  ledger: PATIENT_TAB_DESC_LEDGER,
};

export type PatientProfileTabsProps = {
  activeTab: ProfileTab | null;
  onTabChange: (tab: ProfileTab) => void;
};

export function PatientProfileTabs({ activeTab, onTabChange }: PatientProfileTabsProps) {
  return (
    <nav
      className="app-patient-profile__tabs app-patient-profile__tabs--pills clinic-profile-tabs"
      aria-label="Patient sections"
    >
      <ul className="app-patient-profile__tablist" role="tablist">
        {PROFILE_TAB_ORDER.map((tab) => (
          <li key={tab.id} role="presentation">
            <button
              type="button"
              role="tab"
              id={`patient-tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`patient-panel-${tab.id}`}
              className={`app-patient-profile__tab ui-focusable${activeTab === tab.id ? " app-patient-profile__tab--active" : ""}`}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.label}
            </button>
          </li>
        ))}
      </ul>
      {activeTab ? (
        <p id={`patient-tab-desc-${activeTab}`} className="app-patient-profile__tab-desc">
          {PROFILE_TAB_DESCRIPTIONS[activeTab]}
        </p>
      ) : null}
    </nav>
  );
}
