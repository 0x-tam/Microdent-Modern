/** Local calendar date as YYYY-MM-DD (no timezone shift on the date parts). */
export function toLocalIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseLocalIso(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDaysLocal(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

export function inclusiveDayCount(from: string, to: string): number {
  const a = parseLocalIso(from).getTime();
  const b = parseLocalIso(to).getTime();
  return Math.floor((b - a) / 86_400_000) + 1;
}

const MAX_INCLUSIVE_DAY_SPAN = 365;

/** Ensures `from`…`to` is at most 365 inclusive days (patient appointments API cap). */
export function capPatientApptRange(from: string, to: string): { from: string; to: string } {
  if (inclusiveDayCount(from, to) <= MAX_INCLUSIVE_DAY_SPAN) {
    return { from, to };
  }
  const end = addDaysLocal(parseLocalIso(from), MAX_INCLUSIVE_DAY_SPAN - 1);
  return { from, to: toLocalIsoDate(end) };
}

export type PatientApptRangePreset = "default" | "past90" | "upcoming90" | "thisYear";

/** Default window: 90 days before today through 90 days after (181 inclusive days). */
export function defaultPatientApptRange(ref = new Date()): { from: string; to: string } {
  const today = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  return capPatientApptRange(
    toLocalIsoDate(addDaysLocal(today, -90)),
    toLocalIsoDate(addDaysLocal(today, 90)),
  );
}

export function patientApptRangeForPreset(
  preset: PatientApptRangePreset,
  ref = new Date(),
): { from: string; to: string } {
  const today = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  switch (preset) {
    case "default":
      return defaultPatientApptRange(ref);
    case "past90":
      return capPatientApptRange(toLocalIsoDate(addDaysLocal(today, -90)), toLocalIsoDate(today));
    case "upcoming90":
      return capPatientApptRange(toLocalIsoDate(today), toLocalIsoDate(addDaysLocal(today, 90)));
    case "thisYear": {
      const y = today.getFullYear();
      return capPatientApptRange(`${y}-01-01`, `${y}-12-31`);
    }
  }
}
