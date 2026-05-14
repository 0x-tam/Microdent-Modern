import type { ZodType } from "zod";
import {
  ApiErrorBodySchema,
  HealthResponseSchema,
  TableRowsResponseSchema,
  TablesListResponseSchema,
  TableSchemaResponseSchema,
  type HealthResponse,
  type TableRowsResponse,
  type TablesListResponse,
  type TableSchemaResponse,
} from "@microdent/contracts";
import { BridgeClientError } from "./errors.js";

/** Same rule as the bridge: logical ids only, no path segments. */
const TABLE_ID_PATTERN = /^[a-z][a-z0-9_]*$/;

export type BridgeClientOptions = {
  /** Bridge base URL, e.g. `http://127.0.0.1:17890` (no trailing slash required). */
  baseUrl: string;
  /** Optional fetch implementation (tests inject a mock). */
  fetch?: typeof fetch;
};

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function assertTableId(tableId: string): void {
  if (!TABLE_ID_PATTERN.test(tableId)) {
    throw new BridgeClientError("Invalid table id format", {
      kind: "invalid_argument",
    });
  }
}

/** Browsers require `fetch` to be called with `this === window` (or `globalThis`); storing a bare reference causes "Illegal invocation". */
function defaultBoundFetch(): typeof fetch {
  return globalThis.fetch.bind(globalThis);
}

export class BridgeClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: BridgeClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.fetchImpl = options.fetch ?? defaultBoundFetch();
  }

  async getHealth(): Promise<HealthResponse> {
    return this.requestJson("/health", HealthResponseSchema);
  }

  async getMetaTables(): Promise<TablesListResponse> {
    return this.requestJson("/v1/meta/tables", TablesListResponseSchema);
  }

  async getTableSchema(tableId: string): Promise<TableSchemaResponse> {
    assertTableId(tableId);
    return this.requestJson(`/v1/tables/${encodeURIComponent(tableId)}/schema`, TableSchemaResponseSchema);
  }

  async getTableRows(
    tableId: string,
    params?: { limit?: number; offset?: number },
  ): Promise<TableRowsResponse> {
    assertTableId(tableId);
    const q = new URLSearchParams();
    if (params?.limit !== undefined) {
      q.set("limit", String(params.limit));
    }
    if (params?.offset !== undefined) {
      q.set("offset", String(params.offset));
    }
    const qs = q.toString();
    const path = `/v1/tables/${encodeURIComponent(tableId)}/rows${qs ? `?${qs}` : ""}`;
    return this.requestJson(path, TableRowsResponseSchema);
  }

  private async requestJson<T>(path: string, schema: ZodType<T>): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
    } catch (cause) {
      throw new BridgeClientError("Network request failed", { kind: "network", cause });
    }

    const text = await res.text();
    let json: unknown;
    try {
      json = text.length === 0 ? null : JSON.parse(text);
    } catch {
      throw new BridgeClientError("Response body is not valid JSON", {
        kind: "invalid_body",
        status: res.status,
      });
    }

    if (!res.ok) {
      const api = ApiErrorBodySchema.safeParse(json);
      if (api.success) {
        throw BridgeClientError.fromApiErrorBody(res.status, api.data);
      }
      throw new BridgeClientError(`HTTP ${res.status}`, { kind: "http", status: res.status });
    }

    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new BridgeClientError("Response body failed schema validation", {
        kind: "invalid_body",
        status: res.status,
        cause: parsed.error,
      });
    }
    return parsed.data;
  }
}

export function createBridgeClient(options: BridgeClientOptions): BridgeClient {
  return new BridgeClient(options);
}
