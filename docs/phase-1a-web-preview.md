# Phase 1A — Web preview (`apps/web`)

## What was built

- **`apps/web`** (`@microdent/web`): a **Vite 5** + **React 18.3** entry that mounts **`AppShell`** from `@microdent/app`.
- **`src/main.tsx`** imports styles in the required order:
  1. `@microdent/ui/tokens.css`
  2. `@microdent/ui/components.css`
  3. `@microdent/app/app-shell.css`
- **Vite** binds **`127.0.0.1`** for **`dev`** and **`preview`** (not `0.0.0.0`), consistent with local-only bridge guidance.
- **`predev` / `prebuild`**: run **`@microdent/ui`** and **`@microdent/app`** builds so workspace `dist/` exports resolve.

## What was intentionally not built

- No **bridge-client**, TanStack Query, React Router, or real **DATA_ROOT** / DBF access.
- No production hosting, CI, or cloud deploy wiring.

## Dependencies (why)

| Package | Why | Install scripts | Maintained |
|---------|-----|-----------------|------------|
| **vite** `5.4.21` | Fast local dev server + production bundle for the preview app. | Vite’s published tarball is prebuilt; **no repo-added lifecycle scripts**. | Yes (vitejs). |
| **@vitejs/plugin-react** `4.3.4` | Official JSX/Refresh integration for Vite. | Same as above. | Yes (vitejs). |
| **react** / **react-dom** `18.3.1` | Align with `packages/ui` / `packages/app`. | Standard React artifacts. | Yes (Meta). |
| **typescript** | Type-check Vite config + entry. | None. | Yes. |

Smaller alternative: opening static HTML without Vite would not give a practical TSX + workspace monorepo DX; Vite is the minimal standard tool for this slice.

## Security / audit

After adding Vite, re-run **`pnpm audit`**. Any **critical/high** finding should be addressed or documented explicitly (same policy as the rest of the repo). Transitive **moderate** dev-only issues may remain until a coordinated Vitest/Vite upgrade.
