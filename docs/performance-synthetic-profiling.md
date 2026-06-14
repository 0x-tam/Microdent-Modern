# Synthetic Performance Profiling

This profiling slice uses generated DBF fixtures only. It must not use real clinic files, copied clinic folders, screenshots, patient names, phone numbers, addresses, notes, or other PHI.

## Fixture Plan

Run `pnpm perf:synthetic` to generate temporary DBFs outside the repository, import them into a temporary SQLite local copy, and measure bridge read routes against that local copy.

Default dataset:

| Source table | Rows | PHI policy |
| --- | ---: | --- |
| `PATIENT.DBF` | 5,000 | Synthetic names, synthetic chart numbers, `555` phone placeholders, `example.invalid` emails |
| `SCHEDULE.DBF` | 50,000 | Synthetic appointment ids, dates, rooms, status codes, and synthetic patient links |
| Reference tables | Minimal | Synthetic providers, rooms, and procedure labels |
| Medical/treatment tables | Empty safe fixtures | Included so full safe import exercises the expected table set |

Generated DBF and SQLite files are deleted by default. Use `--keep-generated` only for local investigation; do not commit generated fixture data.

## Measured Paths

The script measures:

- Local-copy import time through `runMirrorImportSafe`.
- Bridge health and mirror status.
- Patient search by specific synthetic name and broad token.
- Patient profile lookup.
- Patient appointment lookup.
- Schedule lookup over one week and one room-filtered week.
- Schedule room and reference doctor reads.

Each route gets one warmup request and then timed iterations. The markdown report records machine, Node version, dataset size, import rows, route timings, and failures.

## Baseline Thresholds

Initial thresholds are intentionally conservative local baselines for trend tracking, not clinic go-live criteria. Real Windows validation remains required.

| Path | P95 threshold |
| --- | ---: |
| `/health` | 200 ms |
| `/v1/mirror/status` | 250 ms |
| `/v1/patients/search` specific query | 500 ms |
| `/v1/patients/search` broad query | 700 ms |
| `/v1/patients/:id/profile` | 300 ms |
| `/v1/patients/:id/appointments` | 800 ms |
| `/v1/schedule/appointments` one week | 1,200 ms |
| `/v1/schedule/appointments` one room | 1,000 ms |
| `/v1/schedule/rooms` | 250 ms |
| `/v1/reference/doctors` | 250 ms |

Example report command:

```bash
pnpm perf:synthetic --output qa-runs/2026-06-06-synthetic-performance-baseline.md
```
