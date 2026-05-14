/**
 * Logical table registry for **row/schema** APIs (`GET /v1/tables/...`).
 * Only the synthetic fixture is registered here so production-like tables are not exposed via row routes in this band.
 * Legacy table **presence** is listed separately via `GET /v1/legacy/catalog` and `LEGACY_CATALOG_REGISTRY`.
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
