/** Parse `HH:MM` or `H:MM` to minutes from midnight; returns null when invalid. */
export function parseScheduleTimeToMinutes(time: string): number | null {
  const trimmed = time.trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Normalize to `HH:MM` with zero-padded hour (legacy grid style). */
export function normalizeScheduleTimeHm(time: string): string | null {
  const minutes = parseScheduleTimeToMinutes(time);
  if (minutes === null) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function scheduleIntervalEndMinutes(startMinutes: number, durationSlots: number, periodMinutes: number): number {
  const period = periodMinutes > 0 ? periodMinutes : 30;
  return startMinutes + durationSlots * period;
}

export function scheduleIntervalsOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Weekday index 0=Sunday … 6=Saturday for an ISO date. */
export function weekdayIndexFromIsoDate(isoDate: string): number | null {
  const parts = isoDate.split("-").map((x) => Number(x));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [y, m, d] = parts;
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  if (Number.isNaN(dt.getTime())) return null;
  return dt.getUTCDay();
}
