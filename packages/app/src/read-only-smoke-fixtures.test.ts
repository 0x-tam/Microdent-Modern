import { describe, expect, it } from "vitest";
import {
  assertNoForbiddenDomTokens,
  assertNoMainPageJargonInDom,
  DOM_FORBIDDEN_FIELD_LABELS,
  MAIN_PAGE_FORBIDDEN_JARGON,
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

  it("passes on safe operator copy without legacy field labels", () => {
    expect(() =>
      assertNoForbiddenDomTokens(
        "Today's schedule and next visit. Clinic service connected. Local copy ready. Read-only.",
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

describe("assertNoMainPageJargonInDom", () => {
  it("exports blocked jargon tokens for main pages", () => {
    expect(MAIN_PAGE_FORBIDDEN_JARGON).toEqual(
      expect.arrayContaining(["SQLite", "DBF fallback", "Clinic at a glance", "write mode"]),
    );
  });

  it("passes on clinic-friendly main-page copy", () => {
    expect(() =>
      assertNoMainPageJargonInDom(
        "Today's schedule. Local copy ready. Read-only. Clinic status. View details in Settings.",
      ),
    ).not.toThrow();
  });

  it.each([
    ["SQLite mirror", "Settings panel SQLite mirror path"],
    ["DBF fallback", "Mirror unavailable — DBF fallback"],
    ["write mode", "Write mode is off"],
    ["Clinic at a glance", "Clinic at a glance panel"],
    ["Pilot notes", "Pilot notes for sandbox"],
  ] as const)("rejects main-page jargon %s", (_label, sample) => {
    expect(() => assertNoMainPageJargonInDom(sample)).toThrow();
  });
});
