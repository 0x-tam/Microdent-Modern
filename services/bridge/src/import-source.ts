/**
 * Read-only DBF reference readers for sqlite-mirror importers (and tests).
 * No HTTP server surface — safe mapping only.
 */
export { parseDataRootFromValue, type DataRootConfig, type DataRootSet } from "./config.js";
export { readAllMedicalSummariesForMirror } from "./dbf/medical-summary-mirror.js";
export { readAllScheduleAppointmentsForMirror } from "./dbf/schedule-appointments-mirror.js";
export { readAllTreatmentsForMirror } from "./dbf/patient-treatments-mirror.js";
export { readReferenceDoctorsFromDbf } from "./dbf/reference-doctors.js";
export { readReferenceProcedures } from "./dbf/reference-procedures.js";
export { readScheduleRooms, type ScheduleRoomsOutcome } from "./dbf/schedule-rooms.js";
export {
  readAllMedicalSummariesFromDbf,
  type MedicalSummaryMirrorRecord,
  type ReadAllMedicalSummariesOutcome,
} from "./dbf/patient-medical-summary.js";
