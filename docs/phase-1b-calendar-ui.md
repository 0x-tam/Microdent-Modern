# Phase 1b — Calendar / schedule (UI)

## What was built

- **`SchedulePanel`** in `@microdent/app`: shown when the user selects **Schedule** in the sidebar (replacing the generic module placeholder for that tab only).
- **Data loading** uses **`createBridgeClient`** → **`getScheduleRooms()`** and **`getScheduleAppointments({ from, to, room? })`** (see [phase-1b-calendar-backend.md](phase-1b-calendar-backend.md)). Fetches run **only** when:
  - the Schedule tab is active (`isActive`), and
  - **`bridgePhase === "connected"`** (after a successful **`GET /health`**), and
  - **`bridgeBaseUrl`** is set.
- When the tab is inactive or the bridge is not connected, lists are cleared and **no** schedule requests are made.
- **Rooms** are loaded best-effort: if **`getScheduleRooms`** fails (e.g. missing `SC_ROOM.DBF`), appointments may still load; room labels fall back to **“Room {n}”**.
- **Default range**: **Week** view = **Monday–Sunday (local)** containing today, always **7 inclusive days** (within the backend **14-day** cap). **Day** view = **today** (single day).
- **Controls**:
  - **Week** / **Day** toggles (resets range appropriately).
  - **← Day / Week** and **Day / Week →** move by one day or seven days.
  - **Today** jumps to the current week (week mode) or today (day mode).
  - **Room** `<select>` when rooms are returned (optional **`room`** query).
  - **Refresh** bumps an internal counter to re-run both requests for the same range.
- **Layout**: **Day list grouped by calendar date, then by room**, with appointments sorted by **`time`** then **`id`**. This stays readable without a heavy grid or extra libraries.
- **Displayed fields** (from the appointment DTO only): **time**, **duration** (computed minutes from **`durationSlots`** × **`periodMinutes ?? 30`**), **room** (via section title from room list), **status** (friendly label for codes 0–5, else **“Status n”**), **doctor** when **`docId !== 0`**, **Patient ID** when **`patId !== "0"`**, **proc class**, **Missed** badge, **Note** badge when **`hasComment`** (no memo text).
- **Privacy line** under the toolbar: *Read-only schedule. Notes and phone numbers are hidden in this preview.*
- **Schedule** main lede updated to stress read-only, no names on this screen.

## What was intentionally not built

- No **create / edit / drag / delete** or any write APIs.
- No **patient search** or **patient profile** from this panel.
- No **`PAT_NAME`**, **`TELEPHONE`**, **`COMMENT`** body, **`CASENUM`**, or raw row JSON in the UI.
- No **TanStack Query**, **React Router**, **date-picker libraries**, charts, or new icon packages.

## States

1. **Bridge offline or checking** — short message; toolbar controls disabled; no fetch.
2. **Loading** — “Loading schedule…” while requests are in flight.
3. **Error** — generic failure copy; **Refresh** to retry.
4. **Empty** — **`EmptyState`** when the range/filter returns zero appointments (not an error).

The UI never requests a range **wider than 14 days**; week mode uses **7** days.

## Tests (`packages/app/src/schedule-panel.test.tsx`)

- **Offline**: no `fetch` calls; copy mentions clinic service.
- **Success path**: synthetic rooms + appointments; shows time, patient id label, room label, status/note.
- **Failed load**: appointments HTTP 500 shows the generic error line.
- **Static guard**: full document text must not include the tokens **`PAT_NAME`**, **`TELEPHONE`**, or **`COMMENT`** as words (UI copy uses “Notes”, not memo field names).
- **Room filter** change triggers an appointments URL with **`room=`**.
- **Refresh** triggers additional fetches.

## Running manually

Same as backend: set **`DATA_ROOT`** on the bridge to your **read-only copy**, start the bridge, **`pnpm preview:web`**, open **Schedule**, wait for **Connected**, then use **Week/Day**, navigation, **Room**, and **Refresh**.

## UX / semantics uncertainty

- **Status labels** for codes **0–5** follow the Python replacement script; production data may use other integers — shown as **“Status n”**.
- **Monday-first week** is a common clinic default but may not match every legacy site.
- **String `TIME`** values are shown as returned (not re-parsed to locale clock).
- **`periodMinutes`** defaults to **30** only for the **duration display** when null/zero; the API still returns `null`.
