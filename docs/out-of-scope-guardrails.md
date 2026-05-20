# Out-of-scope guardrails — clinic MVP

**Purpose:** Prevent accidental expansion into dangerous legacy write domains during the Windows clinic MVP batch.

**Related:** [phase-3-write-safe-qa-checklist.md](./phase-3-write-safe-qa-checklist.md), [phase-6-windows-mvp-operator-guide.md](./phase-6-windows-mvp-operator-guide.md), bridge `write-route-inventory.test.ts`.

---

## Never write (product)

| Domain | Examples | Status |
| --- | --- | --- |
| Payments / ledger | `AMOUNT`, `SAMOUNT`, ledger lines, balances | **Out of scope** |
| Treatment / procedures | treatment memos, fee lines | **Out of scope** |
| Chart / odontogram | chart notes, tooth labels | **Out of scope** |
| Medical summary | allergies, clinical notes | **Out of scope** |
| Memos / comments | `COMMENT`, `NOTE`, `DESCRIPT`, free-text fields | **Out of scope** on all pilot routes |

## Allowed sandbox workflows (only four)

1. `appointment.statusUpdate` — numeric status on `SCHEDULE.DBF`
2. `appointment.timeMove` — date/time/room on `SCHEDULE.DBF`
3. `appointment.create` — new schedule row
4. `patient.demographics.update` — allowlisted name fields on `PATIENT.DBF`

## Path guardrails

| Path | Rule |
| --- | --- |
| `Microdent-Legacy` | **Never** set `DATA_ROOT` here |
| `Microdent-Legacy-Copy` | Read-only source for mirror import only |
| `Microdent-Write-Sandbox` | Only disposable tree for commits |

## API guardrails

- `services/bridge/src/routes/v1.ts` exposes **exactly four** `router.patch` / `router.post` write handlers (inventory test).
- Request bodies with forbidden keys (`COMMENT`, `NOTE`, `AMOUNT`, etc.) return `WRITE_BODY_FORBIDDEN_KEYS`.
- Mirror SQLite is a **snapshot** — commits do not refresh mirror tables; DBF readback is the write proof.

## QA guardrails

- `pnpm qa:sandbox` proves writes via **DBF readback**, not mirror row queries.
- Logs and docs: HTTP status, workflow, `operationId`, hash prefixes, backup basenames — no PHI or raw row bodies.
