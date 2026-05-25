// Re-exports from split tab files.
// This file exists for backward compatibility with any external consumers.
export {
  PatientMedicalTab,
  type MedLoadState,
  type PatientMedicalTabProps,
} from "./PatientMedicalTab.js";

export {
  PatientTreatmentsTab,
  type TxLoadState,
  type PatientTreatmentsTabProps,
} from "./PatientTreatmentsTab.js";

export {
  PatientChartTab,
  type ChartLoadState,
  type PatientChartTabProps,
} from "./PatientChartTab.js";

export {
  PatientLedgerTab,
  type LedgerLoadState,
  type PatientLedgerTabProps,
} from "./PatientLedgerTab.js";
