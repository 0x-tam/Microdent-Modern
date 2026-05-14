# Phase 1A — Responsive app shell layout

## Goal

Make the **Microdent web preview** (`AppShell` + Today dashboard) feel comfortable on **laptop** widths, **large external monitors**, and **narrow browser windows**—without blowing up typography on small screens or leaving a thin strip of tiny content on ultrawide layouts.

## What changed

All layout work is in **`packages/app/src/app-shell.css`** (no new npm dependencies, no React structural changes).

### Fluid tokens (`:root`)

Custom properties drive gutters, sidebar width, main column cap, dashboard gap, and top-bar spacing:

| Token | Role |
|-------|------|
| `--app-gutter-x` | Horizontal padding for top bar, banner, main |
| `--app-main-pad-y` | Vertical padding for main canvas |
| `--app-sidebar-w` | Sidebar width (`clamp` + `vw`) |
| `--app-main-inner-max` | Max width of centered main column (`min(..., 100%)`) |
| `--app-dashboard-col-aside` | Right column width band for the Today grid |
| `--app-dashboard-gap` | Gap between primary and aside columns |
| `--app-topbar-gap` | Flex gap in the top bar |

**Breakpoints (CSS `@media`):**

- **Default / &lt; 1200px:** Slightly **compact** gutters, sidebar capped toward **~200px**, tighter top-bar gap.
- **`min-width: 1200px`:** **Comfortable** default — main inner cap **~1100px**, normal dashboard gap.
- **`min-width: 1600px`:** **Wide** screens — main inner cap **~1240px** so lines of text and cards do not stretch edge-to-edge on 27"+ panels.

### Regions

1. **Top bar** — `min-height`, brand, clinic label, and search input use **`clamp()`** for font size and control height; search flex basis uses **`min(280px, 42vw)`** so it shrinks in narrow windows.
2. **Sidebar** — Width follows **`--app-sidebar-w`**; nav button padding and label size scale down slightly on smaller viewports.
3. **Main** — Padding uses fluid tokens; **`.app-main__inner`** is centered with **`margin: 0 auto`** and **`max-width: var(--app-main-inner-max)`** so content stays readable on large monitors.
4. **Today dashboard** — CSS grid: primary + aside. **`@media (max-width: 1100px)`** stacks the **aside below** the primary column (replaces the older **880px** single breakpoint). Aside column width uses **`minmax(228px, min(300px, 28vw))`** so it does not dominate on medium widths.
5. **Appointment rows** — **`flex-wrap`** + **`row-gap`** so time / patient / badge can wrap without forcing horizontal page scroll; gaps and font sizes use **`clamp()`**.
6. **Module home** (non-Today) — **`max-width: min(720px, 100%)`** and fluid gaps / summary font.

### Preserved

- Semantic **CSS variables** from **`@microdent/ui/tokens.css`** (`--ui-space-*`, colors, radii, focus tokens).
- **`:focus-visible`** outlines on sidebar controls unchanged.
- Fixture panel table still uses **`overflow-x: auto`** for wide preview grids only inside the table shell.

## Screen sizes considered

| Context | Approx. viewport | Behavior |
|---------|------------------|----------|
| Narrow laptop / small window | &lt; **1100px** | Dashboard stacks; compact gutters / sidebar |
| Laptop | **1100px – 1199px** | Two-column dashboard when wide enough; compact tier tokens |
| Comfortable desktop | **1200px – 1599px** | Wider main cap (~1100px), standard spacing |
| Large / external monitor | **≥ 1600px** | Main content capped ~**1240px**, centered |

## Verification

From repo root: **`pnpm preview:web`**, resize the window and/or move between laptop display and an external monitor. **`pnpm test`** and **`pnpm build:web`** should pass (layout is CSS-only).

## Dependencies

**None added.**
