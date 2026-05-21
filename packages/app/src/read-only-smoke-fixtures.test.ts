import { describe, expect, it } from "vitest";
import {
  assertNoForbiddenDomTokens,
  DOM_FORBIDDEN_FIELD_LABELS,
  SMOKE_LEAKED_VALUES,
} from "./read-only-smoke-fixtures.js";

describe("assertNoForbiddenDomTokens", () => {
  it("exports the full blocked legacy field label list", () => {
    expect(DOM_FORBIDDEN_FIELD_LABELS).toEqual(
      expect.arrayContaining([
        "PAT_NAME",
        "TELEPHONE",
        "COMMENT",
        "NOTE",
        "DESCRIPT",
        "DESC",
        "AMOUNT",
        "SAMOUNT",
        "INSURANCE",
        "ADDRESS",
        "EMAIL",
      ]),
    );
  });

  it("passes on safe operator copy", () => {
    expect(() =>
      assertNoForbiddenDomTokens(
        "Today command center. Clinic service Connected. Mirror unavailable — DBF fallback. Writes off.",
      ),
    ).not.toThrow();
  });

  it.each([
    ["PAT_NAME", "Schedule row PAT_NAME leak"],
    ["TELEPHONE", "TELEPHONE 555-0199"],
    ["COMMENT", "COMMENT body"],
    ["NOTE", "NOTE field"],
    ["DESCRIPT", "DESCRIPT text"],
    ["DESC", "DESC column"],
    ["AMOUNT", "AMOUNT 99"],
    ["SAMOUNT", "SAMOUNT 11"],
    ["rawRow", "rawRow blob"],
    ["medicalText", "medicalText leak"],
    ["paymentAmount", "paymentAmount 12"],
  ] as const)("rejects forbidden token %s", (token, sample) => {
    expect(() => assertNoForbiddenDomTokens(sample)).toThrow();
  });

  it.each(Object.entries(SMOKE_LEAKED_VALUES))("rejects leaked mock value %s", (_key, value) => {
    expect(() => assertNoForbiddenDomTokens(`Safe prefix ${value} suffix`)).toThrow();
  });

  it('rejects quoted JSON plan keys "before" and "after"', () => {
    expect(() => assertNoForbiddenDomTokens('plan "before" value')).toThrow();
    expect(() => assertNoForbiddenDomTokens('plan "after" value')).toThrow();
  });
});
