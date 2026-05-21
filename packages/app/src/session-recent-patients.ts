/** Session-only recent patient entry (safe fields; never persisted). */
export type SessionRecentPatient = {
  patientId: string;
  displayName: string;
  chartNumber: string | null;
};

export const SESSION_RECENT_PATIENTS_MAX = 5;

export function pushSessionRecentPatient(
  list: readonly SessionRecentPatient[],
  entry: SessionRecentPatient,
  max = SESSION_RECENT_PATIENTS_MAX,
): SessionRecentPatient[] {
  const deduped = list.filter((p) => p.patientId !== entry.patientId);
  return [{ ...entry }, ...deduped].slice(0, max);
}

export function formatSessionRecentPatientMeta(entry: SessionRecentPatient): string {
  if (entry.chartNumber?.trim()) {
    return `Chart ${entry.chartNumber.trim()}`;
  }
  return `Record ${entry.patientId}`;
}
