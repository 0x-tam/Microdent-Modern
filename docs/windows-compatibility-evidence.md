# Windows compatibility evidence

**Purpose:** PHI-safe evidence that the pilot package runs on both Windows 10 and Windows 11 and that antivirus/endpoint software does not block launch, local-copy import, support export, or sandbox QA.

**Template:** [TEMPLATE-windows-compatibility-evidence.json](../qa-runs/TEMPLATE-windows-compatibility-evidence.json)

**Validator:**

```bash
pnpm pilot:windows-compatibility -- qa-runs/YYYY-MM-DD-windows-compatibility-evidence.json
```

Use `--repo-root <path>` only when validating Windows compatibility evidence from an alternate checkout/evidence bundle.

## What This Proves

`WINDOWS COMPATIBILITY: READY` means:

- At least one Windows 10 entry passed.
- At least one Windows 11 entry passed.
- Package layout, desktop launch, first-run setup, local-copy import, read-only smoke, sandbox QA, and support export passed on each filed matrix entry.
- Antivirus/endpoint status passed and any required exclusions are documented without PHI.
- No report entry observed PHI or touched live legacy data.

## PHI Rules

- Do not include patient names, chart numbers, phone numbers, raw DBF rows, screenshots, or raw `config.json`.
- Use machine labels such as `WIN10-CLINIC-PC-01`, not staff or patient names.
- Use sandbox or copied-data path descriptions only; never include live `Microdent-Legacy` paths.
- Keep antivirus notes operational, for example: “Defender allowed Electron and Node after first launch scan.”

## Relationship To Other Gates

| Gate | Scope |
| --- | --- |
| `pnpm pilot:field-evidence` | EXEC-01 through EXEC-16 field-run proof |
| `pnpm pilot:windows-compatibility` | Windows 10/11 plus endpoint/AV matrix proof |
| `pnpm pilot:commercial-readiness` | Final sellable-product evidence; references field and compatibility reports |

Expected current result for the template is `WINDOWS COMPATIBILITY: BLOCKED`. Do not weaken this validator to make unrun Windows matrix evidence look complete.
