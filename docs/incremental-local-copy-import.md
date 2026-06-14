# Incremental Local-Copy Import Design

## Status

Pilot implementation: table-level incremental refresh for low-risk reference tables only.

## Goal

Reduce repeat refresh time without weakening the local-copy safety model. The first-run setup and core refresh path still create a temporary SQLite file and promote it only after core tables pass readiness checks.

## Source Snapshot

Each import run records a PHI-safe source snapshot in SQLite:

- mirror table name
- source file basename
- file state: `present`, `missing`, or `unreadable`
- file size
- file modified time
- snapshot time

The snapshot never stores paths, row payloads, patient names, phone numbers, comments, or clinical text.

## Incremental Scope

Initial incremental mode is limited to:

- `doctors` from `DOCTORS.DBF`
- `procedures` from `PROCCHRT.DBF`
- `schedule_rooms` from `SC_ROOM.DBF` and `DICSCHED.DBF`

These are reference tables. Patient, appointment, medical, and treatment tables continue to refresh fully because they are user-facing clinical data and need field proof before skip behavior is allowed.

## Behavior

When incremental mode is enabled, the importer compares the latest source snapshot for each reference table with the current copied clinic files. If every source file is unchanged, that table returns `status: "skipped"` and keeps the existing rows. If any file changed, is missing, is unreadable, or has no prior snapshot, the table imports normally.

Full import remains the fallback and default.

## Operator Status

`GET /v1/mirror/status` compares the latest import snapshot with current copied clinic files when the clinic data folder is configured. It returns only safe metadata and a `sourceChangedSinceImport` flag. Settings uses that flag to show operator-friendly refresh guidance:

> The copied clinic files changed after the last local copy refresh. Refresh the local copy before relying on search or schedule.

## Verification

- `pnpm --filter @microdent/sqlite-mirror run test`
- `pnpm --filter @microdent/bridge run test -- src/mirror-status-routes.test.ts`
- `pnpm --filter @microdent/app run test -- src/local-copy-issue.test.ts src/mirror-stale.test.ts`
