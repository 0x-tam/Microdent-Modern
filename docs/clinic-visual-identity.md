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
