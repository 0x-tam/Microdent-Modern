# Phase 1b — Read-only UI polish

## Goal

Make the web preview feel like a cohesive **read-only clinic viewer** (not a prototype): consistent copy, empty/offline/error states, privacy wording, patient tab order, and no sample clinic narrative on primary screens.

## Shared copy module

**`packages/app/src/read-only-ui-copy.ts`** — single source for:

- Shell labels (`Read-only viewer`, `Read-only mode`, banner body)
- Clinic service offline / checking messages
- Patient tab ledes (Summary, Appointments, Medical, Treatments, Chart, Ledger)
- Module placeholder empty states
- Truncated-list and sensitive-medical banners

Import from here when adding new surfaces so wording stays aligned.

## Screens reviewed

| Area | Module / component | Notes |
| --- | --- | --- |
| Today | `today-dashboard.tsx` | Privacy lede, offline/checking copy, neutral reminders, quick actions titles |
| Patients | `PatientProfilePanel.tsx` | Tab order below; Summary holds profile card |
| Schedule | `SchedulePanel.tsx` | Privacy lede; `Note hidden` badge |
| Appointments | Patient **Appointments** tab | Range presets; shared offline empty state |
| Medical | Patient **Medical** tab | Sensitive banner uses read-only viewer wording |
| Treatments | Patient **Treatments** tab | Truncated banner via `TRUNCATED_LIST_BANNER` |
| Chart | Patient **Chart** tab | `GET /v1/patients/:id/chart`; display helpers in `patient-chart-display.ts` |
| Ledger | Patient **Ledger** tab | `GET /v1/patients/:id/ledger`; display helpers in `patient-ledger-display.ts` |
| Shell | `AppShell.tsx` | Banner, clinic label, module previews, Patients/Schedule ledes |

## Patient tab order

1. **Summary** — safe demographics (`ProfileSummaryCard`)
2. **Appointments**
3. **Medical**
4. **Treatments**
5. **Chart**
6. **Ledger**

**Payments** remains a disabled “Soon” tab (no write path). Default tab on load: **Summary**.

## Privacy / read-only wording

- Prefer **“read-only viewer”** over “preview” in user-facing chrome.
- Sensitive fields: **“hidden in this read-only viewer”** (banner + tab ledes).
- Forbidden DBF tokens must not appear in UI tests (`PAT_NAME`, `TELEPHONE`, `COMMENT`, memo bodies, `AMOUNT` / `SAMOUNT`, `raw row`, etc.) — see `patient-profile-panel.test.tsx`, `schedule-panel.test.tsx`, `today-dashboard.test.tsx`, `app-shell.test.tsx`.

## What stays dev-only

- **Fixture connection** and **Legacy catalog** on Today (aside, de-emphasized) — not clinic data.
- **Synthetic** names in unit tests only (e.g. `Demo Alpha` in search bar mocks).

## Verification

From repo root (Node 22.5+ if running full monorepo `pnpm test` including sqlite-mirror):

```bash
pnpm test --workspace=@microdent/app
pnpm build:web
```

Manual: connect bridge, open **Patients** → confirm **Summary** default, exercise each tab offline/empty/loaded, and scan Schedule + Today for consistent “Note hidden” / offline copy.

## Out of scope (unchanged)

- No new backend routes
- No writes / payments recording
- Sidebar modules **Dental Chart**, **Treatments**, **Payments**, etc. still route to `ModuleHome` placeholders except **Today**, **Patients**, **Schedule**
