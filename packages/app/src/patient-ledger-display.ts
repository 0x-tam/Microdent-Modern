import type { LedgerEntryV1 } from "@microdent/contracts";
import { legacyCodeLabel } from "./legacy-code-label.js";
import { PATIENT_TAB_SECTION_UNDATED } from "./read-only-ui-copy.js";

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
  return legacyCodeLabel("charge type", code);
}

export function ledgerAdjustmentTypeLabel(code: number | null): string | null {
  if (code === null) return null;
  return legacyCodeLabel("adjustment type", code);
}

export function ledgerPaymentTypeLabel(code: number | null): string | null {
  if (code === null) return null;
  return legacyCodeLabel("payment type", code);
}

export function ledgerCardPaymentLabel(isCard: boolean | null): string | null {
  if (isCard === null) return null;
  return isCard ? "Card payment" : "Not card payment";
}

export const LEDGER_UNDATED_MONTH_KEY = "undated";

export function ledgerMonthKeyFromIso(iso: string | null): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return LEDGER_UNDATED_MONTH_KEY;
  return iso.slice(0, 7);
}

export function formatLedgerMonthHeading(monthKey: string): string {
  if (monthKey === LEDGER_UNDATED_MONTH_KEY) return PATIENT_TAB_SECTION_UNDATED;
  try {
    return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(
      new Date(`${monthKey}-01T12:00:00`),
    );
  } catch {
    return monthKey;
  }
}

export type LedgerEntryKind = "charge" | "adjustment" | "payment";

function ledgerCodeActive(code: number | null): boolean {
  return code !== null && code !== 0;
}

export function ledgerEntryKinds(entry: LedgerEntryV1): LedgerEntryKind[] {
  const kinds: LedgerEntryKind[] = [];
  if (ledgerCodeActive(entry.chargeTypeCode)) kinds.push("charge");
  if (ledgerCodeActive(entry.adjustmentTypeCode)) kinds.push("adjustment");
  if (ledgerCodeActive(entry.paymentTypeCode)) kinds.push("payment");
  return kinds;
}

export function ledgerEntryMatchesKind(entry: LedgerEntryV1, kind: LedgerEntryKind): boolean {
  return ledgerEntryKinds(entry).includes(kind);
}

export type LedgerEntryTypeFilter = LedgerEntryKind | null;

export function filterLedgerEntriesByType(
  items: readonly LedgerEntryV1[],
  typeFilter: LedgerEntryTypeFilter,
): LedgerEntryV1[] {
  if (typeFilter === null) return [...items];
  return items.filter((e) => ledgerEntryMatchesKind(e, typeFilter));
}

export function ledgerTypeFiltersPresent(items: readonly LedgerEntryV1[]): LedgerEntryKind[] {
  const kinds = new Set<LedgerEntryKind>();
  for (const e of items) {
    for (const k of ledgerEntryKinds(e)) kinds.add(k);
  }
  const order: LedgerEntryKind[] = ["charge", "adjustment", "payment"];
  return order.filter((k) => kinds.has(k));
}

export function ledgerTypeFilterActive(typeFilter: LedgerEntryTypeFilter): boolean {
  return typeFilter !== null;
}

export type LedgerMonthGroup = {
  monthKey: string;
  heading: string;
  items: LedgerEntryV1[];
};

export type LedgerTypeDistribution = Record<LedgerEntryKind, number>;

export function ledgerTypeDistributionCounts(items: readonly LedgerEntryV1[]): LedgerTypeDistribution {
  const counts: LedgerTypeDistribution = { charge: 0, adjustment: 0, payment: 0 };
  for (const e of items) {
    for (const kind of ledgerEntryKinds(e)) {
      counts[kind]++;
    }
  }
  return counts;
}

/** Count-only summary — no amounts or memo text. */
export function formatLedgerTypeDistribution(counts: LedgerTypeDistribution): string | null {
  const parts: string[] = [];
  if (counts.charge > 0) {
    parts.push(`${counts.charge} charge${counts.charge === 1 ? "" : "s"}`);
  }
  if (counts.payment > 0) {
    parts.push(`${counts.payment} payment${counts.payment === 1 ? "" : "s"}`);
  }
  if (counts.adjustment > 0) {
    parts.push(`${counts.adjustment} adjustment${counts.adjustment === 1 ? "" : "s"}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function formatLedgerMonthGroupHeading(monthKey: string, entryCount: number): string {
  const base = formatLedgerMonthHeading(monthKey);
  if (entryCount === 1) return `${base} · 1 entry`;
  return `${base} · ${entryCount} entries`;
}

export function groupLedgerEntriesByMonth(items: readonly LedgerEntryV1[]): LedgerMonthGroup[] {
  const sorted = sortLedgerEntriesForDisplay(items);
  const map = new Map<string, LedgerEntryV1[]>();
  for (const e of sorted) {
    const key = ledgerMonthKeyFromIso(e.date);
    const bucket = map.get(key) ?? [];
    bucket.push(e);
    map.set(key, bucket);
  }
  const keys = [...map.keys()].sort((a, b) => {
    if (a === LEDGER_UNDATED_MONTH_KEY) return 1;
    if (b === LEDGER_UNDATED_MONTH_KEY) return -1;
    return b.localeCompare(a);
  });
  return keys.map((monthKey) => ({
    monthKey,
    heading: formatLedgerMonthHeading(monthKey),
    items: map.get(monthKey) ?? [],
  }));
}
