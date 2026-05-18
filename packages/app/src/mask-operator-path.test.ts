import { describe, expect, it } from "vitest";
import { maskOperatorPath } from "./mask-operator-path.js";

describe("maskOperatorPath", () => {
  it("masks Windows paths to drive and tail segments", () => {
    expect(maskOperatorPath("C:\\Microdent\\Write-Sandbox\\DATA")).toBe("C:\\…\\Write-Sandbox\\DATA");
  });

  it("collapses UNC paths", () => {
    expect(maskOperatorPath("\\\\fileserver\\share\\Microdent\\DATA")).toBe("\\\\…\\Microdent\\DATA");
  });

  it("never returns the full input for long home paths", () => {
    const masked = maskOperatorPath("/Users/operator/Microdent/Write-Sandbox/DATA");
    expect(masked).not.toContain("/Users/operator");
    expect(masked).toContain("Write-Sandbox");
  });

  it("handles empty input", () => {
    expect(maskOperatorPath("")).toBe("…");
  });
});
