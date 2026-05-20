# Windows clinic pilot — tester guide

**Audience:** Clinic staff and IT running the pilot without dev context.

**Start here:** [PILOT-START-HERE.md](./PILOT-START-HERE.md) · **Baseline:** `main` @ `678585f`

---

## Day 1 — Read-only (no sandbox writes)

| # | Task | Pass when |
| --- | --- | --- |
| 1 | Install Node 22, clone repo, build bridge + web + desktop | `pnpm pilot-checkpoint` passes |
| 2 | Launch desktop, complete first-run setup (sandbox paths) | Main UI opens; Settings shows Connected |
| 3 | Run mirror import from CLI | Settings mirror table shows import runs |
| 4 | Open **Today** | Day list loads from copied data |
| 5 | Open **Patients** → search | Matches appear; no notes/phones in list |
| 6 | Open **Schedule** | Week/day views load |
| 7 | Open **Settings** | Pilot checklist green where expected |

`writeMode` stays **disabled** — no commit buttons in production build.

---

## Day 2 — Sandbox writes (optional)

Only on a **disposable Write-Sandbox** copy with IT present.

| # | Task | Pass when |
| --- | --- | --- |
| 1 | Confirm `BACKUP_DIR` in config | Settings backup row OK |
| 2 | Enable write mode + sandbox ack per runbook | Settings shows sandbox ready |
| 3 | Rebuild web with write pilot flag if needed | Schedule/patient write panels visible |
| 4 | One appointment status change | Preview → confirm → commit; feedback shows operation id + backup |
| 5 | Run developer checkpoint with sandbox env | `pnpm pilot:full-checkpoint` exit 0 |

---

## Day 3 — Restore confidence

| # | Task | Pass when |
| --- | --- | --- |
| 1 | Note `operationId` from a test commit | Recorded in issue template |
| 2 | Restore from backup (CLI) | Sandbox DATA returns to pre-commit state |
| 3 | Re-import mirror if needed | Settings mirror metadata refreshed |

See [pilot-backup-restore-audit.md](./pilot-backup-restore-audit.md).

---

## Issue report template

Copy into your ticket (no PHI):

```text
Pilot build: main @ 678585f
Machine: Windows version / Node version
Desktop config: writeMode value only (not full paths in email)

Symptom:
Screen: Today / Patients / Schedule / Settings / write panel

Settings pilot checklist: which rows warn (screenshot OK — no patient names)

Checkpoint:
- pnpm pilot-checkpoint: pass / fail
- pnpm qa:sandbox: pass / fail / skipped
- operationId (if write): ___________
- audit terminal status: ___________

Mirror: stale / partial / failed / OK
```

Do **not** attach DBF files, patient names, or full `%AppData%` config with real paths in public tickets.

---

## Out of scope

Payments, ledger, chart, medical summary, memo writes — [out-of-scope-guardrails.md](./out-of-scope-guardrails.md).
