# Synthetic performance profiling baseline

**Date:** 2026-06-06T00:58:46.371Z
**Baseline commit:** a96131b
**Dataset:** 5,000 synthetic patients, 50,000 synthetic appointments
**Machine:** linux 7.0.0-22-generic, Intel(R) Core(TM) i5-6500 CPU @ 3.20GHz, 15.0 GB RAM, host Jarvis
**Node:** v22.22.2
**Generated data:** deleted after run
**Dataset fingerprints:** data root be9588e23731, SQLite e9005fdad6ab

## Summary

This run profiles the local-copy import path and bridge read routes against generated non-PHI DBF fixtures. Synthetic labels, 555-style phone placeholders, and example.invalid addresses are generated solely for performance testing and are not copied from clinic records.

## Import

| Step | Timing / status |
| --- | ---: |
| Fixture generation | 12479.1 ms |
| Local-copy import | 3651.2 ms |
| Overall import status | success |
| Migrations applied | 9 |
| Migrations skipped | 0 |

| Table | Status | Rows | Errors |
| --- | --- | ---: | ---: |
| doctors | success | 3 | 0 |
| procedures | success | 1 | 0 |
| schedule_rooms | success | 3 | 0 |
| patients | success | 5000 | 0 |
| appointments | success | 50000 | 0 |
| medical_summary | success | 0 | 0 |
| treatments | success | 0 | 0 |

## Read Route Timings

Each route has one untimed warmup request followed by 5 measured iterations.

| Route | Path | HTTP | Avg | Min | P50 | P95 | Max | Baseline threshold | Result |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| health | `/health` | 200 | 7.0 ms | 3.4 ms | 5.8 ms | 12.8 ms | 12.8 ms | 200.0 ms | PASS |
| mirror status | `/v1/mirror/status` | 200 | 5.4 ms | 4.2 ms | 5.3 ms | 7.6 ms | 7.6 ms | 250.0 ms | PASS |
| patient search by name | `/v1/patients/search?q=Synthetic%20Patient%2001234` | 200 | 6.4 ms | 6.1 ms | 6.3 ms | 6.7 ms | 6.7 ms | 500.0 ms | PASS |
| patient search broad | `/v1/patients/search?q=SYN` | 200 | 5.2 ms | 4.1 ms | 4.6 ms | 6.8 ms | 6.8 ms | 700.0 ms | PASS |
| patient profile | `/v1/patients/2500/profile` | 200 | 3.2 ms | 3.0 ms | 3.1 ms | 3.3 ms | 3.3 ms | 300.0 ms | PASS |
| patient appointments | `/v1/patients/2500/appointments?from=2026-01-01&to=2026-06-30` | 200 | 4.1 ms | 3.9 ms | 4.0 ms | 4.6 ms | 4.6 ms | 800.0 ms | PASS |
| schedule one week | `/v1/schedule/appointments?from=2026-02-01&to=2026-02-07` | 200 | 66.4 ms | 60.3 ms | 62.1 ms | 75.0 ms | 75.0 ms | 1200.0 ms | PASS |
| schedule one room | `/v1/schedule/appointments?from=2026-02-01&to=2026-02-07&room=1` | 200 | 20.1 ms | 17.7 ms | 18.3 ms | 24.2 ms | 24.2 ms | 1000.0 ms | PASS |
| schedule rooms | `/v1/schedule/rooms` | 200 | 3.0 ms | 2.9 ms | 3.0 ms | 3.2 ms | 3.2 ms | 250.0 ms | PASS |
| reference doctors | `/v1/reference/doctors` | 200 | 3.0 ms | 2.8 ms | 2.9 ms | 3.3 ms | 3.3 ms | 250.0 ms | PASS |

## Failures

- None

## Notes

- Generated DBF and SQLite files are intentionally not committed.
- Threshold warnings are initial baselines for trend tracking, not clinic go-live proof.
- Real Windows validation remains required before using these numbers as field evidence.
