import { describe, expect, it, vi } from "vitest";
import { createBridgeClient, BridgeClientError } from "./index.js";

function jsonResponse(body: unknown, status = 200, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("BridgeClient", () => {
  const baseUrl = "http://127.0.0.1:9";

  it("getHealth: success validates with Zod", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ ok: true, version: "0.0.1" }));
    const client = createBridgeClient({ baseUrl, fetch });
    await expect(client.getHealth()).resolves.toEqual({ ok: true, version: "0.0.1" });
    expect(fetch).toHaveBeenCalledWith(
      `${baseUrl}/health`,
      expect.objectContaining({ method: "GET", headers: { Accept: "application/json" } }),
    );
  });

  it("getMetaTables: success", async () => {
    const body = {
      tables: [{ id: "fixture_tiny", label: "Synthetic", fileName: "FAKE_TINY.dbf" }],
    };
    const fetch = vi.fn().mockResolvedValue(jsonResponse(body));
    const client = createBridgeClient({ baseUrl, fetch });
    await expect(client.getMetaTables()).resolves.toEqual(body);
    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/v1/meta/tables`, expect.anything());
  });

  it("getTableSchema: success", async () => {
    const body = {
      tableId: "fixture_tiny",
      fields: [
        { name: "ALIAS", type: "C", size: 16 },
        { name: "SCORE", type: "N", size: 6, decimalPlaces: 1 },
      ],
    };
    const fetch = vi.fn().mockResolvedValue(jsonResponse(body));
    const client = createBridgeClient({ baseUrl, fetch });
    await expect(client.getTableSchema("fixture_tiny")).resolves.toEqual(body);
    expect(fetch).toHaveBeenCalledWith(
      `${baseUrl}/v1/tables/fixture_tiny/schema`,
      expect.anything(),
    );
  });

  it("getTableRows: success with limit and offset query params", async () => {
    const body = {
      tableId: "fixture_tiny",
      limit: 2,
      offset: 1,
      totalRecords: 3,
      rows: [{ ALIAS: "fixture_beta", SCORE: 2.5 }],
    };
    const fetch = vi.fn().mockResolvedValue(jsonResponse(body));
    const client = createBridgeClient({ baseUrl, fetch });
    await expect(client.getTableRows("fixture_tiny", { limit: 2, offset: 1 })).resolves.toEqual(body);
    expect(fetch).toHaveBeenCalledWith(
      `${baseUrl}/v1/tables/fixture_tiny/rows?limit=2&offset=1`,
      expect.anything(),
    );
  });

  it("non-2xx with API error body throws BridgeClientError (http)", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ error: { code: "TABLE_NOT_FOUND", message: "unknown table id" } }, 404),
      );
    const client = createBridgeClient({ baseUrl, fetch });
    await expect(client.getTableSchema("missing_one")).rejects.toMatchObject({
      name: "BridgeClientError",
      kind: "http",
      status: 404,
      apiCode: "TABLE_NOT_FOUND",
    });
  });

  it("non-2xx without API shape throws http BridgeClientError", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ foo: "bar" }, 500));
    const client = createBridgeClient({ baseUrl, fetch });
    try {
      await client.getHealth();
      expect.fail("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(BridgeClientError);
      const err = e as BridgeClientError;
      expect(err.kind).toBe("http");
      expect(err.status).toBe(500);
    }
  });

  it("2xx with invalid JSON throws invalid_body", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("not-json", { status: 200 }));
    const client = createBridgeClient({ baseUrl, fetch });
    await expect(client.getHealth()).rejects.toMatchObject({
      name: "BridgeClientError",
      kind: "invalid_body",
      status: 200,
    });
  });

  it("2xx with JSON that fails Zod throws invalid_body", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ wrong: true }));
    const client = createBridgeClient({ baseUrl, fetch });
    await expect(client.getHealth()).rejects.toMatchObject({
      name: "BridgeClientError",
      kind: "invalid_body",
      status: 200,
    });
  });

  it("network failure throws network BridgeClientError", async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const client = createBridgeClient({ baseUrl, fetch });
    await expect(client.getHealth()).rejects.toMatchObject({
      name: "BridgeClientError",
      kind: "network",
    });
  });

  it("rejects invalid table id before calling fetch", async () => {
    const fetch = vi.fn();
    const client = createBridgeClient({ baseUrl, fetch });
    await expect(client.getTableRows("evil/id")).rejects.toMatchObject({
      name: "BridgeClientError",
      kind: "invalid_argument",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("normalizes trailing slash on baseUrl", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ ok: true, version: "1" }));
    const client = createBridgeClient({ baseUrl: `${baseUrl}/`, fetch });
    await client.getHealth();
    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/health`, expect.anything());
  });
});
