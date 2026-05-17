import { describe, expect, it } from "vitest";
import { parseWriteIntentHeader } from "./parse-write-intent.js";

describe("parseWriteIntentHeader", () => {
  it("defaults to commit when header is absent", () => {
    expect(parseWriteIntentHeader(undefined)).toBe("commit");
    expect(parseWriteIntentHeader("")).toBe("commit");
    expect(parseWriteIntentHeader("   ")).toBe("commit");
  });

  it("parses dry-run variants", () => {
    expect(parseWriteIntentHeader("dry-run")).toBe("dry-run");
    expect(parseWriteIntentHeader(" DRY-RUN ")).toBe("dry-run");
    expect(parseWriteIntentHeader("dry_run")).toBe("dry-run");
  });

  it("parses commit explicitly", () => {
    expect(parseWriteIntentHeader("commit")).toBe("commit");
    expect(parseWriteIntentHeader("COMMIT")).toBe("commit");
  });
});
