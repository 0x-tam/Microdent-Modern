# @microdent/ui

Design tokens (CSS variables) and hand-built React primitives for the Microdent Modern clinic UI.

## Why no Tailwind (for now)

Tailwind adds PostCSS, a large class surface, and another supply-chain surface. This package uses **semantic CSS variables** (`tokens.css`) plus a single **`components.css`** so colors stay named (`--ui-primary-600`) instead of scattering raw hex in JSX. A future band can map the same variables into a Tailwind theme if the team standardizes on Tailwind.

## Setup in an app

1. Import tokens, then component styles (order matters):

```tsx
import "@microdent/ui/tokens.css";
import "@microdent/ui/components.css";
```

2. Use components from `@microdent/ui`:

```tsx
import { Button, Card, CardBody, CardHeader, CardTitle } from "@microdent/ui";
```

## Build

```bash
pnpm --filter @microdent/ui run build
```

Emits `dist/*.js` + `dist/*.d.ts` and copies `tokens.css` / `components.css` into `dist/`.

## Peer dependencies

React **18.3.x** (`react`, `react-dom`).
