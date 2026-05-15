import { describe, expect, it } from "vitest";
import {
  formatLedgerDate,
  ledgerAdjustmentTypeLabel,
  ledgerCardPaymentLabel,
  ledgerChargeTypeLabel,
  ledgerPaymentTypeLabel,
  sortLedgerEntriesForDisplay,
} from "./patient-ledger-display.js";

const entry = (id: string, date: string | null): {
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
    expect(ledgerChargeTypeLabel(2)).toBe("Charge type 2");
    expect(ledgerAdjustmentTypeLabel(1)).toBe("Adjustment type 1");
    expect(ledgerPaymentTypeLabel(100)).toBe("Payment type 100");
    expect(ledgerCardPaymentLabel(true)).toBe("Card payment");
    expect(ledgerCardPaymentLabel(false)).toBe("Not card payment");
    expect(formatLedgerDate("2024-06-01")).toMatch(/2024/);
  });
});
