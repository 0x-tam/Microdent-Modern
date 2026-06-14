# Accessibility Audit Checklist

Scope: WCAG 2.2 AA-oriented local audit for the accessibility and post-write UI slice in `docs/ROADMAP-CONTINUATION-PLAN.md`.

Date: 2026-06-06

## Screens Reviewed

| Area | Evidence | Status |
| --- | --- | --- |
| AppShell navigation | Sidebar buttons expose destination and module context with `aria-label`; active module keeps `aria-current`; main content keeps a labelled `main` landmark. | Pass |
| AppShell status | Clinic service dot remains a polite `role="status"` with an explicit label. Refresh control now exposes "Refresh clinic service status". | Pass |
| Today | Post-write local-copy risk appears as a polite status notice before Today/Schedule data is relied on. Existing schedule status, retry, and stale mirror notes remain operator-safe. | Pass |
| Patients | Change-patient toggle now declares `aria-expanded` and `aria-controls`. Post-write local-copy risk appears in the loaded patient view after sandbox demographics commits. | Pass |
| Schedule | Date navigation buttons have explicit labels; filter toggle declares expanded state and controlled panel; appointment detail toggles name the patient and controlled panel. Post-write local-copy risk remains visible after commit-triggered refresh. | Pass |
| Settings | Local-copy refresh action is tied to a live status region; restart success/failure is announced politely; post-write local-copy risk is visible until refresh succeeds. | Pass |
| Write panels | Existing form controls retain explicit labels; success copy still warns that the local copy may lag; page-level warning prevents successful writes from hiding stale-copy risk. | Pass |
| Dental chart visuals | No chart rendering, odontogram, tooth layout, or chart CSS was changed in this slice. | Pass |

## Manual Keyboard Checklist

- Tab order starts in the sidebar, reaches search, page actions, filters, write panels, and Settings quick fixes without trapping focus.
- `Enter` and `Space` activate buttons and patient quick cards where handlers are present.
- Schedule arrow-key shortcuts are ignored while focus is inside inputs/selects.
- Schedule filter toggle announces expanded/collapsed state and returns predictable focus.
- Appointment write details announce whether details are shown or hidden and identify the patient context.
- Patient change-search control announces expanded/collapsed state and points to the search region.
- Settings refresh/restart result copy is announced through live status regions.

## Screen Reader Checklist

- Landmark path: banner, navigation, main, regional headings.
- Status path: clinic service status, schedule summary, patient loaded time, Settings quick-fix results, post-write local-copy risk.
- Form path: patient search, appointment status, appointment move, appointment create, demographics write fields, Schedule room/status/provider filters.
- Error path: offline and failed states use `role="alert"` where operator action is needed.

## Deferred Audit Items

- Run a full automated axe/Playwright audit once a browser-based harness is added for the desktop shell.
- Verify color contrast on a calibrated Windows clinic display; current CSS was not materially changed in this slice.
- Validate with NVDA on Windows during the field execution track.
