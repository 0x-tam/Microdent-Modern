# Phase 1A — UI foundation (Band A5)

## What was built

- **`packages/ui`**: React **18.3.x** primitives with **no app shell**, **no React Router**, **no TanStack Query**, **no bridge-client** wiring.
- **Design tokens (`src/tokens.css` → `dist/tokens.css`)**: semantic variables aligned to [design-system.md](design-system.md) §2–4 (surfaces, text, brand teal, semantic success/warning/danger/info, shadows, typography stacks, 4px spacing scale, radii, focus ring, motion). **Light mode is primary**; **`[data-theme="dark"]`** block holds an early dark remap so a later phase can opt in without redesigning components.
- **Component styles (`src/components.css` → `dist/components.css`)**: all styling references **`var(--ui-*)`** — no raw hex in TSX.
- **Primitives**:
  - **Button** — variants `primary`, `secondary`, `ghost`, `danger`, `danger-outline`; sizes `default` | `compact`; default **`type="button"`**; **`ui-focusable`** for `:focus-visible` ring.
  - **Card** — `Card`, `CardHeader`, `CardTitle`, `CardBody` (`flush` option), `CardFooter`.
  - **Table** — `Table` (`striped`, `compact`), `TableHead`, `TableBody`, `TableRow`, `TableHeaderCell` (`scope="col"`), `TableCell` (`numeric` for tabular right alignment).
  - **Badge** — variants + **visible dot** + required **`semanticLabel`** for `aria-label` (not color-only).
  - **Input** — `label`, `hint`, `error`, `inputId`; `aria-invalid` / `aria-describedby` wiring.
  - **EmptyState** — title, description, optional actions slot; `role="region"` with `aria-label`.
  - **ReadOnlyBanner** — `role="status"`, `aria-live="polite"`, info styling per read-only UX callouts.
  - **LoadingState** — `role="status"`, `aria-busy`, skeleton bars (CSS keyframes).
  - **ErrorState** — `role="alert"`, title + message + optional actions; leading “!” marker via CSS `::before` (decorative pattern in addition to color).

## Mapping to the design system

| Design system | Implementation |
|---------------|------------------|
| §2 palette | `--ui-bg-*`, `--ui-text-*`, `--ui-primary-*`, `--ui-success-*`, … |
| §3 typography | `--ui-font-sans`, `--ui-font-mono`; heading/body sizes in CSS per component |
| §4 spacing / radius | `--ui-space-*`, `--ui-radius-*` |
| §2 extended | `--ui-bg-canvas-wash`, `--ui-bg-rail`, `--ui-bg-shell-fade`, `--ui-primary-700`, `--ui-gradient-shell`, `--ui-gradient-topbar`, `--ui-shadow-card-hover` (shell polish; see [phase-1a-visual-polish.md](phase-1a-visual-polish.md)) |
| §6 buttons | `.ui-btn--*` variants, hover transitions |
| §7 cards | `.ui-card*` structure |
| §8 tables | sticky header row, subtle borders, optional zebra |

## Tests

`src/primitives.test.tsx` uses **`react-dom/server`** `renderToStaticMarkup` (no extra testing-library dependency) to assert roles, ARIA wiring, and class hooks.

## What was intentionally not built

- App shell, sidebar, top bar, routing, data fetching.
- Icon library (Unicode only where needed, e.g. read-only banner).
- Scheduler / chart modules.

## Dependencies added (supply-chain note)

| Package | Why | Install scripts | Maintained | Alternatives considered |
|---------|-----|-------------------|------------|-------------------------|
| `react` / `react-dom` **18.3.1** (dev + peer) | UI components require React. | Standard React packages publish prebuilt artifacts; **no custom postinstall** in this repo. | Yes (Meta). | None for React-based `packages/ui`. |
| `@types/react` / `@types/react-dom` | TypeScript typings. | None. | DefinitelyTyped. | N/A |
| `typescript` | Build / types. | None. | Yes. | Already used in sibling packages. |
| `vitest` | Same test runner as bridge packages. | None. | Yes. | **No `@testing-library/*` added** — static markup tests avoid extra deps. |

**Not added:** Tailwind, shadcn, icon packs, TanStack Query, React Router.

## Security audit (local `pnpm audit`)

- A **critical** Vitest advisory (GHSA-9crc-q9x8-hgqq, dev API misuse) affected Vitest **&lt; 2.1.9**. All workspaces using Vitest were bumped to **2.1.9+**.
- **Moderate** findings remain transitive via **Vitest → Vite → esbuild** (dev-only). They concern the **Vite dev server**, not production bridge code. Upgrading to patched Vite 6.x would ripple across Vitest; tracked for a later hygiene pass—not suppressed silently.
