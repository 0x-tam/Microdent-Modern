import type { ReferenceDoctorItem } from "@microdent/contracts";
import { unknownProviderLabel } from "./legacy-code-label.js";

/** Positive integer doctor id as string; `null` when absent or zero. */
export function normalizeDoctorId(id: string | number | null | undefined): string | null {
  if (id === null || id === undefined) {
    return null;
  }
  if (typeof id === "number") {
    if (!Number.isFinite(id) || !Number.isInteger(id) || id <= 0) {
      return null;
    }
    return String(id);
  }
  const s = id.trim();
  if (s.length === 0 || s === "0") {
    return null;
  }
  const n = Number(s);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    return null;
  }
  return String(n);
}

/** `doctorId` → `displayName` from GET /v1/reference/doctors (safe fields only). */
export function buildDoctorLabelMap(doctors: readonly ReferenceDoctorItem[]): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const d of doctors) {
    map.set(d.doctorId, d.displayName);
  }
  return map;
}

/**
 * Safe provider label for UI. Uses reference `displayName` when known; otherwise `Doctor {id}`.
 * Returns `null` when there is no provider id (0 / blank).
 */
export function doctorDisplayLabel(
  id: string | number | null | undefined,
  labels: ReadonlyMap<string, string>,
): string | null {
  const key = normalizeDoctorId(id);
  if (key === null) {
    return null;
  }
  return labels.get(key) ?? unknownProviderLabel(key);
}

/** Profile assigned provider — `Doctor {id}` when set, em dash when absent (matches appointment rows). */
export function profileAssignedProviderLabel(
  id: string | number | null | undefined,
  labels: ReadonlyMap<string, string>,
): string {
  return doctorDisplayLabel(id, labels) ?? "—";
}
