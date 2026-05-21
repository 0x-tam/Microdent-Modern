# Clinic Visual Identity — Internal Spec

**Baseline:** command-center layout rebuild (`e862976`).  
**Scope:** light mode, teal primary, color + surface hierarchy only — no layout DOM changes.

## Modern clinic OS

A calm, trustworthy desktop workspace for dental staff: **teal-forward identity**, warm clinical canvas (not stark white admin), and **semantic color** that signals connection state and operational urgency without decoration noise. Structure stays command-center (stat strip, board/ops panels, data lists); this pass adds life through palette, elevation, and tone.

## Palette

| Role | Token | Intent |
|------|-------|--------|
| Clinical canvas | `--ui-bg-clinical`, `--ui-bg-clinical-wash` | Soft mint/teal wash behind pages and empty states |
| Brand / primary | `--ui-primary-*` | Actions, active nav, emphasis stats |
| Connection / info | `--ui-accent-cyan`, `--ui-accent-blue` | Read-only, mirror active, informational chips |
| Neutrals | `--ui-bg-surface`, `--ui-bg-subtle`, `--ui-text-*` | Cards, rows, body copy |

## Typography steps

| Token | Use |
|-------|-----|
| `--ui-text-display` | Patient name, page hero titles |
| `--ui-text-section` | Panel titles, section headers |
| `--ui-text-body` | Default reading size (16px) |

App bridge: `--app-text-display`, `--app-text-section` map from UI tokens in `shell-layout.css`.

## Surface tiers

1. **Canvas** — `--ui-bg-clinical` / shell gradient  
2. **Raised panel** — `--ui-bg-surface` + `--ui-shadow-panel`  
3. **Elevated focus** — `--ui-shadow-elevated` (search bar, highlighted ops card)  
4. **Inset / muted** — `--ui-bg-muted`, `--ui-bg-subtle`

## Status semantics

App-state surfaces (not clinical diagnosis):

| State | Tokens | Meaning |
|-------|--------|---------|
| Read-only | `--ui-status-readonly-*` | Connected, writes blocked |
| Sandbox | `--ui-status-sandbox-*` | Pilot write zone |
| Mirror stale | `--ui-status-mirror-stale-*` | Data may be outdated |
| Offline | `--ui-status-offline-*` | Bridge unavailable |

Stat strip tones: `success`, `info`, `warning`, `danger`, `neutral`, `emphasis` — map mirror/connection health and counts.

## Card composition

- **Page hero** — clinical wash band, title + meta kicker  
- **Stat tile** — label / value / hint; left or border tint by tone  
- **Board / ops panel** — header with subtle teal accent; body on white surface  
- **Ops highlight** — next-action card with primary tint (`.app-ops-highlight`)  
- **Empty panel** — wash background, title, short copy, primary CTA row (`.app-empty-panel`)

## Avoid list

- No dark mode activation in this batch  
- No icon or webfont dependencies  
- No gradient soup, glassmorphism, or crypto/SaaS aesthetic  
- No pure `#fff` page backgrounds without clinical wash  
- No layout restructure (rail width, grid columns, DOM shells unchanged)  
- No new write domains or PHI fields  
- Do not set `.app-shell { flex-direction: column }` outside `shell-layout.css`

---

## v2 redesign — modern visual workspace

**Baseline:** `e5f6a23` — full visual/product redesign (structural + CSS layers allowed).  
**Load order:** `workspace-redesign.css` imports **last** in `app-shell.css` so v2 tokens and selectors beat legacy hub rules.

### Product personality

Premium **clinical OS**, not admin panel: warm workspace canvas, tinted rail identity, bold heroes, metric tiles with visible depth, status as colored blocks — not gray text tables.

### Bold palette

| Role | Token | Intent |
|------|-------|--------|
| Workspace canvas | `--ui-bg-workspace` | Warm blue-gray `#e8eef2` range — replaces near-white feel |
| Rail v2 | `--ui-bg-rail-v2` | Tinted teal rail surface, distinct from flat gray |
| Hero band | `--ui-bg-hero` | Pronounced clinical band behind page titles |
| Metric tile | `--ui-bg-metric` | White tile on tinted strip |
| Primary | `--ui-primary-500/600` | Richer teal saturation for actions and active nav |
| Depth | `--ui-shadow-metric`, `--ui-shadow-rail` | Visible but soft elevation |

### Typography scale bump

| Token | Target | Use |
|-------|--------|-----|
| `--ui-text-display` | ~2.25rem+ | Page heroes, patient display name |
| `--ui-text-section` | ~1.25rem+ | Panel titles, section headers |
| `--ui-text-body` | 16px min | Default reading |
| Meta / chrome | 14px min | Labels, chips, kicker — **no 11px UI chrome** on redesigned surfaces |

### Surface tiers

1. **Canvas** — `--ui-bg-workspace` / shell gradient  
2. **Rail** — `--ui-bg-rail-v2` + `--ui-shadow-rail`  
3. **Hero band** — `--ui-bg-hero` full-width tinted panel  
4. **Metric tile** — `--ui-bg-metric` + `--ui-shadow-metric`  
5. **Ops card** — `--ui-bg-surface` + `--ui-shadow-panel`  
6. **Inset** — `--ui-bg-muted`, `--ui-bg-subtle`

### Status severity blocks

Operational status (not clinical diagnosis). Each row uses a **visible color block** (chip or left accent), not plain text alignment:

| Tone | Class suffix | Meaning |
|------|--------------|---------|
| Critical / danger | `--danger`, `--critical` | Writes enabled, blocked ops |
| Warning | `--warn`, `--warning` | Stale mirror, dry-run, pilot caution |
| Info | `--info` | Read-only connection, informational |
| Healthy / ok | `--ok`, `--healthy` | Connected, mirror active, ready |
| Neutral | `--neutral` | Unknown, offline, idle |

Shared components: `AppMetricTile`, `AppStatusGrid` — status grids replace dense `<dl>` tables (e.g. Clinic at a glance).

### Card composition rules

- **Metric tiles** — label / bold value / optional hint; tone via left color dot or border (icon-free)  
- **Status grid** — 2-column compact grid on wide screens; label + colored chip + optional next-action link  
- **Hero bands** — display title + meta kicker on `--ui-bg-hero`  
- **Data density** — dense lists in board columns; spacious heroes and metric strips above

### Avoid list (v2)

- No gradient soup, glassmorphism, or SaaS card soup  
- No dark mode activation in this batch  
- No icon or webfont dependencies  
- No new write domains or PHI fields  
- Do not let legacy hub rules in `app-shell.css` flatten v2 — migrate conflicts to page sheets or override in `workspace-redesign.css`  
- Do not set `.app-shell { flex-direction: column }` outside `shell-layout.css`
