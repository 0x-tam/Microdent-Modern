import type { BridgeClient } from "@microdent/bridge-client";
import { BridgeClientError } from "@microdent/bridge-client";

/** Logical id of the committed synthetic DBF fixture (Band A3). Never a production table. */
export const SYNTHETIC_FIXTURE_TABLE_ID = "fixture_tiny" as const;

export type FixtureConnectionFailureCode =
  | "BRIDGE_UNREACHABLE"
  | "DATA_ROOT_NOT_CONFIGURED"
  | "FIXTURE_NOT_AVAILABLE"
  | "INVALID_RESPONSE"
  | "HTTP_ERROR";

export type FixtureConnectionFailure = {
  ok: false;
  code: FixtureConnectionFailureCode;
  /** Safe, user-facing summary (no PHI). */
  message: string;
  httpStatus?: number;
};

export type FixtureConnectionSuccess = {
  ok: true;
  /** Whether `fixture_tiny` appears in `GET /v1/meta/tables`. */
  listedInCatalog: boolean;
  fieldCount: number;
  /** From `GET /v1/tables/.../rows` (`totalRecords`). */
  totalRecords: number;
  /** Number of rows returned in this response (≤ requested limit). */
  previewRowCount: number;
  previewRows: ReadonlyArray<Record<string, unknown>>;
};

export type FixtureConnectionProbeResult = FixtureConnectionSuccess | FixtureConnectionFailure;

function mapError(error: unknown): FixtureConnectionFailure {
  if (error instanceof BridgeClientError) {
    if (error.kind === "network") {
      return {
        ok: false,
        code: "BRIDGE_UNREACHABLE",
        message: "Could not reach the bridge. Start it on this machine or check the URL.",
      };
    }
    if (error.kind === "invalid_argument") {
      return {
        ok: false,
        code: "INVALID_RESPONSE",
        message: error.message,
      };
    }
    if (error.kind === "invalid_body") {
      return {
        ok: false,
        code: "INVALID_RESPONSE",
        message: "The bridge returned data this app could not parse.",
        httpStatus: error.status,
      };
    }
    if (error.kind === "http") {
      const status = error.status;
      if (status === 503 && error.apiCode === "DATA_ROOT_NOT_CONFIGURED") {
        return {
          ok: false,
          code: "DATA_ROOT_NOT_CONFIGURED",
          message:
            "The bridge is running but DATA_ROOT is not set. Point DATA_ROOT at the in-repo fixture sandbox to run this test.",
          httpStatus: status,
        };
      }
      if (status === 404 && error.apiCode === "TABLE_NOT_FOUND") {
        return {
          ok: false,
          code: "FIXTURE_NOT_AVAILABLE",
          message: "The synthetic fixture table was not found on the bridge.",
          httpStatus: status,
        };
      }
      return {
        ok: false,
        code: "HTTP_ERROR",
        message: error.apiMessage ?? error.message,
        httpStatus: status,
      };
    }
  }
  return {
    ok: false,
    code: "HTTP_ERROR",
    message: error instanceof Error ? error.message : "An unexpected error occurred.",
  };
}

/**
 * Calls only:
 * - `GET /v1/meta/tables`
 * - `GET /v1/tables/fixture_tiny/schema`
 * - `GET /v1/tables/fixture_tiny/rows`
 *
 * Uses the synthetic fixture id only; never production Microdent table names.
 */
export async function probeSyntheticFixtureConnection(
  client: Pick<BridgeClient, "getMetaTables" | "getTableSchema" | "getTableRows">,
  options?: { previewLimit?: number },
): Promise<FixtureConnectionProbeResult> {
  const previewLimit = options?.previewLimit ?? 5;
  try {
    const meta = await client.getMetaTables();
    const listedInCatalog = meta.tables.some((t) => t.id === SYNTHETIC_FIXTURE_TABLE_ID);
    if (!listedInCatalog) {
      return {
        ok: false,
        code: "FIXTURE_NOT_AVAILABLE",
        message: "The synthetic fixture is not listed in the bridge catalog (GET /v1/meta/tables).",
      };
    }

    const schema = await client.getTableSchema(SYNTHETIC_FIXTURE_TABLE_ID);
    const rows = await client.getTableRows(SYNTHETIC_FIXTURE_TABLE_ID, { limit: previewLimit, offset: 0 });

    return {
      ok: true,
      listedInCatalog,
      fieldCount: schema.fields.length,
      totalRecords: rows.totalRecords,
      previewRowCount: rows.rows.length,
      previewRows: rows.rows,
    };
  } catch (error) {
    return mapError(error);
  }
}
