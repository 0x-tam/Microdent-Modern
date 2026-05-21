# Batch report — `<YYYY-MM-DD>-<short-name>`

**Date:**  
**Workstream / batch:**  
**Baseline commit:**  
**Branch:**  
**Commit performed:** Yes / No

## Summary

(One paragraph: what changed, checkpoint outcome.)

---

## Status tiers (mandatory)

Do **not** conflate Mac READY with clinic go-live. Fill every row.

| Tier | Question | Status |
| --- | --- | --- |
| **1. Mac-side release readiness** | Build, stage, verify, signoff on build machine? | READY / NOT READY |
| **2. Windows-test readiness** | Field pack docs staged and handoff complete for a future Windows run? | READY / NOT READY |
| **3. Windows execution status** | Real Windows clinic PC field run logged? | **Deferred / Not yet run** / **Completed** (date + log path) |
| **Clinic go-live** | Production clinic sign-off? | **BLOCKED** until tier 3 **Completed** + go/no-go GO |

**Reporting rule:** If tier 3 is **Deferred / Not yet run**, clinic go-live must remain **BLOCKED** even when tiers 1–2 are READY.

---

## Files changed

| Path | Purpose |
| --- | --- |
| | |

---

## Mac checkpoint results

| Step | Command | Result |
| --- | --- | --- |
| Tests | `pnpm test` | |
| Web build | `pnpm build:web` | |
| Artifact tests | `pnpm test:pilot-artifacts` | |
| Stage | `pnpm stage:pilot-release` | |
| Release verify | `pnpm pilot:verify-release` | |
| Manifest verify | `pnpm pilot:verify-manifest` | |

---

## Windows field execution

| Item | Status |
| --- | --- |
| Real Windows clinic PC run | Not done / Done (link `qa-runs/…` log) |
| Go/no-go checklist | Not filed / Filed |

---

## Safe to commit?

---

## Git status hygiene

---

## Next steps
