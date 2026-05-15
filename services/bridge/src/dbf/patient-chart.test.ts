import { describe, expect, it } from "vitest";
import { memoFieldAppearsNonEmpty } from "./patient-dbf-helpers.js";

describe("patient chart privacy helpers", () => {
  it("memoFieldAppearsNonEmpty detects populated memo values without exposing content", () => {
    expect(memoFieldAppearsNonEmpty(null)).toBe(false);
    expect(memoFieldAppearsNonEmpty("")).toBe(false);
    expect(memoFieldAppearsNonEmpty("  ")).toBe(false);
    expect(memoFieldAppearsNonEmpty("clinical narrative")).toBe(true);
    expect(memoFieldAppearsNonEmpty({ length: 3 })).toBe(true);
  });
});
