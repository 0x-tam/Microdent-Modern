/**
 * Honest opaque legacy code labels — no clinical interpretation.
 * Full decode catalogs require Windows field log validation (see docs/FIELD-TEST-START-HERE.md).
 */
export type LegacyCodeDomain =
  | "status"
  | "chart type"
  | "charge type"
  | "adjustment type"
  | "payment type";

export function legacyCodeLabel(domain: LegacyCodeDomain, code: number): string {
  return `Legacy ${domain} code ${code} (unmapped)`;
}

export function unknownProviderLabel(id: string): string {
  return `Unknown provider ${id}`;
}

export function unknownProcedureLabel(code: string): string {
  return `Unknown procedure ${code}`;
}
