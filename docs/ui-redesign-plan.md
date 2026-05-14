# Microdent Modern — UI/UX Redesign Plan

This document defines the full modern interface concept for the next-generation Microdent clinic application. It is intentionally product- and workflow-first: the experience should feel **modern**, **sleek**, **premium**, **intuitive**, **fast**, and **built for dental staff**—not like a generic SaaS template, and not overloaded with configuration surface area.

**Scope:** UX specification and information architecture only. No implementation in this document.

**Phase 1 assumption:** Much of the domain data may be migrated or bridged from legacy systems; the UI can ship as a polished **read-first** shell with selective editing where risk is low and workflows are clear.

---

## Global experience principles

### Visual and interaction language

- **Density with calm:** Clinics need information density, but not clutter. Use clear hierarchy, generous whitespace *between* groups, and tight rhythm *within* groups (lists, tables, chart grids).
- **Quiet confidence:** Restrained palette (e.g. deep neutrals, one restrained clinical accent, semantic colors only for status). Avoid loud gradients and stock “dashboard” illustration kits.
- **Dental-native cues:** Subtle references to clinical context (tooth notation, arch orientation, appointment chair time) through typography and iconography—not decorative teeth everywhere.
- **Speed as a feature:** Skeleton states, optimistic UI only where safe, instant search, keyboard-first flows for front desk, large touch targets where tablets are used chairside.
- **Role-aware, not role-heavy:** Receptionist, assistant, hygienist, dentist, and admin see the same app with prioritized modules and permissions—not different “products.”

### Shell layout (applies to most screens)

- **Top bar (persistent):** Clinic name / location switcher (if multi-site), global patient search, quick “New appointment”, notifications (lab, messages), user menu.
- **Left rail (collapsible):** Primary modules (Dashboard, Patients, Schedule, Chart, Plans, Payments, History, Reports, Settings). Icons + short labels; tooltips when collapsed.
- **Main canvas:** Page content. Patient-centric pages add a **patient header strip** (photo optional, name, DOB, alerts, next appointment, balance snapshot) sticky below the top bar.
- **Right panel (contextual, optional):** Notes, tasks, eligibility snippets, or document preview—opens on demand to avoid permanent three-column clutter.

### Global keyboard shortcuts (suggested)

| Shortcut | Action |
|----------|--------|
| `⌘/Ctrl + K` | Command palette: patient lookup, navigate to module, “today’s schedule” |
| `⌘/Ctrl + /` | Keyboard shortcut cheatsheet overlay |
| `⌘/Ctrl + N` | Contextual “New…” (appointment if on schedule, patient if on patient list—confirm in implementation) |
| `Esc` | Close drawer / modal / context panel |

### Global empty and warning patterns

- **Empty:** Explain *why* it’s empty, one primary action, secondary link to learn more or import/migrate (if applicable).
- **Warning:** Inline banners for recoverable issues; modal only for irreversible or compliance-sensitive actions.
- **Critical clinical / financial:** Use persistent **alert chips** in the patient header (allergies, anticoagulants, pregnancy, balance due, broken appointment flag) with tap/click to source detail.

---

## 1. Dashboard

### Purpose

Give the team a **single glance at today**—who is in the clinic, what is at risk, and what needs follow-up—without replacing the dedicated Schedule or Patient modules.

### Layout

- **Row 1 — “Today at a glance” cards (responsive grid):** Chair utilization or “appointments today” count, no-shows/cancellations, new patients, production snapshot (if available in phase).
- **Row 2 — Timeline or list:** “Next up” queue (patient, time, provider, reason/visit type). Optional compact mini-schedule for the current hour.
- **Row 3 — Work queues:** Tasks requiring action (unsigned charts, pending treatment estimates, overdue recare, insurance follow-ups)—each as a compact list with deep links.
- **Optional:** Small “announcements” strip for clinic-internal notices (read-only in phase 1).

### Main actions

- Open **Schedule** at today’s date.
- Open **Patient profile** from any queue row.
- Mark task done / snooze (if tasks exist in data model; otherwise hide).

### Important information

- Date context always visible (clinic time zone explicit in Settings; show local time on dashboard).
- Clear distinction between **clinical** vs **administrative** alerts.

### Empty states

- **No appointments today:** Friendly copy (“Nothing on the books—enjoy the calm or reach out to fill slots”) + button to Schedule + link to recare list if available.
- **No tasks:** “You’re caught up” with subtle positive reinforcement (no noisy confetti).

### Warning states

- **Data sync delayed / offline:** Banner with last successful sync time; read-only indicators on editable modules.
- **Migration incomplete:** Non-blocking banner with link to admin/migration status (if relevant).

### Keyboard shortcuts

- `⌘/Ctrl + 1` (optional): Jump to Dashboard from anywhere.

### Phase 1 read-only

- **Production / revenue analytics** if source numbers are not yet validated post-migration.
- **Team task completion** if task backend is not wired; show placeholders or hide cards entirely (prefer hide over fake data).

---

## 2. Patient search

### Purpose

Fast, forgiving lookup for busy front desk: find the right **person** quickly, disambiguate similar names, and jump into chart or booking without friction.

### Layout

- **Global search** in top bar opens a **command palette style** overlay: field supports name, phone, chart ID, DOB fragments, email.
- **Dedicated Patients > Search page:** Left: filters (status, provider, last visit range, balance range if allowed). Center: results table. Right (optional): selected patient preview card.

### Main actions

- Search, filter, sort.
- **Select patient** → opens Patient profile in same tab (middle click or `⌘/Ctrl` click for new tab if web).
- **Start new patient** (phase 2 if registration not ready; phase 1 may be “Request intake” placeholder).

### Important information

- **Disambiguation fields** always visible in results: DOB, phone last four, provider of record, next appointment.
- **Privacy:** Mask sensitive identifiers where policy requires; blur preview in public areas (kiosk mode future).

### Empty states

- **No query yet:** Recent patients / “frequently opened today” list to accelerate repeat lookups.
- **No results:** Suggest broader filters, check spelling, search by phone, “add new patient” if permitted.

### Warning states

- **Multiple strong matches:** Show “possible duplicates” banner with side-by-side compare (read-only in phase 1).
- **Deceased / inactive / archived patient:** Muted row with badge; open requires confirmation.

### Keyboard shortcuts

- `⌘/Ctrl + K` focuses global search.
- Arrow keys navigate results; `Enter` opens highlighted patient.

### Phase 1 read-only

- **Merging duplicate patients**, editing demographics at scale, bulk export—defer to later phases.

---

## 3. Patient profile

### Purpose

The **home base for a single patient**: identity, contact, coverage, risk flags, and navigation into clinical and financial depth—optimized for 10-second front-desk checks and 30-minute clinical reviews.

### Layout

- **Patient header strip** (sticky): Photo (optional), legal/preferred name, age/DOB, pronouns (optional), chart ID, **alert icons** (allergies, medical flags, balance), primary phone, email, “Book” and “Chart” primary buttons.
- **Tabbed or vertical sub-nav** (pick one system-wide; tabs work well on wide screens, vertical nav on tablet):
  - Overview
  - Appointments
  - Chart
  - Treatment plans
  - Treatment history
  - Payments / ledger
  - Medical history
  - Documents (phase 2+ if scope tight)
- **Overview tab content:** Two columns—left: demographics & coverage summary; right: upcoming appointments + open financial balance + “last visit” snapshot.

### Main actions

- Book appointment, open chart, print/future: export face sheet.
- Edit demographics / contacts **only if** phase 1 permits; otherwise “Suggest correction” workflow.

### Important information

- **Primary provider**, **recare due**, **insurance plan name** (not just carrier), **preferred contact method**.
- **Consent and communication preferences** where regulated.

### Empty states

- **New patient with no history:** Guided checklist (“Schedule first visit”, “Medical history”, “Insurance capture”) as read-only checklist in phase 1 if actions not available.
- **No upcoming appointments:** Prompt to schedule with suggested hygiene interval if data exists.

### Warning states

- **High balance / collections flag:** Prominent but respectful banner; link to Payments.
- **Incomplete or stale medical history:** Banner with CTA to review in Medical history module.

### Keyboard shortcuts

- `⌘/Ctrl + E` (optional): Edit patient (if editing enabled).
- `B` (optional, single-key in patient context only): Book appointment—only if it will not conflict with typing in fields; prefer safe shortcuts.

### Phase 1 read-only

- **Clinical narrative edits** that belong in signed notes (if signing workflow absent).
- **Financial adjustments**, write-offs, refund issuance.
- **Insurance benefit engine outputs** if not verified—show as “unverified estimate.”

---

## 4. Appointments / scheduler

### Purpose

Operational **truth for chair time**: who sits where, when, with whom, for how long—supporting drag-and-drop efficiency without hiding conflicts or double-book risk.

### Layout

- **Main calendar:** Week view default; day view dense mode; month view for planning only (less detail).
- **Resources as columns or rows:** Providers, chairs/ops, or hybrid based on clinic configuration (start with provider columns + chair labels on blocks).
- **Side drawer:** Clicking a slot opens appointment detail (patient, procedure codes placeholder, notes, status).
- **Optional bottom “pin” bar:** Clipboard of “patients to schedule” from calls (phase 2).

### Main actions

- Create, move, resize appointment; change provider/operatory; change status (scheduled, confirmed, checked-in, completed, no-show).
- **Check-in** flow launches patient snapshot (read-only mini panel acceptable in phase 1).

### Important information

- **Color semantics legend** (by provider vs by visit type—pick one default, allow toggle in Settings later).
- **Appointment status** and **elapsed time** for current appointments.
- **Buffer / cleanup** segments visually distinct if supported.

### Empty states

- **Empty day:** “No appointments” with quick add and link to recare/working lists.
- **Filtered view with no matches:** Clear filters control.

### Warning states

- **Double-book / overlap:** Hard warning modal with who created last change (audit hint).
- **Insurance verification missing** (if tracked): Soft warning on block border.
- **Patient late / missed previous:** Subtle icon on block; details in tooltip.

### Keyboard shortcuts

- `T` jumps to **Today** (when calendar focused).
- `D` / `W` / `M` toggles Day / Week / Month views.
- Arrow keys navigate focused appointment; `Enter` opens detail.

### Phase 1 read-only

- **Recurring series exception logic** if not fully implemented—allow single instances only.
- **Automated reminders sending** (show status only).
- **Fee/procedure editing** from appointment card—link out read-only until billing module ready.

---

## 5. Dental chart

### Purpose

Visual and structured record of **oral conditions and planned work**—fast charting for clinicians, unambiguous history for medicolegal traceability.

### Layout

- **Large occlusal chart canvas** (FDI or Universal notation toggle in Settings; default per region).
- **Tooth/region inspector** on click: tabs for Existing work, Caries/conditions, Perio summary link (future), Surfaces.
- **Legend** collapsible: condition colors/icons, status chips (watched, treatment planned, completed).
- **Visit selector** (timeline across top): chart as-of visit vs current state—phase 1 may be “current state only” with read-only historical visits.

### Main actions

- Select tooth or sextant, apply condition, mark surfaces, mark existing restoration type.
- Toggle **primary/permanent** dentition where pediatric.
- Undo/redo stack for in-session edits (strongly recommended).

### Important information

- **Last updated by / at** for chart edits (footer or audit popover).
- **Medical contraindications** icon linking back to Medical history.

### Empty states

- **Adult chart with no conditions:** “Healthy baseline documented—continue charting as findings appear.”
- **Pediatric with mixed dentition:** Short explainer for eruption chart usage.

### Warning states

- **Conflicting documentation** (same surface double-coded): Inline resolution panel.
- **Exit with unsaved changes:** Standard blocking dialog.

### Keyboard shortcuts

- `1–9`, `0` for quick tooth selection patterns (implementation-specific; document after user testing).
- `⌘/Ctrl + Z` / `⌘/Ctrl + Shift + Z` undo/redo when canvas focused.

### Phase 1 read-only

- **Historical visit chart states** if snapshot storage not migrated—show PDF/image import viewer instead if legacy provides static exports.
- **Perio probing grid** if module incomplete—show “open legacy perio” link only if allowed by deployment architecture (avoid if confusing).

---

## 6. Treatment history

### Purpose

Chronological **completed care** narrative: what was done, when, by whom, where, and how it was paid for—optimized for continuity of care and audits.

### Layout

- **Vertical timeline** grouped by visit date; each visit expandable.
- **Visit card:** Procedures table (code, tooth, surfaces, description, provider, time), clinical notes excerpt, imaging thumbnails (phase 2+), payment status summary.

### Main actions

- Filter by date range, provider, tooth, procedure category.
- Print/export visit summary (phase 2 if compliance review needed).
- **Add addendum** to signed clinical note (strict permissions; often phase 2+).

### Important information

- **Signed vs draft** note state clearly labeled.
- **Diagnostic codes** adjacent to procedures where used.

### Empty states

- **No completed visits:** “No treatment history yet” with CTA to schedule or import legacy summary PDF.

### Warning states

- **Unsigned visit note** with completed procedures: Administrative warning to provider queue.
- **Coding inconsistency** (e.g. missing tooth on a tooth-specific code): Soft warning with suggested fix (read-only suggestion in phase 1).

### Keyboard shortcuts

- `J` / `K` (optional): Move between visits when timeline focused (vim-like; document clearly).

### Phase 1 read-only

- **Editing or deleting signed clinical entries** and locked procedures.
- **Backdated procedure add** without audit workflow.

---

## 7. Treatment plans

### Purpose

Communicate **proposed care pathways**: phased treatment, alternatives, costs, risks, and patient acceptance—bridging clinical decision-making and scheduling/billing.

### Layout

- **Plan list** left: Active, Accepted, Completed, Archived.
- **Plan detail** right: Phases (columns or stacked cards), each with line items (procedure, tooth/region, UCR fee, estimated insurance, patient portion).
- **Summary bar** (sticky bottom): total patient responsibility, max discount applied, validity date.

### Main actions

- Create plan from chart selection (phase 2 if integration not ready).
- Present / export patient-facing plan (PDF) in later phase.
- Mark phase as scheduled / completed (ties to appointments—phase 2).

### Important information

- **Informed consent status** per major procedure where required.
- **Alternative options** (e.g. implant vs bridge) as mutually exclusive line groups.

### Empty states

- **No active plan:** “No treatment plan on file—create one after examination” (button availability depends on phase).

### Warning states

- **Stale plan** (older than N months): Banner to re-validate fees/diagnosis.
- **Insurance estimate disclaimer** always visible: estimates not a guarantee.

### Keyboard shortcuts

- Minimal; this module is mouse-first. Optional `⌘/Ctrl + S` save plan draft.

### Phase 1 read-only

- **Patient e-signature capture**, **automated fee negotiation**, **phase auto-scheduling**.
- Editing fees if master fee schedule not finalized—show locked fields with tooltip.

---

## 8. Payments

### Purpose

Transparent **ledger view**: what the patient owes, why, and what happened with insurance—without turning front desk staff into accountants.

### Layout

- **Summary header:** Total balance, insurance pending, patient responsibility, last payment date.
- **Ledger table:** Date, description, charges, payments, adjustments, running balance; filters for family account (if supported).
- **Right drawer:** Payment allocation detail when row selected.

### Main actions

- Take payment (phase 2), print statement (phase 2), send payment link (phase 3).
- **Post adjustment** (restricted roles, later phase).

### Important information

- **Claim status** per charge when applicable (submitted, accepted, denied).
- **Family vs guarantor** relationship indicator.

### Empty states

- **Zero balance account:** Positive reinforcement + “upcoming due” if future treatment planned.

### Warning states

- **Denied claim:** Red-row highlight with reason code tooltip; link to Reports / follow-up queue.
- **Credit balance:** Informational banner (refund policy internal note for staff).

### Keyboard shortcuts

- `/` focuses ledger search/filter.

### Phase 1 read-only

- **All posting actions:** charges, payments, adjustments, refunds, claim submission.
- Show **read-only ledger** imported from legacy with clear “source system” tag per row if hybrid.

---

## 9. Medical history

### Purpose

Capture and surface **risk-relevant health information** for safe dentistry: allergies, medications, conditions, vitals—structured for alerts and for review before procedures.

### Layout

- **Top:** Critical alerts (allergies, anticoagulant, pregnancy, infectious disease precautions) always expanded or one click away—never buried.
- **Sections:** Conditions, Medications (+ dosages), Allergies, Hospitalizations, Habits, Vitals trend (phase 2 sparkline).
- **Review footer:** “Last reviewed by / on” with checkbox attestation when edits allowed.

### Main actions

- Update section, add medication, mark allergy severity.
- **Mark as reviewed** for today’s visit (if workflow exists).

### Important information

- **Drug interaction checks** (phase 3+ integration)—until then, static disclaimer.
- **Source** of information (patient report vs documented labs).

### Empty states

- **Incomplete history:** Banner “Medical history incomplete—review with patient” with checklist of missing sections.

### Warning states

- **Conflicting entries** (e.g. “NKDA” vs listed allergy): Blocking dialog until resolved.
- **Stale review** (not reviewed in >12 months for active patient): Soft banner.

### Keyboard shortcuts

- `⌘/Ctrl + F` find within page for long medication lists.

### Phase 1 read-only

- If medicolegal policy requires: **entire module read-only** with “capture updates in legacy” banner; OR allow **review attestation only** without changing historical entries.
- **Deleting historical allergies**—never allow without audit; prefer supersede with end date.

---

## 10. Reports

### Purpose

Operational and compliance outputs: day sheets, AR aging, production by provider, insurance claims, patient lists—**trustworthy numbers** with clear filters and export.

### Layout

- **Left:** Report catalog grouped (Clinical, Financial, Scheduling, Compliance).
- **Center:** Parameters (date range, provider, location).
- **Bottom / right:** Preview table or chart; export buttons (CSV/PDF).

### Main actions

- Run report, save parameter preset (phase 2), schedule email (phase 3).
- Drill down to patient or visit where permitted (opens read-only profile).

### Important information

- **As-of timestamp** and **data scope** (“includes posted transactions only”).
- **Footnotes** for known migration caveats.

### Empty states

- **No rows returned:** Explain likely cause (filters too narrow, no posted data yet).

### Warning states

- **Large result set:** Warn before render; offer async generation.
- **Permission denied sections:** Inline masked cells vs entire report hidden—prefer explicit “restricted” label.

### Keyboard shortcuts

- `⌘/Ctrl + Enter` run with current parameters when focus in form fields.

### Phase 1 read-only

- **Saved custom reports**, **SQL/report builder**, **email schedules**—out of scope.
- Any report whose underlying data is not migrated should be hidden, not shown empty without explanation.

---

## 11. Settings

### Purpose

Clinic-wide configuration: **people, places, templates, and integrations**—kept shallow in phase 1 to avoid a “second app” feeling.

### Layout

- **Grouped sections:** Organization & locations, Users & roles, Schedule templates, Fee schedules (later), Integrations, Devices, Notifications, Data & privacy.
- **Danger zone** separated at bottom: archive data, export, delete tenant (superadmin only).

### Main actions

- Invite user, assign role, set operatory hours, configure appointment types display names and colors.
- Manage integration credentials (admin only).

### Important information

- **Role capability matrix** link/modal so staff understand why a button is disabled.
- **Audit log** entry for each settings change (read-only log viewer in phase 1 is valuable).

### Empty states

- **No integration connected:** Helpful cards per integration with setup steps.

### Warning states

- **Changing hours affects existing appointments:** Preview impact list with confirm.
- **Role downgrade removes access:** Confirm with typed clinic name or similar guard.

### Keyboard shortcuts

- None prioritized; advanced users can use `⌘/Ctrl + K` to jump to a settings page by name.

### Phase 1 read-only

- **Destructive actions**, **bulk data imports**, **fee schedule edits** if billing not live.
- **Production of legal documents templates** without legal review—read-only preview mode.

---

## Cross-cutting: accessibility, localization, and compliance

- **WCAG 2.2 AA** target: charting canvas needs non-color-dependent encodings (patterns/icons), keyboard paths for all actions, sufficient contrast for clinical lighting.
- **RTL and multilingual** copy expansion in UI components (French/Arabic common in some regions—plan text truncation rules).
- **Audit trails** on every clinical and financial mutation post-phase-1; UI should foreshadow fields (`updated_by`) even if not populated yet.

---

## Implementation notes (non-binding)

- Prefer **one navigation mental model** (patient-centric vs schedule-centric) but support cross-links everywhere.
- **Progressive disclosure:** Defaults for small clinics; advanced toggles in Settings, not inline on every screen.
- **Avoid generic SaaS tropes:** replace “workspace” language with **clinic**, **visit**, **operatory**, **provider**, **patient ledger**.

---

## Document control

| Version | Date | Author |
|---------|------|--------|
| 1.0 | 2026-05-14 | Initial UI/UX redesign plan for Microdent Modern |
