import { describe, expect, it } from "vitest";
import { legacyCodeLabel, unknownProcedureLabel, unknownProviderLabel } from "./legacy-code-label.js";

describe("legacyCodeLabel", () => {
  it("formats honest unmapped legacy codes without clinical interpretation", () => {
    expect(legacyCodeLabel("status", 2)).toBe("Legacy status code 2 (unmapped)");
    expect(legacyCodeLabel("chart type", 1)).toBe("Legacy chart type code 1 (unmapped)");
    expect(legacyCodeLabel("charge type", 2)).toBe("Legacy charge type code 2 (unmapped)");
  });

  it("formats unknown provider and procedure fallbacks", () => {
    expect(unknownProviderLabel("7")).toBe("Unknown provider 7");
    expect(unknownProcedureLabel("D0120")).toBe("Unknown procedure D0120");
  });
});
