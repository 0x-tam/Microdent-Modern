# Offline license mechanism

**Purpose:** Define and validate the first Microdent Modern commercial license format without network activation, PHI, usage telemetry, or local path disclosure.

**Validator:**

```bash
pnpm license:validate -- qa-runs/YYYY-MM-DD-offline-license-CLINIC-PC-01.json --public-key keys/microdent-license-public.pem
```

Relative `--public-key` paths resolve from the repository root by default. Use `--repo-root <path>` only when validating an offline license and public key from an alternate checkout/evidence bundle.

## Format

The license is a signed JSON file with schema version `microdent-offline-license/v1`.

Required fields:

| Field | Requirement |
| --- | --- |
| `product` | Must be `microdent-modern` |
| `licenseId` | Support-safe `LIC-*` identifier; no patient/staff names |
| `clinicLabel` | Support-safe clinic or machine label such as `CLINIC-PC-01` |
| `tier` | `read-only-free`, `sandbox-pro`, or `clinic-enterprise` |
| `seats` | Integer from 1 to 999 |
| `features` | Boolean flags for `readOnly`, `sandboxWrites`, `localCopyRefresh`, and `supportExport` |
| `issuedAt` / `expiresAt` | ISO UTC timestamps |
| `graceDays` | Integer from 0 to 90 |
| `expiryBehavior` | Must be `graceful-read-only` |
| `noPhiStatement` | Must be `no-real-patient-data` |
| `signature` | Base64 Ed25519 signature over canonical JSON excluding `signature` |

## Signature input

The validator canonicalizes the license object by:

- Removing the top-level `signature` field.
- Sorting object keys recursively.
- Preserving arrays in order.
- Signing/verifying the UTF-8 canonical JSON string.

This keeps license generation reproducible across Windows, macOS, and Linux.

## Privacy guardrails

The license file must not contain:

- Patient names, chart numbers, phone numbers, comments, DBF rows, or raw logs.
- Local user paths such as `/Users/...`, `/home/...`, or `C:\Users\...`.
- Legacy data locations such as `Microdent-Legacy`.
- Usage telemetry, patient counts, appointment counts, or schedule-derived limits.

Use clinic labels like `CLINIC-PC-01`. Do not use patient, staff, or provider names.

## Expiry behavior

Expired or invalid licenses must not create an unsafe hard lockout. The supported commercial behavior is:

1. Keep read-only access available when possible.
2. Disable sandbox writes and commercial-only features.
3. Show clear support copy that avoids PHI and avoids exposing local paths.
4. Require a replacement signed license file or signed support override.

## Runtime status

The clinic service exposes a local-only, path-free license status endpoint:

```text
GET /v1/meta/license-status
```

The response contains only support-safe fields: status, clinic label, tier,
expiry/grace timestamps, feature booleans, signature verification state, and
operator-safe copy. It must not return the license path, public key path,
signature text, patient counts, usage telemetry, DBF rows, local paths, or raw
validation errors.

Supported runtime statuses:

| Status | Meaning |
| --- | --- |
| `not-configured` | No offline license path is configured; pilot read-only access remains available |
| `missing` | A local license path was configured but no file was found |
| `signature-unverified` | Shape is support-safe, but signature/key verification did not pass |
| `expired` | License expiry has passed; graceful read-only behavior applies |
| `invalid` | License JSON, schema, dates, tier, or flags are invalid |
| `valid` | Local schema, expiry, and signature checks passed |

Settings displays this status under **Package → Offline license**. The portable
pilot still does not call a license server and does not hard-lock read-only
access.

## Current status

This repo now includes the offline license format, PHI-safe validator, and
local-only runtime status display, but it does not make Microdent Modern
commercially ready by itself. Final readiness still requires signed
app/installer evidence, Windows 10/11 and endpoint validation, update-channel
proof, sponsor approval, and filed clinic pilot reports.
