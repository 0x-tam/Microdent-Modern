import { describe, expect, it, vi } from "vitest";
import { BridgeClientError } from "@microdent/bridge-client";
import { probeSyntheticFixtureConnection, SYNTHETIC_FIXTURE_TABLE_ID } from "./fixture-connection-probe.js";

describe("probeSyntheticFixtureConnection", () => {
  it("returns success when meta lists the fixture and schema/rows succeed", async () => {
    const client = {
      getMetaTables: vi.fn().mockResolvedValue({
        tables: [{ id: SYNTHETIC_FIXTURE_TABLE_ID, label: "Fixture", fileName: "FAKE_TINY.dbf" }],
      }),
      getTableSchema: vi.fn().mockResolvedValue({
        tableId: SYNTHETIC_FIXTURE_TABLE_ID,
        fields: [
          { name: "ALIAS", type: "C", size: 10 },
          { name: "SCORE", type: "N", size: 4, decimalPlaces: 0 },
        ],
      }),
      getTableRows: vi.fn().mockResolvedValue({
        tableId: SYNTHETIC_FIXTURE_TABLE_ID,
        limit: 5,
        offset: 0,
        totalRecords: 3,
        rows: [{ ALIAS: "a", SCORE: 1 }],
      }),
    };
    const r = await probeSyntheticFixtureConnection(client, { previewLimit: 5 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.fieldCount).toBe(2);
      expect(r.totalRecords).toBe(3);
      expect(r.previewRowCount).toBe(1);
      expect(r.listedInCatalog).toBe(true);
    }
    expect(client.getMetaTables).toHaveBeenCalledOnce();
    expect(client.getTableSchema).toHaveBeenCalledWith(SYNTHETIC_FIXTURE_TABLE_ID);
    expect(client.getTableRows).toHaveBeenCalledWith(SYNTHETIC_FIXTURE_TABLE_ID, { limit: 5, offset: 0 });
  });

  it("returns FIXTURE_NOT_AVAILABLE when the fixture is missing from meta tables", async () => {
    const client = {
      getMetaTables: vi.fn().mockResolvedValue({ tables: [{ id: "other", label: "Other", fileName: "OTHER.DBF" }] }),
      getTableSchema: vi.fn(),
      getTableRows: vi.fn(),
    };
    const r = await probeSyntheticFixtureConnection(client);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("FIXTURE_NOT_AVAILABLE");
    }
    expect(client.getTableSchema).not.toHaveBeenCalled();
  });

  it("maps network errors to BRIDGE_UNREACHABLE", async () => {
    const client = {
      getMetaTables: vi.fn().mockRejectedValue(new BridgeClientError("net", { kind: "network" })),
      getTableSchema: vi.fn(),
      getTableRows: vi.fn(),
    };
    const r = await probeSyntheticFixtureConnection(client);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("BRIDGE_UNREACHABLE");
  });

  it("maps 503 DATA_ROOT_NOT_CONFIGURED", async () => {
    const client = {
      getMetaTables: vi.fn().mockRejectedValue(
        new BridgeClientError("no root", {
          kind: "http",
          status: 503,
          apiCode: "DATA_ROOT_NOT_CONFIGURED",
          apiMessage: "DATA_ROOT is not configured",
        }),
      ),
      getTableSchema: vi.fn(),
      getTableRows: vi.fn(),
    };
    const r = await probeSyntheticFixtureConnection(client);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("DATA_ROOT_NOT_CONFIGURED");
  });

  it("maps 404 TABLE_NOT_FOUND to FIXTURE_NOT_AVAILABLE", async () => {
    const client = {
      getMetaTables: vi.fn().mockResolvedValue({
        tables: [{ id: SYNTHETIC_FIXTURE_TABLE_ID, label: "Fixture", fileName: "FAKE_TINY.dbf" }],
      }),
      getTableSchema: vi.fn().mockRejectedValue(
        new BridgeClientError("missing", {
          kind: "http",
          status: 404,
          apiCode: "TABLE_NOT_FOUND",
          apiMessage: "unknown table id",
        }),
      ),
      getTableRows: vi.fn(),
    };
    const r = await probeSyntheticFixtureConnection(client);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("FIXTURE_NOT_AVAILABLE");
  });

  it("maps invalid_body to INVALID_RESPONSE", async () => {
    const client = {
      getMetaTables: vi.fn().mockRejectedValue(
        new BridgeClientError("bad json", { kind: "invalid_body", status: 200 }),
      ),
      getTableSchema: vi.fn(),
      getTableRows: vi.fn(),
    };
    const r = await probeSyntheticFixtureConnection(client);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("INVALID_RESPONSE");
  });
});
