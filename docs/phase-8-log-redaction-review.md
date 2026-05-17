# Phase 8 — Log redaction review

**Date:** 2026-05-17  
**Scope:** Bridge, mirror import CLI, desktop supervisor, write/audit paths.

## Rules (unchanged)

- No raw DBF/SQLite row payloads in logs or HTTP bodies
- No full phone, address, email, insurance, medical text, payment amounts, memos, or schedule `COMMENT` / `PAT_NAME` / `TELEPHONE`
- No before/after values in `SafeWritePlan` or `write_audit` detail JSON
- Validation failures must not echo sensitive field contents

## Reviewed areas

| Area | Finding |
| --- | --- |
| Write commit handlers | Error messages are generic codes only |
| Backup manifest CLI | Filename/size/sha256 only; fixture tests assert no secret tokens in manifest |
| Schedule write validation | Overlap/conflict paths do not log `TIME` raw values on failure |
| Patient demographics write | Profile re-read uses safe DTO; phone columns never logged |
| Rate limit middleware | Returns `RATE_LIMITED` without request body |
| Desktop supervisor | Logs health status and exit codes only |

## Follow-ups (not blocking pilot)

- Structured JSON logging with explicit allowlist fields
- Periodic grep CI for forbidden tokens in `services/bridge/src` log strings
