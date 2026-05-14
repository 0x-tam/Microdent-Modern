import { describe, expect, it } from "vitest";
import { parsePagination } from "./read-table.js";

describe("parsePagination", () => {
  it("uses defaults when limit and offset are omitted", () => {
    expect(parsePagination({})).toEqual({ limit: 50, offset: 0 });
  });

  it("parses valid limit and offset", () => {
    expect(parsePagination({ limit: "10", offset: "2" })).toEqual({ limit: 10, offset: 2 });
  });

  it("rejects limit above cap", () => {
    const r = parsePagination({ limit: "101" });
    expect("error" in r).toBe(true);
  });

  it("rejects negative offset", () => {
    const r = parsePagination({ offset: "-1" });
    expect("error" in r).toBe(true);
  });

  it("rejects non-integer limit", () => {
    const r = parsePagination({ limit: "3.5" });
    expect("error" in r).toBe(true);
  });
});
