/**
 * Logical table registry (Band A3). Only the synthetic fixture is registered.
 * Real Microdent tables (PATIENT, SCHEDULE, etc.) are intentionally absent.
 */
export type TableRegistryEntry = {
  /** URL path segment id (lowercase snake_case). */
  id: string;
  /** Human-readable label for API consumers. */
  label: string;
  /** Basename only; must match a file under DATA_ROOT. */
  fileName: string;
};

export const TABLE_REGISTRY: readonly TableRegistryEntry[] = [
  {
    id: "fixture_tiny",
    label: "Synthetic fixture (non-PHI)",
    fileName: "FAKE_TINY.dbf",
  },
];

/** Allowed logical table id pattern — rejects path-like segments. */
export const TABLE_ID_PATTERN = /^[a-z][a-z0-9_]*$/;

export function findRegistryEntry(tableId: string): TableRegistryEntry | undefined {
  return TABLE_REGISTRY.find((e) => e.id === tableId);
}
