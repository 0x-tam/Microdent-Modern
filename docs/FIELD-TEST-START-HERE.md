# Windows field test — start here

**One line:** Open **[windows-pilot-field-execution-script.md](./windows-pilot-field-execution-script.md)** and follow EXEC-01 through EXEC-16 on a clinic Windows PC.

**Before operators start:** IT completes [windows-pilot-package-verify-on-windows.md](./windows-pilot-package-verify-on-windows.md), files [windows-package-verify-evidence.md](./windows-package-verify-evidence.md), and validates it with `pnpm pilot:package-verify-evidence -- qa-runs/YYYY-MM-DD-windows-package-verify-evidence-CLINIC-PC-01.json`.

**Scope:** [windows-pilot-release-notes.md](./windows-pilot-release-notes.md) · **Results:** [windows-pilot-field-result-form.md](./windows-pilot-field-result-form.md) · **Attachment manifest:** [evidence-attachment-manifest.md](./evidence-attachment-manifest.md) · **Machine-readable evidence:** [windows-field-evidence-report.md](./windows-field-evidence-report.md) · **Sign-off:** [windows-pilot-go-no-go-checklist.md](./windows-pilot-go-no-go-checklist.md)

**Field execution packet:** from the repo root, run `pnpm pilot:windows-field-packet -- --date YYYY-MM-DD --clinic-label CLINIC-PC-01` before the Windows session. It prints EXEC-01 through EXEC-16 evidence prompts, target evidence filenames, package-verification evidence validation, attachment-manifest validation, and repo-guard commands.

**Master evidence packet:** run `pnpm pilot:evidence-collection-packet -- --clinic-label CLINIC-PC-01 --write` from a full repo checkout to write a PHI-safe command packet for field, installer, update, commercial launch, go-live, filing-plan, repo guard, status, and completion audit steps. See [evidence-collection-packet.md](./evidence-collection-packet.md).

**Evidence filing plan:** run `pnpm pilot:evidence-filing-plan -- --clinic-label CLINIC-PC-01` to print packet commands, exact target filenames, and commercial validators to use after package verification evidence and Windows field evidence JSON are filed and validated. Use `--write` only for a Markdown checklist; do not create non-template JSON reports until real evidence exists.

**Full handoff index:** [PILOT-HANDOFF-PACK.md](./PILOT-HANDOFF-PACK.md)
