/** Schedule columns that must never appear in write request bodies. */
export const SCHEDULE_BLOCKED_WRITE_FIELD_NAMES = [
  "COMMENT",
  "PAT_NAME",
  "TELEPHONE",
  "CASENUM",
] as const;

export type ScheduleBlockedWriteFieldName = (typeof SCHEDULE_BLOCKED_WRITE_FIELD_NAMES)[number];

export function isScheduleBlockedWriteField(key: string): boolean {
  const upper = key.trim().toUpperCase();
  return (SCHEDULE_BLOCKED_WRITE_FIELD_NAMES as readonly string[]).includes(upper);
}
