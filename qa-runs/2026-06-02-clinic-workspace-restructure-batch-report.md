# Clinic Workspace UI Restructure — Batch Report

**Date:** 2026-06-02  
**Baseline:** `929b662` — `feat: elevate clinic app UI and workflow experience`  
**Commit target:** `feat: restructure clinic app UI into modern workspace`  
**Node:** 22.22.3

---

## Workstreams completed

| ID | Workstream | Status |
| --- | --- | --- |
| A | DesignSpec — `docs/clinic-workspace-design-spec.md` | Done |
| B | AppShell full restructure — rail + workspace column | Done |
| C | CSS foundation — split partials, tokens, typography | Done |
| D | Today page — hero, full-width grid | Done |
| E | Patients — search hero empty state | Done |
| F | Profile — page hero, existing hero band | Done |
| G | Timeline — data-list CSS scaffold | Done |
| H | Schedule — page hero, toolbar class | Done |
| I | Write panels — write.css layout scaffold | Done |
| J | Clinical tabs — toolbar/surface patterns | Done |
| K | Settings — page hero | Done |
| L | Status system — compact strip + header pill | Done |
| M | Empty states — app-state-panel wrapper | Done |
| N | A11y — landmarks, rail regions, test updates | Done |
| O | Copy — shorter module + search strings | Done |
| P | Visual QA checklist | Done |
| Q | Safety regression — smoke tests updated | Done |
| R | Product audit update | Done |
| S | Checkpoint + report | Done |

---

## Checkpoint results

| Gate | Result |
| --- | --- |
| `pnpm test` | PASS |
| `pnpm test:pilot-artifacts` | PASS |
| `pnpm build:web` | PASS |
| `@microdent/bridge` build | PASS |
| `@microdent/desktop` build + test | PASS |
| `release-smoke` | PASS |
| `stage:pilot-release` | PASS |
| `pilot:verify-release` | PASS |
| `pilot:verify-manifest` | PASS |
| `qa:sandbox` | PASS (4 workflows) |
| `pilot:mac-release-status` | Tier 3 Deferred |

---

## Files changed (major)

**New:**
- `docs/clinic-workspace-design-spec.md`
- `docs/visual-qa-checklist.md`
- `packages/app/src/styles/` (shell-layout, shell-status, shared/*, pages/*)
- `packages/app/scripts/split-css.mjs`

**Restructured:**
- `packages/app/src/AppShell.tsx`
- `packages/app/src/app-shell.css` (import hub)
- `packages/ui/src/components.css` (40px buttons)
- Page TSX: `today-dashboard`, `PatientProfilePanel`, `SchedulePanel`, `SettingsPanel`
- Copy: `read-only-ui-copy.ts`, `app-nav-modules.ts`
- Tests: `app-shell.test.tsx`, smoke tests

---

## UX before / after

### Shell
| Before | After |
| --- | --- |
| Top bar + full-width read-only banner + status chips + sticky patient bar | Left rail (260px) + workspace column |
| Main content capped at ~1040px | Full workspace width |
| Patient context competes with page header | Patient slot in rail |
| 13–15px body, 32px compact buttons | 16px body, 14px meta, 40px buttons |

### Today
| Before | After |
| --- | --- |
| Module title/lede in shell head | Page hero with title + date |
| Narrow centered column | `1fr + 340px` operations aside grid |

### Patients
| Before | After |
| --- | --- |
| Shell patient bar + page lede | Rail patient slot + search hero (`app-state-panel`) |
| Long directory disclaimer | Shorter search copy |

### Profile
| Before | After |
| --- | --- |
| Shell triple-stack header | Page hero + existing patient hero band |
| Same tab bodies | Toolbar/data-list CSS patterns available |

### Schedule
| Before | After |
| --- | --- |
| Narrow column | Full-width with date in page hero |
| Filter bar only | Unified `.app-toolbar` class |

### Settings
| Before | After |
| --- | --- |
| Shell module lede | Page hero + existing card grid |

### Status
| Before | After |
| --- | --- |
| Full-width ReadOnlyBanner + chip row | Header read-only pill + compact status strip |

---

## Windows execution

**Deferred / Not yet run.** Clinic go-live **BLOCKED** until Tier 3 per `docs/FIELD-TEST-START-HERE.md`.

---

## Mac UI ROI

**Exhausted** after this restructure batch. Bugfix-only unless field log surfaces new requirements.
