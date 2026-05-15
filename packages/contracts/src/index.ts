export { HealthResponseSchema, type HealthResponse } from "./health.js";
export { ApiErrorBodySchema, type ApiErrorBody } from "./api-error.js";
export { TablesListResponseSchema, TableListItemSchema, type TablesListResponse } from "./meta-tables.js";
export {
  TableSchemaResponseSchema,
  TableFieldSchemaSchema,
  type TableSchemaResponse,
} from "./table-schema.js";
export { TableRowsResponseSchema, TableRowSchema, type TableRowsResponse } from "./table-rows.js";
export {
  LegacyCatalogResponseSchema,
  LegacyCatalogTableItemSchema,
  type LegacyCatalogResponse,
  type LegacyCatalogTableItem,
} from "./legacy-catalog.js";
export {
  normalizePatientSearchResultItemForWire,
  PatientSearchQueryParamsSchema,
  PatientSearchResponseSchema,
  PatientSearchResultItemSchema,
  SafePatientSummarySchema,
  type PatientSearchQueryParams,
  type PatientSearchResponse,
  type PatientSearchResultItem,
  type SafePatientSummary,
} from "./patient-search.js";
export {
  PatientProfilePathParamsSchema,
  PatientProfileResponseSchema,
  type PatientProfilePathParams,
  type PatientProfileResponse,
} from "./patient-profile.js";
export {
  MedicalConditionFlagsSchema,
  PatientMedicalSummaryPathParamsSchema,
  PatientMedicalSummaryResponseSchema,
  type MedicalConditionFlags,
  type PatientMedicalSummaryPathParams,
  type PatientMedicalSummaryResponse,
} from "./patient-medical-summary.js";
export {
  ReferenceDoctorItemSchema,
  ReferenceDoctorsResponseSchema,
  type ReferenceDoctorItem,
  type ReferenceDoctorsResponse,
} from "./reference-doctors.js";
export {
  ScheduleRoomActiveDaysSchema,
  ScheduleRoomItemSchema,
  ScheduleRoomsResponseSchema,
  ScheduleAppointmentItemSchema,
  ScheduleAppointmentPatientSummarySchema,
  ScheduleAppointmentsResponseSchema,
  ScheduleAppointmentsQuerySchema,
  PatientAppointmentsQuerySchema,
  type ScheduleRoomActiveDays,
  type ScheduleRoomItem,
  type ScheduleRoomsResponse,
  type ScheduleAppointmentItem,
  type ScheduleAppointmentPatientSummary,
  type ScheduleAppointmentsResponse,
  type ScheduleAppointmentsQuery,
  type PatientAppointmentsQuery,
} from "./schedule.js";
export {
  ReferenceProcedureItemSchema,
  ReferenceProceduresResponseSchema,
  type ReferenceProcedureItem,
  type ReferenceProceduresResponse,
} from "./reference-procedures.js";
