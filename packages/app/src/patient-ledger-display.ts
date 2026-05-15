import type { LedgerEntryV1 } from "@microdent/contracts";

/** Sort newest first; stable tie-break on ledger entry id. */
export function sortLedgerEntriesForDisplay(items: readonly LedgerEntryV1[]): LedgerEntryV1[] {
  return [...items].sort((a, b) => {
    const da = a.date ?? "";
    const db = b.date ?? "";
    if (da !== db) return db.localeCompare(da);
    return b.ledgerEntryId.localeCompare(a.ledgerEntryId);
  });
}

export function formatLedgerDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso + "T12:00:00"));
  } catch {
    return iso;
  }
}

export function ledgerChargeTypeLabel(code: number | null): string | null {
  if (code === null) return null;
  return `Charge type ${code}`;
}

export function ledgerAdjustmentTypeLabel(code: number | null): string | null {
  if (code === null) return null;
  return `Adjustment type ${code}`;
}

export function ledgerPaymentTypeLabel(code: number | null): string | null {
  if (code === null) return null;
  return `Payment type ${code}`;
}

export function ledgerCardPaymentLabel(isCard: boolean | null): string | null {
  if (isCard === null) return null;
  return isCard ? "Card payment" : "Not card payment";
}
