import { createPublicKey, verify } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute } from "node:path";
import type { OfflineLicenseFeatures, OfflineLicenseStatusResponse } from "@microdent/contracts";

const SCHEMA_VERSION = "microdent-offline-license/v1";
const PRODUCT = ["microdent", "modern"].join("-");
const LICENSE_ID_PATTERN = /^LIC-[A-Z0-9][A-Z0-9-]{7,63}$/;
const CLINIC_LABEL_PATTERN = /^[A-Z0-9][A-Z0-9._-]{2,31}$/i;
const ALLOWED_TIERS = new Set(["read-only-free", "sandbox-pro", "clinic-enterprise"]);
const REQUIRED_FEATURES = ["readOnly", "sandboxWrites", "localCopyRefresh", "supportExport"] as const;

const READ_ONLY_FEATURES: OfflineLicenseFeatures = {
  readOnly: true,
  sandboxWrites: false,
  localCopyRefresh: false,
  supportExport: false,
};

type LicensePayload = {
  schemaVersion?: unknown;
  product?: unknown;
  licenseId?: unknown;
  clinicLabel?: unknown;
  tier?: unknown;
  seats?: unknown;
  features?: Record<string, unknown>;
  issuedAt?: unknown;
  expiresAt?: unknown;
  graceDays?: unknown;
  expiryBehavior?: unknown;
  noPhiStatement?: unknown;
  signature?: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  if (isObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function canonicalizeLicensePayload(license: Record<string, unknown>): string {
  const { signature, ...payload } = license;
  return canonicalJson(payload);
}

function response(overrides: Partial<OfflineLicenseStatusResponse>): OfflineLicenseStatusResponse {
  return {
    status: "invalid",
    configured: true,
    licensePresent: false,
    signatureVerified: false,
    clinicLabel: null,
    tier: null,
    expiresAt: null,
    graceUntil: null,
    features: READ_ONLY_FEATURES,
    message: "Offline license could not be validated. Read-only access remains available; contact support.",
    ...overrides,
  };
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function validateShape(license: LicensePayload): boolean {
  if (license.schemaVersion !== SCHEMA_VERSION || license.product !== PRODUCT) return false;
  if (typeof license.licenseId !== "string" || !LICENSE_ID_PATTERN.test(license.licenseId)) return false;
  if (typeof license.clinicLabel !== "string" || !CLINIC_LABEL_PATTERN.test(license.clinicLabel)) return false;
  if (typeof license.tier !== "string" || !ALLOWED_TIERS.has(license.tier)) return false;
  if (!Number.isInteger(license.seats) || Number(license.seats) < 1 || Number(license.seats) > 999) return false;
  if (!isObject(license.features)) return false;
  if (!REQUIRED_FEATURES.every((feature) => typeof license.features?.[feature] === "boolean")) return false;
  if (license.noPhiStatement !== "no-real-patient-data") return false;
  if (license.expiryBehavior !== "graceful-read-only") return false;
  if (!Number.isInteger(license.graceDays) || Number(license.graceDays) < 0 || Number(license.graceDays) > 90) {
    return false;
  }
  const issuedAt = parseDate(license.issuedAt);
  const expiresAt = parseDate(license.expiresAt);
  return Boolean(issuedAt && expiresAt && issuedAt < expiresAt);
}

function loadPublicKey(): string | null {
  if (process.env.MICRODENT_LICENSE_PUBLIC_KEY?.trim()) return process.env.MICRODENT_LICENSE_PUBLIC_KEY;
  const path = process.env.MICRODENT_LICENSE_PUBLIC_KEY_PATH?.trim();
  if (!path || !isAbsolute(path) || !existsSync(path)) return null;
  return readFileSync(path, "utf8");
}

function verifyLicenseSignature(license: Record<string, unknown>, publicKeyPem: string): boolean {
  if (typeof license.signature !== "string" || !/^[A-Za-z0-9+/=]+$/.test(license.signature)) return false;
  try {
    return verify(
      null,
      Buffer.from(canonicalizeLicensePayload(license), "utf8"),
      createPublicKey(publicKeyPem),
      Buffer.from(license.signature, "base64"),
    );
  } catch {
    return false;
  }
}

function featureFlags(features: Record<string, unknown>): OfflineLicenseFeatures {
  return {
    readOnly: features.readOnly === true,
    sandboxWrites: features.sandboxWrites === true,
    localCopyRefresh: features.localCopyRefresh === true,
    supportExport: features.supportExport === true,
  };
}

export function readOfflineLicenseStatus(now = new Date()): OfflineLicenseStatusResponse {
  const licensePath = process.env.MICRODENT_LICENSE_PATH?.trim();
  if (!licensePath) {
    return response({
      status: "not-configured",
      configured: false,
      message: "No offline license is configured. Pilot read-only access remains available.",
    });
  }
  if (!isAbsolute(licensePath) || !existsSync(licensePath)) {
    return response({
      status: "missing",
      message: "Configured offline license file was not found. Read-only access remains available.",
    });
  }

  let license: LicensePayload;
  try {
    license = JSON.parse(readFileSync(licensePath, "utf8")) as LicensePayload;
  } catch {
    return response({ licensePresent: true });
  }
  if (!isObject(license) || !validateShape(license)) {
    return response({ licensePresent: true });
  }

  const expiresAt = parseDate(license.expiresAt);
  const graceUntil =
    expiresAt === null ? null : new Date(expiresAt.getTime() + Number(license.graceDays) * 24 * 60 * 60 * 1000);
  const common = {
    licensePresent: true,
    clinicLabel: String(license.clinicLabel),
    tier: license.tier as OfflineLicenseStatusResponse["tier"],
    expiresAt: String(license.expiresAt),
    graceUntil: graceUntil?.toISOString() ?? null,
  };

  if (expiresAt !== null && now.getTime() > expiresAt.getTime()) {
    return response({
      ...common,
      status: "expired",
      message: "Offline license is expired. Read-only access remains available; contact support.",
    });
  }

  const publicKeyPem = loadPublicKey();
  if (!publicKeyPem || !verifyLicenseSignature(license, publicKeyPem)) {
    return response({
      ...common,
      status: "signature-unverified",
      message: "Offline license signature could not be verified. Read-only access remains available.",
    });
  }

  return response({
    ...common,
    status: "valid",
    signatureVerified: true,
    features: featureFlags(license.features ?? {}),
    message: "Offline license is valid.",
  });
}
