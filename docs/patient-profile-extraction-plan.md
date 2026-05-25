# PatientProfilePanel.tsx Extraction Plan

**File:** `packages/app/src/PatientProfilePanel.tsx` (2986 lines)
**Date:** 2026-05-25
**Goal:** Split into maintainable modules while preserving all behavior. No behavioral changes.

---

## Current File Structure

| Lines | Section | ~Lines |
|-------|---------|--------|
| 1–316 | Imports, types, load states | 316 |
| 317–335 | `PROFILE_TAB_ORDER`, `PROFILE_TAB_DESCRIPTIONS` constants | 19 |
| 337–407 | Utility functions + `ProfileTabHiddenNote`, `ProfileReadonlyError` | 71 |
| 409–436 | `SUMMARY_CROSS_TABS`, `summaryCrossTabCount` | 28 |
| 438–550 | `ProfileClinicHero` | 113 |
| 552–570 | `ProfileWorkflowStrip` | 19 |
| 572–592 | `ProfileLedgerMetaLine` | 21 |
| 594–621 | `ProfileSummaryCrossTabs` | 28 |
| 623–816 | `safePatient*Error` functions (×6) | 194 |
| 836–846 | `formatApptRangeHeading` | 11 |
| 848–1055 | `TreatmentsBody` (has own filter state) | 208 |
| 1057–1195 | `ChartBody` (has own filter state) | 139 |
| 1197–1220 | `ProfileSummaryMetricGrid` | 24 |
| 1222–1365 | `LedgerBody` (has own filter state) | 144 |
| 1367–1482 | `MedicalSummaryBody` | 116 |
| 1484–1497 | `groupAppointmentsByDate` | 14 |
| 1499–1544 | `PatientPageSearchBlock` | 46 |
| **1546–2986** | **`PatientProfilePanel` (main component)** | **~1440** |

### Main Component Breakdown (L1546–2986)

| Lines | Section | ~Lines |
|-------|---------|--------|
| 1546–1574 | Props destructuring + hooks (`useDoctorLabels`, `useProcedureReference`) | 29 |
| 1575–1602 | Room map state + effect | 28 |
| 1604–1661 | State declarations (15+ useState calls, 7+ useRef) | 58 |
| 1661–1706 | Profile fetch effect | 46 |
| 1708–1830 | Summary prefetches fetch effect (parallel 5-way) | 123 |
| 1832–1871 | Appointments fetch effect | 40 |
| 1873–1912 | Medical fetch effect | 40 |
| 1914–1958 | Treatments fetch effect | 45 |
| 1960–2004 | Chart fetch effect | 45 |
| 2006–2050 | Ledger fetch effect | 45 |
| 2052–2107 | Timeline fetch effect (parallel 5-way) | 56 |
| 2109–2127 | Patient reset effect | 19 |
| 2129–2133 | Default tab effect | 5 |
| 2135–2236 | Derived values (`useMemo`) + callbacks | 102 |
| 2237–2257 | Null patientId render (search page) | 21 |
| 2259–2316 | Loading/offline/error states + toolbar | 58 |
| 2319–2366 | Tab navigation bar | 48 |
| 2368–2430 | Summary tab content | 63 |
| 2432–2477 | Timeline tab content | 46 |
| 2479–2757 | Appointments tab content (filters + grouped cards) | 279 |
| 2759–2793 | Medical tab content | 35 |
| 2795–2846 | Treatments tab content | 52 |
| 2848–2924 | Chart tab content (tooth filter + body) | 77 |
| 2926–2978 | Ledger tab content | 53 |
| 2980–2986 | Catch-all empty state | 7 |

---

## Extraction Targets

### 1. `PatientProfileTabs.tsx` — Tab Navigation Bar

**Extract:** Lines 2340–2366 (tab bar + description)

**Props:**
```ts
interface PatientProfileTabsProps {
  activeTab: ProfileTab | null;
  onTabChange: (tab: ProfileTab) => void;
  tabDescriptions: Record<ProfileTab, string>;
}
```

**State/Effects:** None — pure presentational component.

**Imports:**
- `PROFILE_TAB_ORDER` (re-exported from this file or moved to a shared constants file)
- `ProfileTab` type

**Risk:** **Low**. Pure UI, no state, no side effects.

---

### 2. `PatientSummaryTab.tsx` — Summary Tab Content

**Extract:** Lines 2368–2430 (Summary tab section)

**Props:**
```ts
interface PatientSummaryTabProps {
  profile: PatientProfileResponse;
  summaryAppt: SummaryApptPrefetch;
  summaryMed: SummaryMedPrefetch;
  summaryTx: SummaryCountPrefetch;
  summaryChart: SummaryCountPrefetch;
  summaryLedger: SummaryCountPrefetch;
  doctorLabels: ReadonlyMap<string, string>;
  procedureMaps: ProcedureReferenceMaps;
  roomMap: RoomLabelMap;
  sandboxWritePilot: boolean;
  writeCapability: BridgeDevStatusResponse | null;
  patientId: string;
  bridgeBaseUrl: string;
  fetchImpl?: typeof fetch;
  onOpenTab: (tab: ProfileTab) => void;
  onCommitted: () => void;  // for demographics write panel
}
```

**State/Effects:** None — delegates to existing child components (`PatientSummaryMiniCards`, `ProfileSummaryMetricGrid`, `ProfileLedgerMetaLine`, `ProfileSummaryCrossTabs`, `PatientDemographicsWritePanel`).

**Imports:**
- All UI copy constants
- `PatientSummaryMiniCards`, `ProfileSummaryMetricGrid`, `ProfileLedgerMetaLine`, `ProfileSummaryCrossTabs`, `ProfileTabHiddenNote`
- `PatientDemographicsWritePanel`
- `ClinicPanel`, `Badge`, `Button`

**Risk:** **Low**. This is mostly composing existing sub-components.

---

### 3. `PatientTimelineTab.tsx` — Timeline Tab Content

**Extract:** Lines 2432–2477 (Timeline tab section)

**Props:**
```ts
interface PatientTimelineTabProps {
  timelineState: TimelineLoadState;
  timelineModel: ReturnType<typeof buildTimelineDisplayModel> | null;
  timelineKindFilter: TimelineKindFilter;
  onKindFilterChange: (filter: TimelineKindFilter) => void;
  onRefresh: () => void;
  onRowClick: (sourceTab: TimelineSourceTab, hint?: TimelineNavigateHint) => void;
}
```

**State/Effects:** None — delegates to `PatientTimeline` and `ClinicEmptyState`/`ClinicLoadingSkeleton`/`ProfileReadonlyError`.

**Imports:**
- `PatientTimeline`, `ProfileTabHiddenNote`, `ProfileReadonlyError`
- `ClinicEmptyState`, `ClinicLoadingSkeleton`
- Timeline UI copy constants

**Risk:** **Low**. Pure composition of existing components.

---

### 4. `PatientAppointmentsTab.tsx` — Appointments Tab Content

**Extract:** Lines 2479–2757 (Appointments tab with filters + appointment cards)

**Props:**
```ts
interface PatientAppointmentsTabProps {
  apptState: ApptLoadState;
  filteredAppts: ScheduleAppointmentItem[];
  groupedAppts: Map<string, ScheduleAppointmentItem[]>;
  rangeHeading: string;
  rangePreset: PatientApptRangePreset;
  apptTimeDirection: PatientApptTimeDirection;
  apptStatusFilter: number | null;
  apptRoomFilter: number | null;
  apptProviderFilter: number | null;
  apptRoomsInRange: number[];
  apptProviderOptions: readonly { docId: number; label: string }[];
  onPresetChange: (preset: PatientApptRangePreset) => void;
  onTimeDirectionChange: (dir: PatientApptTimeDirection) => void;
  onStatusFilterChange: (code: number | null) => void;
  onRoomFilterChange: (room: number | null) => void;
  onProviderFilterChange: (docId: number | null) => void;
  onRefresh: () => void;
  doctorLabels: ReadonlyMap<string, string>;
  procedureMaps: ProcedureReferenceMaps;
  roomMap: RoomLabelMap;
  onOpenScheduleAtDate?: (dateIso: string) => void;
}
```

**State/Effects:** None — all filter state, grouping, and derived values stay in `PatientProfilePanel`. This component is purely presentational with callbacks for filter changes.

**Imports:**
- `patient-appointments-display.js` helpers (`patientApptFormatDuration`, `patientApptRowMeta`, `patientApptStatusBadgeVariant`, `patientApptStatusLabel`, `patientApptStatusSemanticLabel`, `patientApptRangeCountLabel`)
- `patient-appointments-range.js` (`PatientApptRangePreset`)
- `groupAppointmentsByDate` (move from parent)
- `formatApptDayHeading` (move from parent)
- `Card`, `CardBody`, `CardHeader`, `Badge`, `Button`
- All appointment UI copy constants

**Risk:** **Medium**. Large JSX block with many filter buttons and nested maps. However, all state stays in parent, so extraction is safe.

---

### 5. `PatientMedicalTab.tsx` — Medical Tab Content

**Extract:** Lines 2759–2793 (Medical tab section)

**Props:**
```ts
interface PatientMedicalTabProps {
  medState: MedLoadState;
  onRefresh: () => void;
}
```

**State/Effects:** None — delegates to `MedicalSummaryBody` and loading/error/empty states.

**Imports:**
- `MedicalSummaryBody` (already a sub-component, stays inline or extracted separately)
- `ProfileTabHiddenNote`, `ProfileReadonlyError`
- `ClinicEmptyState`, `ClinicLoadingSkeleton`
- Medical UI copy constants

**Risk:** **Low**. Simple conditional rendering.

---

### 6. `PatientTreatmentsTab.tsx` — Treatments Tab Content

**Extract:** Lines 2795–2846 (Treatments tab section)

**Props:**
```ts
interface PatientTreatmentsTabProps {
  txState: TxLoadState;
  doctorLabels: ReadonlyMap<string, string>;
  procedureMaps: ProcedureReferenceMaps;
  onRefresh: () => void;
}
```

**State/Effects:** None — delegates to `TreatmentsBody` (which has its own filter state).

**Imports:**
- `TreatmentsBody` (existing sub-component)
- `ProfileTabHiddenNote`, `ProfileReadonlyError`
- `ClinicEmptyState`, `ClinicLoadingSkeleton`
- Treatments UI copy constants

**Risk:** **Low**. Simple wrapper around existing `TreatmentsBody`.

---

### 7. `PatientChartTab.tsx` — Chart Tab Content

**Extract:** Lines 2848–2924 (Chart tab with tooth filter + body)

**Props:**
```ts
interface PatientChartTabProps {
  chartState: ChartLoadState;
  chartEntriesForDisplay: PatientChartEntry[];
  chartToothFilter: number | null;
  onToothFilterClear: () => void;
  onRefresh: () => void;
}
```

**State/Effects:** None — `chartToothFilter` state stays in parent; `ChartBody` has its own internal filter state.

**Imports:**
- `ChartBody` (existing sub-component)
- `timelineChartToothFilterLabel` from `patient-timeline-display.js`
- `ProfileTabHiddenNote`, `ProfileReadonlyError`
- `ClinicEmptyState`, `ClinicLoadingSkeleton`, `Button`
- Chart UI copy constants

**Risk:** **Low**. Straightforward conditional rendering.

---

### 8. `PatientLedgerTab.tsx` — Ledger Tab Content

**Extract:** Lines 2926–2978 (Ledger tab section)

**Props:**
```ts
interface PatientLedgerTabProps {
  ledgerState: LedgerLoadState;
  onRefresh: () => void;
}
```

**State/Effects:** None — delegates to `LedgerBody` (which has its own filter state).

**Imports:**
- `LedgerBody` (existing sub-component)
- `ProfileTabHiddenNote`, `ProfileReadonlyError`
- `ClinicEmptyState`, `ClinicLoadingSkeleton`
- Ledger UI copy constants

**Risk:** **Low**. Simple wrapper around existing `LedgerBody`.

---

## What Stays in PatientProfilePanel.tsx

### State (remains in parent)

| State Variable | Purpose | Why Stay |
|---|---|---|
| `state` (LoadState) | Profile fetch lifecycle | Central orchestrator |
| `retryNonce` | Profile retry trigger | Parent-level coordination |
| `requestSeq` | Profile request sequencing | Parent-level coordination |
| `activeTab` | Tab selection | Drives which tab is rendered + lazy fetches |
| `apptState`, `apptRefreshNonce`, `apptRequestSeq` | Appointment fetch | Lazy-loaded per tab |
| `medState`, `medRefreshNonce`, `medRequestSeq` | Medical fetch | Lazy-loaded per tab |
| `txState`, `txRefreshNonce`, `txRequestSeq` | Treatments fetch | Lazy-loaded per tab |
| `chartState`, `chartRefreshNonce`, `chartRequestSeq` | Chart fetch | Lazy-loaded per tab |
| `ledgerState`, `ledgerRefreshNonce`, `ledgerRequestSeq` | Ledger fetch | Lazy-loaded per tab |
| `timelineState`, `timelineRefreshNonce`, `timelineRequestSeq` | Timeline fetch | Lazy-loaded per tab |
| `timelineKindFilter` | Timeline kind filter | Shared between tab and `handleTimelineRowClick` |
| `chartToothFilter` | Cross-tab chart tooth filter | Set from timeline, read in chart tab |
| `changePatientSearchOpen` | Change-patient search toggle | Parent UI control |
| `lastLoadedAt`, `touchLastLoadedAt` | Freshness timestamp | Used in ProfileClinicHero |
| `rangePreset`, `apptRange` | Appointment date range | Drives fetch + display |
| `apptTimeDirection`, `apptStatusFilter`, `apptRoomFilter`, `apptProviderFilter` | Appointment filters | Parent-level filter state |
| `summaryAppt/Med/Tx/Chart/Ledger` | Summary prefetch states | Lazy-loaded for summary tab |
| `summaryRefreshNonce`, `summaryRequestSeq` | Summary refresh trigger | Parent-level coordination |
| `roomMap` | Room labels map | Fetched once, used in multiple tabs |
| `doctorLabels` | Doctor ID→label map | Hook result, used across all tabs |
| `procedureMaps` | Procedure code→label maps | Hook result, used across all tabs |

### Effects (remain in parent)

- Profile fetch effect (lines 1667–1706)
- Summary prefetches effect (lines 1708–1830)
- Appointments fetch effect (lines 1832–1871)
- Medical fetch effect (lines 1873–1912)
- Treatments fetch effect (lines 1914–1958)
- Chart fetch effect (lines 1960–2004)
- Ledger fetch effect (lines 2006–2050)
- Timeline fetch effect (lines 2052–2107)
- Patient reset effect (lines 2109–2127)
- Default tab effect (lines 2129–2133)
- Room map effect (lines 1577–1602)

### Derived Values (remain in parent)

- `activeLabel`
- `filteredAppts`
- `apptRoomsInRange`
- `apptProviderOptions`
- `groupedAppts`
- `rangeHeading`
- `timelineModel`
- `chartEntriesForDisplay`
- `summaryPrefetches`

### Callbacks (remain in parent)

- `handleTimelineRowClick` — navigates tabs + sets chartToothFilter
- `refreshOpenRecord` — refreshes the active tab's data
- `applyRangePreset` — sets range preset + updates apptRange

---

## Utility Functions & Types to Relocate

| Item | Current Location | Destination | Reason |
|---|---|---|---|
| `ProfileTab` type | L257 | Shared types file or keep in parent | Used everywhere |
| `PROFILE_TAB_ORDER` | L317 | Shared constants or `PatientProfileTabs.tsx` | Used by tab bar + summary cross-tabs |
| `PROFILE_TAB_DESCRIPTIONS` | L327 | Shared constants or `PatientProfileTabs.tsx` | Used by tab bar |
| `formatApptDayHeading` | L337 | `PatientAppointmentsTab.tsx` | Only used in appointments tab |
| `profileFriendlyPillClass` | L350 | `PatientProfilePanel.tsx` | Only used in ProfileClinicHero |
| `ProfileTabHiddenNote` | L363 | `PatientProfilePanel.tsx` or shared utils | Used across all tabs |
| `formatProfileLastRefreshed` | L390 | `PatientProfilePanel.tsx` | Only used in ProfileClinicHero |
| `ProfileReadonlyError` | L398 | `PatientProfilePanel.tsx` or shared utils | Used in all tab error states |
| `SUMMARY_CROSS_TABS` | L409 | `PatientProfilePanel.tsx` or `PatientSummaryTab.tsx` | Summary tab only |
| `summaryCrossTabCount` | L418 | `PatientProfilePanel.tsx` or `PatientSummaryTab.tsx` | Summary tab only |
| `ProfileClinicHero` | L438 | `PatientProfilePanel.tsx` or `PatientProfileHeader.tsx` | Header component |
| `ProfileWorkflowStrip` | L552 | `PatientProfilePanel.tsx` | Used in parent render |
| `ProfileLedgerMetaLine` | L572 | `PatientSummaryTab.tsx` | Summary tab only |
| `ProfileSummaryCrossTabs` | L594 | `PatientSummaryTab.tsx` | Summary tab only |
| `safePatient*Error` (×7) | L623–834 | Shared error utils file (`patient-profile-errors.ts`) | Pure functions, no JSX deps |
| `formatApptRangeHeading` | L836 | `PatientAppointmentsTab.tsx` | Appointments tab only |
| `TreatmentsBody` | L848 | `PatientTreatmentsTab.tsx` | Treatments tab only |
| `ChartBody` | L1057 | `PatientChartTab.tsx` | Chart tab only |
| `ProfileSummaryMetricGrid` | L1197 | `PatientSummaryTab.tsx` | Summary tab only |
| `LedgerBody` | L1222 | `PatientLedgerTab.tsx` | Ledger tab only |
| `MedicalSummaryBody` | L1367 | `PatientMedicalTab.tsx` | Medical tab only |
| `groupAppointmentsByDate` | L1484 | `PatientAppointmentsTab.tsx` | Appointments tab only |
| `PatientPageSearchBlock` | L1499 | `PatientProfilePanel.tsx` | Used in parent render |

---

## Import Dependencies per Extracted File

### PatientProfileTabs.tsx
```ts
import { ProfileTab } from "./PatientProfilePanel";  // or shared types
import { Button } from "@microdent/ui";
import { PROFILE_TAB_ORDER } from "./patient-profile-constants";
import { PROFILE_TAB_DESCRIPTIONS } from "./patient-profile-constants";
```

### PatientSummaryTab.tsx
```ts
import { Badge, Button } from "@microdent/ui";
import { ClinicPanel } from "./clinic-panel";
import { PatientSummaryMiniCards } from "./patient-summary-mini-cards";
import { PatientDemographicsWritePanel } from "./PatientDemographicsWritePanel";
import { ProfileSummaryMetricGrid, ProfileLedgerMetaLine, ProfileSummaryCrossTabs, ProfileTabHiddenNote } from "./PatientProfilePanel";
// Or: these moved to the same file
import type { ProfileTab } from "./PatientProfilePanel";
import type { PatientWorkspacePrefetches } from "./patient-workspace-intelligence";
// UI copy constants from read-only-ui-copy.js
```

### PatientTimelineTab.tsx
```ts
import { Button } from "@microdent/ui";
import { PatientTimeline } from "./patient-timeline";
import { ClinicEmptyState } from "./clinic-empty-state";
import { ClinicLoadingSkeleton } from "./clinic-loading-skeleton";
import { ProfileTabHiddenNote, ProfileReadonlyError } from "./PatientProfilePanel";
import type { TimelineLoadState, TimelineKindFilter, TimelineSourceTab, TimelineNavigateHint } from "./patient-timeline-display";
// UI copy constants
```

### PatientAppointmentsTab.tsx
```ts
import { Badge, Button, Card, CardBody, CardHeader } from "@microdent/ui";
import { ClinicEmptyState } from "./clinic-empty-state";
import { ClinicLoadingSkeleton } from "./clinic-loading-skeleton";
import { ProfileReadonlyError } from "./PatientProfilePanel";
import { patientApptFormatDuration, patientApptRowMeta, patientApptStatusBadgeVariant, patientApptStatusLabel, patientApptStatusSemanticLabel, patientApptRangeCountLabel } from "./patient-appointments-display";
import { patientApptRangeForPreset, type PatientApptRangePreset } from "./patient-appointments-range";
import type { PatientApptTimeDirection } from "./patient-appointments-display";
import type { ScheduleAppointmentItem } from "@microdent/contracts";
// UI copy constants
// formatApptDayHeading + groupAppointmentsByDate (moved here)
```

### PatientMedicalTab.tsx
```ts
import { ClinicEmptyState } from "./clinic-empty-state";
import { ClinicLoadingSkeleton } from "./clinic-loading-skeleton";
import { ProfileTabHiddenNote, ProfileReadonlyError, MedicalSummaryBody } from "./PatientProfilePanel";
import type { MedLoadState } from "./PatientProfilePanel";
// UI copy constants
```

### PatientTreatmentsTab.tsx
```ts
import { Button } from "@microdent/ui";
import { ClinicEmptyState } from "./clinic-empty-state";
import { ClinicLoadingSkeleton } from "./clinic-loading-skeleton";
import { ProfileTabHiddenNote, ProfileReadonlyError, TreatmentsBody } from "./PatientProfilePanel";
import type { TxLoadState } from "./PatientProfilePanel";
import type { ProcedureReferenceMaps } from "./procedure-reference";
// UI copy constants
```

### PatientChartTab.tsx
```ts
import { Button } from "@microdent/ui";
import { ClinicEmptyState } from "./clinic-empty-state";
import { ClinicLoadingSkeleton } from "./clinic-loading-skeleton";
import { ProfileTabHiddenNote, ProfileReadonlyError, ChartBody } from "./PatientProfilePanel";
import { timelineChartToothFilterLabel } from "./patient-timeline-display";
import type { ChartLoadState } from "./PatientProfilePanel";
import type { PatientChartEntry } from "@microdent/contracts";
// UI copy constants
```

### PatientLedgerTab.tsx
```ts
import { Button } from "@microdent/ui";
import { ClinicEmptyState } from "./clinic-empty-state";
import { ClinicLoadingSkeleton } from "./clinic-loading-skeleton";
import { ProfileTabHiddenNote, ProfileReadonlyError, LedgerBody } from "./PatientProfilePanel";
import type { LedgerLoadState } from "./PatientProfilePanel";
import type { LedgerEntryV1 } from "@microdent/contracts";
// UI copy constants
```

---

## Risk Assessment

### Low Risk (extract first)

| Component | Reason |
|---|---|
| **PatientProfileTabs** | Pure UI, no state, no side effects, no data dependencies |
| **PatientTimelineTab** | Pure composition, delegates to PatientTimeline, no local state |
| **PatientMedicalTab** | Simple conditional rendering, delegates to MedicalSummaryBody |
| **PatientTreatmentsTab** | Simple wrapper, delegates to TreatmentsBody (which owns its own state) |
| **PatientChartTab** | Simple wrapper, delegates to ChartBody (which owns its own state) |
| **PatientLedgerTab** | Simple wrapper, delegates to LedgerBody (which owns its own state) |

### Medium Risk (extract second)

| Component | Reason |
|---|---|
| **PatientSummaryTab** | Composes many sub-components, includes sandbox demographics panel with its own fetch/callback |
| **PatientAppointmentsTab** | Largest extraction (~280 lines), many filter callback props, but all state stays in parent |

### Higher Risk (refactor last)

| Item | Reason |
|---|---|
| **PatientProfilePanel (parent)** | After extractions, the main render shrinks from ~770 lines to ~200 lines. The data fetching logic (~450 lines) remains. Consider a future `usePatientData` hook extraction as a separate phase. |

---

## Recommended Order of Extraction

### Phase 1: Leaf Tab Components (Lowest Risk)

1. **PatientLedgerTab** — simplest wrapper (53 lines of render)
2. **PatientMedicalTab** — simple wrapper (35 lines of render)
3. **PatientChartTab** — simple wrapper with one extra prop (77 lines of render)
4. **PatientTreatmentsTab** — simple wrapper (52 lines of render)
5. **PatientTimelineTab** — simple composition (46 lines of render)

### Phase 2: Composite Components

6. **PatientProfileTabs** — pure presentational tab bar (48 lines)
7. **PatientSummaryTab** — composite with multiple sub-components (63 lines)
8. **PatientAppointmentsTab** — largest tab, but all state stays in parent (279 lines)

### Phase 3: Utility Extraction

9. Move `safePatient*Error` functions to `patient-profile-errors.ts`
10. Move `TreatmentsBody`, `ChartBody`, `LedgerBody`, `MedicalSummaryBody` to their respective tab files
11. Move `ProfileSummaryMetricGrid`, `ProfileLedgerMetaLine`, `ProfileSummaryCrossTabs` to `PatientSummaryTab.tsx`
12. Move `groupAppointmentsByDate`, `formatApptDayHeading`, `formatApptRangeHeading` to `PatientAppointmentsTab.tsx`

### Phase 4: Parent Cleanup

13. Reduce `PatientProfilePanel` render to tab switcher delegating to extracted components
14. (Future) Consider `usePatientData` custom hook for data fetching effects

---

## Expected End State

### PatientProfilePanel.tsx (after extraction)
- **Lines:** ~500 (down from 2986)
- **Contains:** Props, types, state declarations, data fetching effects, derived values, callbacks, and a tab switcher that delegates to extracted components
- **Responsibility:** Data orchestration + top-level layout

### New Files

| File | ~Lines | Responsibility |
|---|---|---|
| `PatientProfileTabs.tsx` | ~60 | Pill-style tab bar |
| `PatientSummaryTab.tsx` | ~120 | Summary tab with mini-cards, metrics, cross-tab links, sandbox |
| `PatientTimelineTab.tsx` | ~60 | Timeline tab with PatientTimeline component |
| `PatientAppointmentsTab.tsx` | ~300 | Appointments tab with filters, presets, grouped appointment cards |
| `PatientMedicalTab.tsx` | ~140 | Medical tab with MedicalSummaryBody + error/empty states |
| `PatientTreatmentsTab.tsx` | ~60 | Treatments tab wrapper + TreatmentsBody |
| `PatientChartTab.tsx` | ~90 | Chart tab wrapper + ChartBody + tooth filter |
| `PatientLedgerTab.tsx` | ~60 | Ledger tab wrapper + LedgerBody |
| `patient-profile-errors.ts` | ~200 | All safePatient*Error functions |

### Shared Sub-components (stay in PatientProfilePanel.tsx or move to utils)

| Component | Suggested Location |
|---|---|
| `ProfileTabHiddenNote` | Keep in parent or move to shared utils |
| `ProfileReadonlyError` | Keep in parent or move to shared utils |
| `ProfileClinicHero` | Keep in parent (header, not tab-specific) |
| `ProfileWorkflowStrip` | Keep in parent (header strip, not tab-specific) |
| `PatientPageSearchBlock` | Keep in parent (used in two places) |
| `ProfileSummaryMetricGrid` | Move to `PatientSummaryTab.tsx` |
| `ProfileLedgerMetaLine` | Move to `PatientSummaryTab.tsx` |
| `ProfileSummaryCrossTabs` | Move to `PatientSummaryTab.tsx` |
| `TreatmentsBody` | Move to `PatientTreatmentsTab.tsx` |
| `ChartBody` | Move to `PatientChartTab.tsx` |
| `LedgerBody` | Move to `PatientLedgerTab.tsx` |
| `MedicalSummaryBody` | Move to `PatientMedicalTab.tsx` |

---

## Key Design Decisions

### 1. State Stays in Parent
All `useState`, `useEffect`, `useMemo`, `useRef`, and `useCallback` calls remain in `PatientProfilePanel`. Extracted components are **controlled components** that receive data via props and communicate changes via callbacks. This avoids:
- Race conditions from duplicate fetch effects
- State synchronization bugs
- Lifting state back up later

### 2. LoadState Types Stay in Parent
All load state discriminated unions (`LoadState`, `ApptLoadState`, `MedLoadState`, etc.) remain in `PatientProfilePanel.tsx`. Extracted tab components receive the full state object and handle rendering conditionally. This keeps the fetch logic centralized.

### 3. Body Components Move with Their Tabs
`TreatmentsBody`, `ChartBody`, `LedgerBody`, and `MedicalSummaryBody` are currently defined inside `PatientProfilePanel.tsx`. They should be moved to their respective tab files since:
- They have their own internal filter state (TreatmentsBody, ChartBody, LedgerBody)
- They are only rendered from one tab
- Moving them eliminates ~500 lines from the parent

### 4. Cross-Tab State: chartToothFilter
The `chartToothFilter` state is set from the timeline tab (`handleTimelineRowClick`) and read in the chart tab. This is the **only** cross-tab state coupling. It stays in `PatientProfilePanel` and is passed as a prop to `PatientChartTab`.

### 5. Utility Function Placement
- `safePatient*Error` functions are pure and can be moved to a shared file immediately
- `groupAppointmentsByDate` is only used by the appointments tab → move there
- `formatApptDayHeading` is only used by the appointments tab → move there
- `formatApptRangeHeading` is only used by the appointments tab → move there

---

## Migration Checklist per Phase

Each extraction step should:
1. Create the new file with the extracted component
2. Export it from the new file
3. Import it back into `PatientProfilePanel.tsx`
4. Replace inline JSX with the component call
5. Run type check (`tsc --noEmit`)
6. Run tests (`vitest run patient-profile-panel`)
7. Commit before proceeding to next step
