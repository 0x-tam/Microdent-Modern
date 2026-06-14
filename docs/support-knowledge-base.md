# Support knowledge base

**Purpose:** First-line support playbook for Microdent Modern pilot and commercial-readiness preparation. Use this before filing defects or escalating to engineering.

**Scope today:** Portable pilot RC, local-only data, copied clinic data, optional disposable sandbox writes.

**Do not collect:** patient names, chart numbers, phone numbers, DBF rows, raw `config.json`, `.dbf`, `.sqlite`, `.env`, or unrestricted log folders.

## Triage first

| Symptom | First action | Escalate when |
| --- | --- | --- |
| App opens blank | Verify staged package layout and `web/index.html`; rebuild package if missing | Rebuilt package still opens blank |
| Clinic service offline | Settings → **Restart clinic service**, then **Check service port** | Offline after 2 minutes and Node 22+ is confirmed |
| Setup rejects clinic folder | Confirm copied/disposable DATA folder, not live legacy; check permissions | Folder is copied but still rejected |
| Local copy stale or changed | Settings → **Refresh local copy**, then **Refresh status** | Refresh repeatedly fails or core tables stay incomplete |
| Sandbox write blocked | Confirm disposable sandbox marker, write mode, and backup folder | All prerequisites pass but commit still blocked |
| Backup/restore concern | Use [pilot-backup-restore-audit.md](./pilot-backup-restore-audit.md); verify backup before restore | Restore fails or backup verification fails |
| SmartScreen or AV warning | Treat as expected for unsigned pilot; follow IT endpoint policy | Endpoint blocks app or bundled/system Node permanently |
| Support export failed | Check `%AppData%\Microdent\` permissions locally; do not attach raw folders | Export keeps failing after permission fix |

## Safe evidence to request

| Ask for | Why it is safe |
| --- | --- |
| `packageVersion`, `releaseChannel`, short `gitCommit` | Build identity only |
| Windows version and Node version | Environment identity only |
| Machine label such as `CLINIC-PC-01` | Fictional/non-patient identifier |
| Settings checklist row names | Status categories only |
| `operationId` from sandbox write feedback | Synthetic audit correlation, no row payload |
| Whether path is local drive / spaced / UNC | Path class only |
| Cropped Settings screenshot | No patient grid or profile content |

## Never request in routine support

| Do not request | Safer alternative |
| --- | --- |
| Full `%AppData%\Microdent\config.json` | `writeMode` value and path class |
| DBF/sqlite/backup files | Operation id, workflow name, backup status |
| Full console scrollback | Last 20 sanitized lines with paths redacted |
| Patient-list screenshots | Cropped Settings/status panels |
| Raw crash dumps by email | Secure IT review only, then redacted summary |

## Escalation levels

| Level | Definition | Target response |
| --- | --- | --- |
| `P0 safety` | PHI leakage, live legacy write attempt, unsupported write not blocked | Stop test immediately; sponsor/IT/engineering review |
| `P1 blocker` | App unusable, field script cannot continue, restore/backup failure | Same business day during pilot window |
| `P2 workflow` | Core workflow broken with workaround | Next pilot triage session |
| `P3 polish` | Copy, layout, non-blocking warning, documentation confusion | Batch for next RC |
| `Question` | Scope or policy clarification | Answer in triage notes; update docs if repeated |

## Common answers

| Question | Answer |
| --- | --- |
| Is the app signed? | No. Pilot RC is portable and unsigned. SmartScreen can appear until Authenticode signing ships. |
| Is there an installer? | No. The staged package is portable. Installer work remains blocked until field/signing evidence exists. |
| Does the app auto-update? | No. Updates are IT-controlled manual redeploys of verified packages. |
| Can operators use live legacy data for writes? | No. Writes are sandbox-only on disposable copied data. |
| Does support receive PHI automatically? | No. There is no telemetry/upload; operators manually export only PHI-safe material. |
| Are payment, ledger, chart, medical, or memo writes available? | No. They are explicitly out of scope and should remain blocked. |

## Closeout checklist

Before closing a support item:

- Severity is set correctly.
- Build identity is recorded.
- No PHI or raw clinic files are attached.
- Reproduction step has an `EXEC-*` or checklist reference when applicable.
- Workaround or next action is written in operator language.
- If repeated, update [pilot-feedback-triage-workflow.md](./pilot-feedback-triage-workflow.md) or [windows-pilot-troubleshooting-pack.md](./windows-pilot-troubleshooting-pack.md).
