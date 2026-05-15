# Phase 3 — Appointment status dry-run UI (dev only)

**Status:** UI scaffold shipped; bridge `PATCH` route ships in Agent 6 band.

**Related:** [phase-3-dry-run-write-plan.md](./phase-3-dry-run-write-plan.md), [phase-3-appointment-write-mapping.md](./phase-3-appointment-write-mapping.md).

## Purpose

Let developers rehearse `appointment.statusUpdate` from schedule appointment rows **without** pretending a real edit occurred and **without** mutating local React state.

## Visibility

The control appears only when **both** are true:

1. `import.meta.env.DEV` (Vite dev build)
2. `appointmentStatusDryRunDev={true}` on `AppShell` (set in `apps/web/src/main.tsx` for local dev)

Production builds never show the action.

## UI behavior

| Step | Behavior |
| --- | --- |
| Render | Each schedule row may show ghost button **“Dry-run status update”** under badges |
| Click | `PATCH /v1/schedule/appointments/:id/status` with `{ status }` and `X-Write-Intent: dry-run` |
| Success | Read-only summary: workflow, table, record id, field changed, `committed: false` |
| Missing route | **404** → “Dry-run route is not available on this bridge yet.” |
| Writes disabled | **403** → operator-safe message; no state change |
| Local state | Appointment list **unchanged** — no optimistic updates |

Proposed status for rehearsal is computed in `proposedDryRunStatus()` (synthetic next code in 1–5 range).

## Components and props

| File | Role |
| --- | --- |
| `AppointmentStatusDryRunAction.tsx` | Row action + plan summary |
| `appointment-status-dry-run.ts` | Visibility helper, summary mapping, error copy |
| `SchedulePanel` | `appointmentStatusDryRunDev?: boolean` |
| `AppShell` | Passes flag from host |
| `@microdent/contracts` `safe-write-plan.ts` | `SafeWritePlan` / response Zod |
| `@microdent/bridge-client` | `dryRunAppointmentStatusUpdate()` |

## Tests

- `appointment-status-dry-run.test.tsx` — mocked `fetch`, plan summary, 404 handling
- `bridge-client` — PATCH contract test
- Schedule panel tests unchanged when flag is off (default)

## Non-goals

- No real write UI or commit button
- No patient-profile appointment rows in this band (schedule module only)
- No PHI in plan display (field names and ids only)

## Next

When Agent 6 lands the bridge route, enable sandbox + `WRITE_MODE=dry-run` per [phase-3-write-mode-config.md](./phase-3-write-mode-config.md) and click through on a disposable copy.
