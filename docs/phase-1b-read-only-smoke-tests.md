# Phase 1b — Read-only app smoke tests

Automated smoke coverage for the **Microdent-Modern** read-only web shell: bridge health, patient search, patient profile tabs, and schedule. Tests use **Vitest + jsdom** and **mocked `fetch` only** — no Playwright, no live bridge, and **no real clinic data**.

**Related:** [phase-1b-manual-qa-checklist.md](./phase-1b-manual-qa-checklist.md) (browser QA on localhost).

---

## What is covered

| Area | Assertion |
| --- | --- |
| Bridge connected | Top bar reaches **Connected** after mocked `GET /health` |
| Search patient | Debounced search calls `/v1/patients/search` and lists synthetic hit |
| Select patient | Clicking a row opens **Patients** module and loads profile |
| Profile summary | Summary panel shows safe display name and chart |
| Appointments tab | Panel loads; safe time/room copy; no leaked schedule names |
| Medical tab | Screening flags; no free-text medical fields |
| Treatments tab | Safe procedure label; no fee/memo columns |
| Chart tab | Tooth/type/treated; note hidden |
| Ledger tab | Charge/payment type codes; amounts hidden |
| Schedule page | Sidebar **Schedule** loads rooms and appointments |
| Privacy | DOM must not contain forbidden legacy tokens or injected leak strings |

---

## Test files

| File | Role |
| --- | --- |
| `packages/app/src/read-only-smoke-fixtures.ts` | Synthetic DTOs, leaky-field envelopes, `createReadOnlySmokeFetch()`, `assertNoForbiddenDomTokens()` |
| `packages/app/src/read-only-flow-smoke.test.tsx` | End-to-end AppShell smoke (bridge → search → all patient tabs → schedule) |
| `packages/app/src/app-shell.test.tsx` | Static shell markup and label helpers (unchanged scope) |
| `packages/app/src/patient-profile-panel.test.tsx` | Deep panel/tab unit tests (unchanged scope) |

`AppShell` accepts optional `fetchImpl` and passes it to `PatientSearchBar`, `PatientProfilePanel`, `SchedulePanel`, `DashboardHome`, and the bridge health probe (tests only).

---

## Forbidden DOM checks

After the flow, tests assert the rendered text does **not** include:

- Field labels: `TELEPHONE`, `COMMENT`, `NOTE body`, `DESCRIPT`, `DESC`, `AMOUNT`, `SAMOUNT`, `raw row`
- Injected leak values from fixtures (e.g. full phone string, comment body, amount digits)

Mock responses deliberately attach these keys so regressions that stringify raw rows into the UI fail the test.

---

## Running locally

From the repo root:

```bash
pnpm test
pnpm build:web
```

To run only app smoke tests:

```bash
pnpm --filter @microdent/app exec vitest run read-only-flow-smoke
```

---

## Privacy rules for contributors

- Do not copy real patient names, chart numbers, phones, or DBF snippets into fixtures or docs.
- Extend `read-only-smoke-fixtures.ts` with **synthetic** IDs and labels only.
- If a new tab or route is added to the read-only shell, extend the smoke flow and this doc in the same PR.
