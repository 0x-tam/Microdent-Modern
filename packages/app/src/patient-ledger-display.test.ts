import { describe, expect, it } from "vitest";
import {
  filterLedgerEntriesByType,
  formatLedgerDate,
  formatLedgerMonthGroupHeading,
  formatLedgerMonthHeading,
  formatLedgerTypeDistribution,
  groupLedgerEntriesByMonth,
  ledgerAdjustmentTypeLabel,
  ledgerCardPaymentLabel,
  ledgerChargeTypeLabel,
  ledgerEntryKinds,
  ledgerEntryMatchesKind,
  ledgerPaymentTypeLabel,
  ledgerTypeDistributionCounts,
  ledgerTypeFiltersPresent,
  sortLedgerEntriesForDisplay,
} from "./patient-ledger-display.js";

const entry = (id: string, date: string | null, overrides: Partial<{
  chargeTypeCode: number | null;
  adjustmentTypeCode: number | null;
  paymentTypeCode: number | null;
  isCardPayment: boolean | null;
}> = {}): {
  ledgerEntryId: string;
  patientId: string;
  date: string | null;
  chargeTypeCode: number | null;
  adjustmentTypeCode: number | null;
  paymentTypeCode: number | null;
  isCardPayment: boolean | null;
  hasDescription: boolean;
} => ({
  ledgerEntryId: id,
  patientId: "42",
  date,
  chargeTypeCode: 1,
  adjustmentTypeCode: 0,
  paymentTypeCode: 100,
  isCardPayment: false,
  hasDescription: false,
  ...overrides,
});

describe("sortLedgerEntriesForDisplay", () => {
  it("orders by date descending then entry id", () => {
    const sorted = sortLedgerEntriesForDisplay([
      entry("10", "2023-01-01"),
      entry("20", "2024-06-01"),
      entry("15", "2024-06-01"),
    ]);
    expect(sorted.map((e) => e.ledgerEntryId)).toEqual(["20", "15", "10"]);
  });
});

describe("ledger display labels", () => {
  it("formats opaque type codes without amount fields", () => {
    expect(ledgerChargeTypeLabel(2)).toBe("Legacy charge type code 2 (unmapped)");
    expect(ledgerAdjustmentTypeLabel(1)).toBe("Legacy adjustment type code 1 (unmapped)");
    expect(ledgerPaymentTypeLabel(100)).toBe("Legacy payment type code 100 (unmapped)");
    expect(ledgerCardPaymentLabel(true)).toBe("Card payment");
    expect(ledgerCardPaymentLabel(false)).toBe("Not card payment");
    expect(formatLedgerDate("2024-06-01")).toMatch(/2024/);
  });
});

describe("ledger grouping and filters", () => {
  it("classifies entry kinds from non-zero type codes", () => {
    const chargeOnly = entry("1", "2024-06-01", {
      chargeTypeCode: 2,
      adjustmentTypeCode: 0,
      paymentTypeCode: 0,
    });
    expect(ledgerEntryKinds(chargeOnly)).toEqual(["charge"]);
    expect(ledgerEntryMatchesKind(chargeOnly, "charge")).toBe(true);
    expect(ledgerEntryMatchesKind(chargeOnly, "payment")).toBe(false);
  });

  it("filters by entry type", () => {
    const items = [
      entry("1", "2024-06-01", { chargeTypeCode: 2, adjustmentTypeCode: 0, paymentTypeCode: 0 }),
      entry("2", "2024-05-01", { chargeTypeCode: 0, adjustmentTypeCode: 0, paymentTypeCode: 100 }),
    ];
    expect(ledgerTypeFiltersPresent(items)).toEqual(["charge", "payment"]);
    expect(filterLedgerEntriesByType(items, "payment").map((e) => e.ledgerEntryId)).toEqual(["2"]);
  });

  it("groups ledger lines by month", () => {
    const groups = groupLedgerEntriesByMonth([
      entry("1", "2024-06-01"),
      entry("2", "2024-01-15"),
      entry("3", null),
    ]);
    expect(groups.map((g) => g.monthKey)).toEqual(["2024-06", "2024-01", "undated"]);
    expect(formatLedgerMonthHeading("2024-06")).toMatch(/2024/);
    expect(formatLedgerMonthGroupHeading("2024-06", 2)).toMatch(/2024.*2 entries/);
  });

  it("formats type distribution without amounts", () => {
    const items = [
      entry("1", "2024-06-01", { chargeTypeCode: 2, adjustmentTypeCode: 0, paymentTypeCode: 0 }),
      entry("2", "2024-06-01", { chargeTypeCode: 3, adjustmentTypeCode: 0, paymentTypeCode: 0 }),
      entry("3", "2024-05-01", { chargeTypeCode: 0, adjustmentTypeCode: 1, paymentTypeCode: 0 }),
      entry("4", "2024-05-01", { chargeTypeCode: 0, adjustmentTypeCode: 0, paymentTypeCode: 100 }),
    ];
    const counts = ledgerTypeDistributionCounts(items);
    expect(formatLedgerTypeDistribution(counts)).toBe("2 charges · 1 payment · 1 adjustment");
    expect(formatLedgerTypeDistribution(counts)).not.toMatch(/\$|AMOUNT|SAMOUNT/i);
  });

  it("uses safe filter labels without forbidden tokens", () => {
    const labels = [
      ledgerChargeTypeLabel(2),
      ledgerAdjustmentTypeLabel(1),
      ledgerPaymentTypeLabel(100),
      ledgerCardPaymentLabel(true),
    ];
    for (const label of labels) {
      expect(label).not.toMatch(/\bAMOUNT\b|\bSAMOUNT\b|\bDESCR\b|\bINSURANCE\b/i);
    }
  });
});
