import { isScheduleBlockedWriteField } from "@microdent/contracts";

export function findBlockedScheduleBodyKeys(body: unknown): string[] {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return [];
  }
  const blocked: string[] = [];
  for (const key of Object.keys(body as Record<string, unknown>)) {
    if (isScheduleBlockedWriteField(key)) {
      blocked.push(key);
    }
  }
  return blocked;
}
