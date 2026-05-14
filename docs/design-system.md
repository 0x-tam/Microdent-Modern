# Microdent Modern — Design System

**Version:** 1.0 (documentation)  
**Mode priority:** Light mode is the default and primary experience. Dark mode is planned as a later phase using the same semantic tokens inverted or remapped — no implementation in this document.

This document defines the visual language for the new Microdent application: a desktop-first clinical workspace for dental clinic staff. Goals: **modern, clean, premium, medical, trustworthy**, and **comfortable for all-day use** (reduced eye strain, clear hierarchy, predictable patterns).

---

## 1. Overall visual direction

### Principles

- **Clinical clarity over decoration.** Surfaces are calm; color carries meaning (status, clinical categories, alerts), not branding noise.
- **Dense but breathable.** Clinics need information density; spacing and typography prevent crowding without wasting screen space.
- **One primary action per view.** Secondary actions stay visually quieter; destructive actions are always explicit.
- **Consistent mental model.** Sidebar = place & module; top bar = context & account; main canvas = work; overlays = focused tasks.
- **Accessibility baseline.** WCAG 2.1 AA contrast for text and interactive states in light mode; focus rings always visible; touch targets where tablets are used (minimum 44×44 px logical where applicable).

### Aesthetic keywords

Cool neutrals, soft elevation (subtle shadows), **1 px hairline borders** instead of heavy frames, **rounded corners at a single radius family** (see spacing), restrained accent color, plenty of white/off-white, **blue-teal** as the trust anchor (medical without feeling “hospital sterile”).

### What to avoid

- Neon or saturated rainbow UI unrelated to clinical meaning.
- Pure black text on pure white for long reading blocks (use near-black on warm white).
- Skeuomorphic teeth or cartoon dentistry unless used sparingly in onboarding/marketing — the product UI stays professional.

---

## 2. Color palette (light mode — primary)

Use **semantic tokens** in implementation later; below are **reference hex values** for design handoff.

### Neutrals (surfaces & text)

| Token suggestion | Hex | Usage |
|------------------|-----|--------|
| `bg-canvas` | `#F6F7F9` | App background behind cards and panels |
| `bg-surface` | `#FFFFFF` | Cards, modals, dropdown panels |
| `bg-subtle` | `#EEF1F4` | Table stripe, input fill, sidebar section tint |
| `border-subtle` | `#E2E6EB` | Default dividers, input borders |
| `border-strong` | `#C9D0D8` | Focused control outline companion, table grid |
| `text-primary` | `#1A1F26` | Body and titles |
| `text-secondary` | `#5C6570` | Labels, helper text, column headers |
| `text-muted` | `#8A939E` | Placeholders, disabled, meta |
| `text-inverse` | `#FFFFFF` | Text on primary buttons / strong fills |

### Brand & primary actions

| Token | Hex | Usage |
|-------|-----|--------|
| `primary-600` | `#1B6F7A` | Primary buttons, key links, active nav indicator |
| `primary-500` | `#248B98` | Hover on primary |
| `primary-50` | `#E8F4F5` | Selected row, subtle highlights |

### Semantic feedback

| Token | Hex | Usage |
|-------|-----|--------|
| `success-600` | `#2F7D4A` | Confirmations, completed steps |
| `success-50` | `#E8F5EC` | Success banners background |
| `warning-600` | `#B45309` | Caution, billing holds |
| `warning-50` | `#FEF6E7` | Warning surfaces |
| `danger-600` | `#C53030` | Destructive actions, critical errors |
| `danger-50` | `#FCECEC` | Error summary background |
| `info-600` | `#2563EB` | Neutral system notices (non-clinical) |
| `info-50` | `#EFF6FF` | Info banners |

### Optional depth

- **Shadow:** soft, large blur, low opacity (e.g. `0 4px 24px rgba(26, 31, 38, 0.08)` for modals; lighter for cards).
- **Overlay scrim:** `rgba(26, 31, 38, 0.45)` behind modals.

### Dark mode (later — guidance only)

- Replace `bg-canvas` / `bg-surface` with dark blue-gray scales (`#0F1419`, `#161C24`, `#1E2630`).
- Desaturate accent slightly; bump border contrast (`border-subtle` ~ `#2A3441`).
- Preserve semantic hues (success/warning/danger) but darken fills and lighten text on colored surfaces for AA contrast.
- Reduce shadow reliance; use **border + 1-step elevation** instead.

---

## 3. Typography

### Font stack

- **UI & data:** A system-native stack for performance and familiarity: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`.
- **Optional display / marketing (not required in app chrome):** A geometric humanist sans (e.g. **DM Sans**, **Plus Jakarta Sans**, or **Inter**) — if loaded, use **only** for marketing or splash; keep the clinical UI on the system stack unless a single webfont is adopted everywhere for brand consistency.

### Scale (desktop baseline — 16 px root)

| Role | Size | Weight | Line height | Letter-spacing |
|------|------|--------|--------------|----------------|
| Display | 28 px | 600 | 1.2 | -0.02 em |
| Page title | 22 px | 600 | 1.25 | -0.01 em |
| Section title | 16 px | 600 | 1.35 | 0 |
| Body | 14 px | 400 | 1.5 | 0 |
| Body strong | 14 px | 500 | 1.5 | 0 |
| Label | 12 px | 500 | 1.35 | +0.01 em (optional caps for form labels) |
| Caption / meta | 12 px | 400 | 1.4 | 0 |
| Table cell | 13 px | 400 | 1.45 | 0 |
| Table header | 12 px | 600 | 1.35 | +0.02 em (uppercase optional; if uppercase, increase line-height slightly) |
| Mono / IDs | 13 px | 400 | 1.45 | Use `ui-monospace, SFMono-Regular, Menlo, monospace` for chart tooth IDs, appointment codes |

### Rules

- **Tabular figures** for numbers in schedules, ledgers, and timers (OpenType `tnum` when font supports it).
- **Max line length** for prose: ~72 characters; forms and tables are exempt.
- **No long paragraphs in chrome** — prefer labels + lists + tables.

---

## 4. Spacing

### Base unit

**4 px grid.** All spacing is a multiple of 4.

### Scale

| Token | Value | Typical use |
|-------|-------|-------------|
| `space-1` | 4 px | Icon-text gap, tight inline padding |
| `space-2` | 8 px | Form field vertical rhythm, badge padding |
| `space-3` | 12 px | Button vertical padding (compact), list item gap |
| `space-4` | 16 px | Card padding, section gap |
| `space-5` | 20 px | Modal body horizontal padding |
| `space-6` | 24 px | Page padding, stack between sections |
| `space-8` | 32 px | Empty state vertical breathing room |
| `space-10` | 40 px | Major section separation |

### Corner radius

| Element | Radius |
|---------|--------|
| Buttons, inputs, small chips | 6 px |
| Cards, panels, dropdowns | 8 px |
| Modals | 12 px |
| Dental chart tooth “tiles” | 6 px (or 8 px if larger hit area) |

### Layout widths

- **Main content max width** for settings/documentation-style pages: ~1200 px centered with side padding `space-6`.
- **Full-bleed** for scheduler and chart: use full width with consistent `space-4`–`space-6` page gutters.

---

## 5. Icon style

- **Library:** Outline icons, **1.5 px** stroke at 24 px grid (e.g. Lucide, Phosphor outline, or Heroicons outline) — pick **one** family and stay consistent.
- **Size:** 16 px inline with text; 20 px in buttons; 24 px in empty states and sidebar.
- **Color:** Default `text-secondary`; active `primary-600`; disabled `text-muted`; semantic icons use matching semantic hue.
- **Metaphor:** Office + health (calendar, users, document, tooth line-art). Avoid playful mascots in core UI.
- **Dental chart:** Icons supplement but do not replace FDI tooth numbering; keep chart glyphs **simple outline** matching the icon set.

---

## 6. Button styles

### Variants

| Variant | Background | Text | Border | Usage |
|---------|------------|------|--------|--------|
| Primary | `primary-600` | `text-inverse` | none | Save, Confirm, Book |
| Secondary | `bg-surface` | `text-primary` | `border-subtle` | Cancel adjacent to primary, “Back” |
| Ghost | transparent | `text-secondary` | none (hover: `bg-subtle`) | Tertiary toolbar actions |
| Danger | `danger-600` | `text-inverse` | none | Delete, remove appointment |
| Danger outline | `bg-surface` | `danger-600` | `danger-600` @ 40% opacity | Less emphasis destructive |

### Sizes

- **Default:** height 36 px, horizontal padding 14–16 px, label 14 px medium.
- **Compact (tables/toolbars):** height 32 px, padding 10–12 px.
- **Icon-only:** square 36 / 32 px with 8 px corner radius; tooltip required.

### States

- **Hover:** darken fill ~6–8% or use `primary-500` step.
- **Active:** slight inset or darker step.
- **Focus:** 2 px ring `primary-600` @ 35% opacity + 2 px offset, or inner border on inputs.
- **Disabled:** 50% opacity + `pointer-events: none` (implementation detail).

---

## 7. Card styles

- **Container:** `bg-surface`, radius 8 px, border `border-subtle` **or** borderless with very light shadow on `bg-canvas`.
- **Header:** padding `space-4`, bottom border `border-subtle`, title = Section title style; optional right-aligned actions (ghost buttons).
- **Body:** padding `space-4`; nested tables may use **flush** body (no extra padding) with dividers.
- **Footer (optional):** aligned right for wizards; subtle `bg-subtle` top border.
- **Interactive card** (e.g. patient summary): entire card hover = shadow lift + `border-strong`; keyboard focus = focus ring.

---

## 8. Table styles

- **Header row:** `bg-subtle`, text `table header` style, sticky on long lists.
- **Row height:** 40–44 px default; 36 px compact mode for dense ledgers.
- **Dividers:** horizontal `border-subtle` only; **avoid** vertical grid clutter unless column alignment suffers.
- **Zebra:** optional very light `bg-subtle` on even rows for long financial tables only.
- **Selection:** `primary-50` background + **1 px** left bar `primary-600` OR full row tint — pick one pattern app-wide.
- **Sortable columns:** caret icon `text-muted`; active column label `text-primary` + `primary-600` caret.
- **Numeric columns:** right-aligned; status column left with pill.
- **Empty state:** one illustration or icon, 14 px body, primary CTA.

---

## 9. Form styles

- **Label:** above field, 12 px medium, `text-secondary`, 4 px gap to control.
- **Input:** height 36 px, radius 6 px, border `border-subtle`, padding horizontal 12 px; fill `bg-surface`.
- **Focus:** border `primary-600` + focus ring as buttons.
- **Error:** border `danger-600`; helper text below in `danger-600` 12 px.
- **Disabled:** `bg-subtle`, `text-muted`, no shadow.
- **Select / date:** same as input; calendar popover uses card + shadow.
- **Checkbox / radio:** 18 px hit target, 2 px border `border-strong`, checked fill `primary-600`.
- **Switch:** used for settings (not critical clinical toggles unless confirmed by UX).
- **Field groups:** `space-4` between fields; `space-6` between logical groups with optional group title.

---

## 10. Modal styles

- **Width:** Small 400 px (confirmations), medium 560 px (forms), large 960 px (split preview).
- **Structure:** radius 12 px, `bg-surface`, shadow as overlay spec; **header** with title + close (ghost icon); **body** scroll max `70vh`; **footer** sticky with right-aligned button group (Secondary left of Primary per reading order in LTR).
- **Stacking:** second modal rare; prefer **drawer** for filters on small screens.
- **Danger modal:** top border or icon in `danger-600`; explicit consequence copy.

---

## 11. Scheduler colors

Scheduler color must encode **resource** and **status** without overwhelming the grid.

### Resource columns (providers / chairs)

- Assign each resource a **pastel column tint** from a fixed rotating palette (background only, not text):
  - `#E8F4F5`, `#EEF2FF`, `#ECFDF5`, `#FEF3C7`, `#F3E8FF`, `#E0F2FE`
- **Text** in cells stays `text-primary` / `text-secondary` for readability.

### Appointment status (semantic fills + left border or dot)

| Status | Left accent / dot | Cell background (optional) |
|--------|-------------------|-----------------------------|
| Scheduled | `info-600` | `info-50` @ 50% or white with colored left 3 px bar |
| Confirmed | `primary-600` | `primary-50` subtle |
| Checked-in | `success-600` | `success-50` subtle |
| Completed | `text-muted` | neutral, check icon |
| Cancelled | `text-muted` | strikethrough title, `bg-subtle` |
| No-show | `warning-600` | `warning-50` subtle |
| Block / closed | `#94A3B8` pattern or diagonal hatch (accessibility: also label “Blocked”) |

### Time & grid

- **Hour lines:** `border-subtle`.
- **Current time indicator:** `danger-600` 2 px vertical line (high visibility) + small pill label.
- **Selection:** `primary-50` block with `primary-600` outline.

---

## 12. Dental chart — visual direction

### Goals

- **FDI notation** (11–48, 51–85) primary; palette optional secondary encoding.
- **Tooth tiles:** rounded rect, default `bg-surface`, border `border-subtle`; **hover** `bg-subtle`; **selected** `primary-50` + `primary-600` ring.
- **Status surfaces (examples — tune with clinical team):**
  - Sound / untreated: neutral.
  - Caries / needs treatment: `warning-50` fill + `warning-600` small corner mark (not full tooth flood for whole chart).
  - Filled / restored: cool gray-blue tint `#E2E8F0` + discrete restoration glyph overlay (MOD outline style).
  - Missing: dashed border `text-muted`; icon optional.
  - Implant: distinct **small sub-gingival marker** (line or dot) + label “I” in legend, not cartoon screw art at small sizes.
- **Surfaces (M/D/O/L):** click targets as **facets** within the tooth or a **side panel** listing surfaces — facets use 1 px dividers `border-strong` at 40% opacity on hover.
- **Perio mode (if applicable):** switch chart to **numeric grid** beside simplified arch for data entry; color **only** for thresholds (BOP red dot, pocket depth heat gradient from green → amber → red with legend).
- **Legend:** fixed strip above or below arch; never rely on color alone — include icon + text.

### Accessibility

- Patterns or icons in addition to color for all pathological states; print/PDF export uses grayscale-safe fills.

---

## 13. Sidebar & top bar layout

### Sidebar (persistent, 240–280 px width; collapsible to icon rail ~64 px)

- **Background:** `bg-surface` with **1 px** `border-subtle` right divider **or** `bg-subtle` without divider — choose one globally.
- **Logo / clinic name:** top padding `space-4`; clinic name `caption`, truncated with tooltip.
- **Nav groups:** “Work”, “Patients”, “Finance”, “Settings” with 12 px uppercase labels `text-muted` + `space-2` gap.
- **Nav item:** height 40 px, icon 20 px + 12 px gap to label; active = `primary-50` pill + `primary-600` icon/text.
- **Collapse control:** bottom or top of sidebar (chevron), persists user preference.

### Top bar (full width, height 56 px, `bg-surface`, bottom border `border-subtle`)

- **Left:** page title / breadcrumb (Patient name > Chart > Treatment).
- **Center (optional):** global search — wide field max ~400 px, radius 8 px, placeholder “Search patients, charts, invoices…”.
- **Right:** quick actions (Today’s schedule, New appointment), notification bell (ghost), **user menu** with avatar + name + role.

### Content area

- **Padding:** `space-6` from sidebar + top bar to main canvas on “document” pages; **0** padding for full-bleed scheduler (internal toolbar only).

---

## 14. Motion & feedback (brief)

- **Duration:** 120–180 ms for hovers and menus; 200–280 ms for modals.
- **Easing:** standard ease-out; no bouncy overshoot in clinical UI.
- **Skeleton loaders** for patient load and schedule fetch — neutral `bg-subtle` pulse.

---

## 15. Imagery & empty states

- **Photography:** real diverse clinic contexts sparingly in marketing; in-app use **illustration-free** preference — icon + text + single CTA.
- **Empty scheduler:** “No appointments” + primary “Book appointment”.

---

## 16. Governance

- **Naming:** all colors/spacings referenced by semantic token names in future code (e.g. `--color-text-primary`), not raw hex in components.
- **Changes:** version this document when palette or radii change; breaking visual changes require changelog entry.

---

*This file is the single source of truth for visual design until a living Storybook or Figma library exists. Implementation should map these rules to CSS variables or design tokens in a later phase.*
