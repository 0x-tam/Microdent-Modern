/**
 * Known legacy Microdent DBF tables for **catalog / presence only** (`GET /v1/legacy/catalog`).
 * These entries are **not** registered in `TABLE_REGISTRY` — row/schema routes stay fixture-only unless extended later.
 * Basenames only; paths resolve under `DATA_ROOT` via the same sandbox rules as the fixture reader.
 */
export type LegacyCatalogRegistryEntry = {
  /** Logical id for APIs (lowercase snake_case). */
  id: string;
  /** Non-PHI display label for clinic staff. */
  label: string;
  /** Basename under DATA_ROOT (e.g. PATIENT.DBF). */
  fileName: string;
};

export const LEGACY_CATALOG_REGISTRY: readonly LegacyCatalogRegistryEntry[] = [
  { id: "patient", label: "Patients (master)", fileName: "PATIENT.DBF" },
  { id: "schedule", label: "Appointments (schedule)", fileName: "SCHEDULE.DBF" },
  { id: "trans", label: "Ledger / transactions", fileName: "TRANS.DBF" },
  { id: "opertbl", label: "Clinical procedures", fileName: "OPERTBL.DBF" },
  { id: "chartdbf", label: "Odontogram / chart lines", fileName: "CHARTDBF.DBF" },
  { id: "medical", label: "Medical history", fileName: "MEDICAL.DBF" },
  { id: "doctors", label: "Doctors reference", fileName: "DOCTORS.DBF" },
  { id: "tretplan", label: "Treatment plans (financial)", fileName: "TRETPLAN.DBF" },
  { id: "procchrt", label: "Procedure chart reference", fileName: "PROCCHRT.DBF" },
  { id: "sc_room", label: "Schedule rooms", fileName: "SC_ROOM.DBF" },
  { id: "dicsched", label: "Scheduler UI dictionary", fileName: "DICSCHED.DBF" },
];
