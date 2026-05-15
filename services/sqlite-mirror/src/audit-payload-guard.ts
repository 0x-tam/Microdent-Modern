/** Keys that must never appear in audit payloads (row snapshots, PHI, amounts). */
export const FORBIDDEN_AUDIT_PAYLOAD_KEYS = [
  "before",
  "after",
  "rawRow",
  "patientName",
  "noteText",
  "amount",
] as const;

export type ForbiddenAuditPayloadKey = (typeof FORBIDDEN_AUDIT_PAYLOAD_KEYS)[number];

const FORBIDDEN_KEY_SET = new Set<string>(FORBIDDEN_AUDIT_PAYLOAD_KEYS);

export class AuditUnsafePayloadError extends Error {
  readonly forbiddenKey: string;
  readonly path: string;

  constructor(forbiddenKey: string, path: string) {
    super(`Audit payload rejects forbidden key "${forbiddenKey}" at ${path}`);
    this.name = "AuditUnsafePayloadError";
    this.forbiddenKey = forbiddenKey;
    this.path = path;
  }
}

/**
 * Rejects nested objects/arrays that contain forbidden property names.
 */
export function assertSafeAuditPayload(value: unknown, path = "payload"): void {
  if (value === null || value === undefined) return;

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafeAuditPayload(item, `${path}[${index}]`));
    return;
  }

  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEY_SET.has(key)) {
        throw new AuditUnsafePayloadError(key, `${path}.${key}`);
      }
      assertSafeAuditPayload(child, `${path}.${key}`);
    }
  }
}

/**
 * Rejects free-text fields that embed forbidden JSON key tokens.
 */
export function assertSafeAuditText(text: string, path: string): void {
  for (const key of FORBIDDEN_AUDIT_PAYLOAD_KEYS) {
    if (text.includes(`"${key}"`) || text.includes(`'${key}'`)) {
      throw new AuditUnsafePayloadError(key, path);
    }
  }
}

export function stringifySafeAuditJson(value: unknown, path: string): string {
  assertSafeAuditPayload(value, path);
  const json = JSON.stringify(value);
  assertSafeAuditText(json, path);
  return json;
}
