/**
 * Honest opaque legacy code labels — no clinical interpretation.
 * Appointment status codes 1–5 are mapped in patientApptStatusLabel; unmapped codes use legacyCodeLabel("status", code).
 * Full decode catalogs require Windows field log validation (see docs/FIELD-TEST-START-HERE.md).
 */
export type LegacyCodeDomain =
  | "status"
  | "chart type"
  | "charge type"
  | "adjustment type"
  | "payment type";

export function legacyCodeLabel(domain: LegacyCodeDomain, code: number): string {
  if (!Number.isFinite(code)) {
    return `Legacy ${domain} code — (unmapped)`;
  }
  return `Legacy ${domain} code ${Math.trunc(code)} (unmapped)`;
}

export function unknownProviderLabel(id: string): string {
  return `Unknown provider ${id}`;
}

export function unknownProcedureLabel(code: string): string {
  return `Unknown procedure ${code}`;
}
