# Phase 3 — Appointment status dev UI (dry-run / sandbox apply)

**Status:** Implemented — dev/operator tooling only; not production editing.

**Related:** [phase-3-appointment-status-dry-run.md](./phase-3-appointment-status-dry-run.md), [phase-3-appointment-status-dry-run-ui.md](./phase-3-appointment-status-dry-run-ui.md), [phase-3-write-mode-config.md](./phase-3-write-mode-config.md), [phase-3-sandbox-guard.md](./phase-3-sandbox-guard.md).

## Purpose

Exercise `PATCH /v1/schedule/appointments/:appointmentId/status` from schedule rows in **Vite dev** only. The control is visually distinct (dashed ghost buttons, operator summary panel) and never exposes PHI, raw rows, or before/after values.

## Visibility

Both must be true:

1. `import.meta.env.DEV` (Vite dev build)
2. `writeDiagnosticsActions={true}` on `AppShell` (`apps/web/src/main.tsx` sets this in local dev)

Production builds never render the control.

## Row actions

| Action | When shown | Request |
| --- | --- | --- |
| **Dry-run status** | Always (when visible) | `PATCH …/status` with `{ status }`, `X-Write-Intent: dry-run` |
| **Apply status in sandbox** | `GET /debug/status` reports `writableSandbox: true` and `writeMode` ≠ `disabled` | Same route with `X-Write-Intent: commit` |

Proposed status is synthetic (`proposedDryRunStatus`) — not edited inline.

## Result panel (safe fields only)

After a successful response:

- workflow
- mode
- committed (`true` / `false`)
- table affected
- record id
- field changed
- warnings (warning **codes** and severity only — not message bodies)

Never shown: patient name, phone, comment, note, raw row, before/after values.

## Local list behavior

| Outcome | Schedule list |
| --- | --- |
| Dry-run (`committed: false`) | Unchanged — no optimistic update |
| Committed apply (`committed: true`) | `refreshTick` increments; appointments re-fetched |

## Components

| File | Role |
| --- | --- |
| `AppointmentStatusDryRunAction.tsx` | Row actions + result panel |
| `appointment-status-dry-run.ts` | Visibility, summary, forbidden-token helpers |
| `SchedulePanel` | `writeDiagnosticsActions`, fetches `/debug/status` for sandbox button |
| `AppShell` / `apps/web/src/main.tsx` | Host flag |
| `@microdent/bridge-client` | `dryRunAppointmentStatusUpdate`, `applyAppointmentStatusInSandbox`, `getBridgeDevStatus` |
| `@microdent/contracts` | `SafeWritePlan`, `BridgeDevStatusResponse` (`writableSandbox`) |

## Tests

`packages/app/src/appointment-status-dry-run.test.tsx` (mocked `fetch`):

- hidden when flag off
- visible in dev + flag
- dry-run summary rendered; no refresh callback
- committed apply calls `onCommitted`
- forbidden PHI/raw tokens not rendered (warning messages stripped)

## Non-goals

- No production write or inline status editor
- No patient-profile appointment rows in this band
- No DBF commit until later write bands (`committed` may stay `false` on real bridge)
