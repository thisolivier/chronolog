# Timesheet Redesign Specification

Sprint 012-UX: Final design specification for the Chronolog timesheet redesign. This document synthesizes the current-layout analysis, reference app research, wireframes, visual hierarchy spec, and notes integration design into a single implementation-ready reference.

---

## 1. Problem Statement

The current timesheet uses a 3-panel Apple Notes-style layout (sidebar + week list + entry content). While this works well for notes mode (sidebar + note list + editor), it creates five structural problems in time-entries mode:

**WeekListPanel redundancy.** The middle column (Panel 2, 200-500px wide) shows a scrollable list of week summaries -- date, total hours, status dot. Its only function is to scroll Panel 3 to the corresponding week when clicked. But Panel 3 already shows every week in a continuous scroll with identical information in the `WeekSectionHeader`. The middle column consumes 280px of horizontal space for what amounts to a jump-to-section index that duplicates the content area's own headers.

**Inverted visual hierarchy.** The `TimeEntryCard` layout puts the contract path ("Client / Contract / Deliverable / Work Type") as `font-medium text-gray-900` on the left, with the description relegated to `text-gray-500`. Time is `font-bold text-gray-900` -- the most visually dominant element. The question a consultant asks when scanning is "what did I do?" not "which billing bucket?" The hierarchy answers the wrong question.

**Missing temporal rhythm.** No "today" emphasis exists -- the current day is indistinguishable from any other day without reading headers. No month boundaries appear in the continuous scroll. There is no visual progress indicator for the current week. Opening the app provides no immediate orientation to "now."

**Clinical aesthetic.** The gray-50/gray-200/white palette with blue-600 accents is functional but sterile. Every entry card looks identical regardless of client. There are no client colors, no warmth signals, no visual differentiation beyond text content. The result reads as a spreadsheet, not a work journal.

**Timer visibility.** The `TimerWidget` lives at the bottom of the collapsible sidebar. When the sidebar collapses (for more content space), the running timer disappears. There is no persistent indicator anywhere else in the UI.

Additionally, three orphaned/duplicate components (`WeeklyEntryRow`, `DaySection`, `WeekHeader`) and a legacy entry component (`TimeEntryRow`) create maintenance burden.

See `current-layout-analysis.md` for the full analysis including data flow diagrams and component inventory.

---

## 2. Design Principles

1. **Description is the hero.** The work narrative ("Reviewed API design feedback") is the largest, darkest text in every entry card. A consultant reviews their timesheet to remember what they did, not which billing code they used.

2. **Client color is identity.** Each client gets an assigned color that appears as a left border on cards, a dot in the sidebar, and proportional segments in the WeekStrip. Color is processed pre-attentively -- it identifies the client before any text is read.

3. **Today is always obvious.** A warm amber background tint, a "TODAY" badge, and a highlighted WeekStrip column make the current day unambiguously identifiable at every zoom level. The app auto-scrolls to today on launch.

4. **Eliminate redundant navigation.** If the same information exists in two places, remove one. The WeekListPanel is replaced by a compact inline WeekStrip that provides equivalent navigation in 80px of vertical space instead of 280px of horizontal space.

5. **Warm journal, not cold spreadsheet.** The stone palette (warm gray), generous spacing between day sections, and contextual empty states ("Good morning! Ready to start the week?") create a daily-use tool that feels like a work diary, not a billing form.

6. **The timer never hides.** A persistent top-bar indicator shows elapsed time, description, and contract whenever a timer is running -- regardless of sidebar state.

7. **Notes link, never embed.** Time entry cards show lightweight note indicators (title + icon) when linked. Full note content is accessible via popover on demand. The timesheet never becomes a document viewer.

---

## 3. Layout Architecture

### Current: 3-Panel in Time Mode

```
Sidebar (240px) | WeekListPanel (280px) | TimeEntriesPanel (fills)
```

The WeekListPanel shows a scrollable list of week summaries. Clicking one scrolls the TimeEntriesPanel to that week. This is the core redundancy: both panels show week dates, hours, and status.

### New: 2-Panel in Time Mode

```
Sidebar (240px, collapsible) | Content Area (fills remaining)
                             |   WeekStrip (sticky, ~80px tall)
                             |   Scrollable day sections
```

The WeekStrip replaces the WeekListPanel as an inline component at the top of the content area. It shows Mon-Sun as a horizontal row with per-day hours and client color proportion bars. Clicking a day scrolls the content to that day's section. Week navigation (prev/next arrows) replaces the content below.

**Notes mode is unchanged.** The 3-panel layout (sidebar + note list + editor) remains as-is. The NoteListPanel serves a genuinely different purpose from the WeekListPanel -- it is a document index, not a duplicate of the content area.

### Desktop (>= 1024px)

Sidebar at 240px (collapsible to 0px). Content area fills the remaining width. WeekStrip is sticky at the top of the content area. Entry cards use the full content width.

### Mobile (< 1024px)

Single-panel push/pop navigation with three levels:
- **Level 0:** Sidebar (contracts + timer)
- **Level 1:** WeekStrip + day summary list (tappable rows with entry count, mini color bar, chevron)
- **Level 2:** Day detail view (entry cards for one day)

The timer indicator persists in the header bar at all levels.

See `wireframes-timesheet-redesign.md` for full desktop, mobile, and collapsed-sidebar wireframes.

---

## 4. Component Redesign

### AppShell / Layout

**Current:** Three equal panels in both modes. `AppShell.svelte` manages a resizable Panel 2 (200-500px).

**New:** Mode-aware panel count. Time-entries mode uses 2 panels (sidebar + content). Notes mode retains 3 panels. The resizable Panel 2 slot only renders in notes mode.

### WeekListPanel to WeekStrip

**Current:** `WeekListPanel.svelte` -- a scrollable vertical list of week summaries (date, hours, status dot) occupying 280px of horizontal space.

**New:** `WeekStrip` -- a compact horizontal strip (~80px tall) sticky at the top of the content area. Each of 7 day columns shows: day abbreviation, date number, per-day hours, and a color proportion bar showing client mix. The week summary area to the right shows total hours, a status badge (chip, not text input), and a client legend with per-client hour totals. Prev/next arrows navigate between weeks.

Key changes:
- Horizontal instead of vertical orientation
- Day-level granularity (click a day to scroll) instead of week-level
- Client color proportion bars per day
- Status as a colored chip (stone/amber/emerald) instead of a text input
- ~80px vertical vs. 280px horizontal footprint

### TimeEntryCard

**Current:** Contract path as hero text (`font-medium text-gray-900`), description as secondary (`text-gray-500`), time as bold right-aligned (`font-bold text-gray-900`).

**New:** Description-first layout:
- **Row 1:** Description (`text-sm font-medium text-stone-900`) + duration right-aligned (`text-sm font-medium text-stone-500`)
- **Row 2:** Linked note indicators (when present; see Section 6)
- **Row 3:** Client color dot + contract label (`text-xs text-stone-500`)
- **Row 4 (optional):** Deliverable/work type (`text-xs text-stone-400`)
- **Left border:** 3px in client color

```
+--+----------------------------------------------------------+
|  | Reviewed API design feedback and wrote summary   2h 30m  |
|  | * Big Cheese -- API Contract                             |
|  |   Onboarding > Development                               |
+--+----------------------------------------------------------+
 ^
 | 3px client color border
```

### NewEntryRow

**Current:** Contract select + description + time input in a single row. No deliverable field. Description is not the first field.

**New:** Description input first (full-width, top). Contract, deliverable, and time inputs in a horizontal row below. Cancel and Save buttons explicit. The form appears at the bottom of the day's entries (pushing content up).

### WeekSectionHeader

**Current:** "Week Starting Monday 9th Feb . 7.5 hrs" + inline editable status text field.

**New:** Week number + date range label. Total hours. Client breakdown bar (horizontal stacked segments proportional to client hours). Status as a clickable colored chip. Current week gets a "This Week" label and an optional hours target indicator ("32.5 / ~40 hrs").

### TimerWidget + Persistent Indicator

**Current:** Full timer widget pinned to sidebar bottom. Disappears when sidebar collapses.

**New:** Two display locations:
1. **Sidebar widget** (unchanged) -- full controls (Start/Pause/Stop, contract select, description textarea)
2. **Top bar indicator** (new) -- compact display showing pulsing green dot + elapsed time + description snippet + contract name. Always visible. Clicking it when sidebar is collapsed reopens the sidebar.

States: Idle (nothing in top bar), Running (green pulsing dot), Paused (hollow static dot + "(paused)" label), Stopped (nothing in top bar; completion form in sidebar).

### Day Sections

**Current:** Uniform lightweight headers for all days. No "today" emphasis. No empty-day treatment.

**New:**
- **Today:** Wrapped in `bg-amber-50/60 rounded-lg p-3`. "TODAY" badge (amber pill) next to day name. Auto-scroll on mount.
- **Empty days (current week):** Shown with dashed-border container, "No entries" message, and visible "+" button.
- **Month dividers:** Subtle centered label ("FEBRUARY 2026") with horizontal rules when scrolling across a month boundary within a week.

---

## 5. Visual Hierarchy Summary

The visual system replaces the clinical gray palette with warm stone tones and introduces client colors as a primary differentiator. Every design choice serves one question: "What did I work on today?"

**Color system.** Tailwind `stone-*` replaces `gray-*` throughout. Amber-50 for today emphasis. Blue-600 stays for interactive elements. Emerald for success/submitted states. Eight client colors (rose, sky, violet, amber, teal, fuchsia, lime, orange) at the 400 level for borders/dots. Colors assigned per client, not per contract.

**Typography.** System font stack (no custom fonts). Description at `text-sm font-medium text-stone-900` (the hero). Contract label at `text-xs text-stone-500`. Duration at `text-sm font-medium text-stone-500`. Timer at `text-2xl font-bold font-mono`.

**Visual weight ranking (top 5 of 15):**

| Rank | Element | Why |
|------|---------|-----|
| 1 | Entry description | Answers "what did I do?" -- the primary scan question |
| 2 | Today section | Warm amber background creates immediate temporal orientation |
| 3 | Timer elapsed | Only real-time element; must be peripherally readable |
| 4 | Day header | Primary structural anchor for scanning |
| 5 | Week header | Broadest temporal context |

**Status badges.** Unsubmitted (stone chip), Draft ready (amber chip), Submitted (emerald chip). Replaces the invisible inline text input.

See `visual-hierarchy-spec.md` for the complete 15-level priority ranking, Tailwind class specifications, card state treatments, spacing system, interactive affordances, and accessibility checklist.

---

## 6. Notes Integration Summary

Notes and time entries are linked through lightweight references, not embedded content. The design follows a "zero cost when unused" principle -- entries with no linked notes look identical to entries today.

**Linked note indicators.** When a time entry has linked notes, small document-icon rows appear on the card between the description and contract label. Each row shows the note ID and title. Clicking opens a preview popover (max 400x300px) showing the note title and first ~200 characters of content. A "Open in editor" link navigates to notes mode.

**Note linking interaction.** Triggered via right-click context menu or an in-card "Link Note" button. Opens a picker modal with notes grouped by same contract, same date, and recents. Notes with headings offer an optional heading-anchor selection step.

**Cross-mode navigation.** Clicking "Open in editor" from a popover switches to notes mode with the note selected. Clicking a linked time entry in the note editor switches to time-entries mode and scrolls to the entry with a brief highlight.

**Edge cases.** Deleted notes/entries show "(deleted)" labels, not cascade-deleted links. Cards with >3 linked notes collapse to "+N more" toggle. Cross-contract links are allowed without restriction.

See `notes-integration-design.md` for the full specification including wireframes, API surface requirements, and all edge cases.

---

## 7. Migration Path

### Phase 1: Palette Migration

Scope: Global. All layout and component files.

- Replace `gray-*` utility classes with `stone-*` throughout the codebase
- Add `colorIndex` field (0-7) to the client data model
- Assign default colors to existing clients in creation order
- No layout changes; no component restructuring

Components affected: All Svelte components using Tailwind gray classes, client data model/schema.

### Phase 2: Layout Restructure

Scope: AppShell, navigation, new WeekStrip component.

- Make AppShell mode-aware: 2-panel for time-entries, 3-panel for notes
- Remove WeekListPanel rendering in time-entries mode
- Build `WeekStrip` component (day columns, week navigation, client proportion bars, status badge)
- Add persistent timer indicator to top bar
- Update mobile navigation: Level 1 becomes WeekStrip + day summary list

Components affected: `AppShell.svelte`, `ContractsSidebar.svelte`, new `WeekStrip.svelte`, `TimerWidget.svelte`, new `TimerIndicator.svelte`, mobile navigation logic in `navigation.svelte.ts`.

### Phase 3: Card Redesign

Scope: TimeEntryCard, NewEntryRow.

- Restructure `TimeEntryCard` to description-first layout with client color left border
- Add client color dot to contract labels
- Restructure `NewEntryRow`: description first, add deliverable field, explicit Cancel/Save buttons
- Add client color dots to sidebar contract list

Components affected: `TimeEntryCard.svelte`, `NewEntryRow.svelte`, `ContractsSidebar.svelte`, `ContractSelect.svelte`.

### Phase 4: Enhanced States

Scope: Day sections, week headers, empty states.

- Add today emphasis (amber background, "TODAY" badge, auto-scroll)
- Add month dividers between weeks crossing month boundaries
- Build status badge component (colored chip replacing text input)
- Add client breakdown bar to week headers
- Implement contextual empty states (day, week, first-time, Monday morning)

Components affected: `TimeEntriesPanel.svelte` (day section rendering), `WeekSectionHeader.svelte`, new `StatusBadge.svelte`, new `MonthDivider.svelte`.

### Phase 5: Timer Persistence

Scope: Top bar, timer state.

- Build top bar timer indicator (pulsing dot, elapsed time, description, contract)
- Wire indicator to timer state (running/paused/idle visibility)
- Clicking indicator when sidebar collapsed reopens sidebar
- Add client color accent to indicator

Components affected: New `TimerIndicator.svelte`, `AppShell.svelte` (top bar slot), `TimerWidget.svelte` (shared state).

### Phase 6: Notes Integration

Scope: TimeEntryCard, note editor, new picker/popover components.

- Extend `TimeEntryDisplay` type with `linkedNotes` array (eager-loaded via JOIN)
- Add linked note rows to `TimeEntryCard` below description
- Build `NotePreviewPopover` component
- Build `NoteLinkingPicker` modal (search, same-contract, same-date, recents grouping)
- Build `TimeEntryLinkingPicker` modal (for note editor direction)
- Redesign `LinkedTimeEntries.svelte` in note editor to description-first format
- Add `linkNoteTimeEntry`, `getTimeEntryNotes`, `searchNotes` to DataService interface
- Handle edge cases (deleted notes, overflow, duplicate prevention)

Components affected: `TimeEntryCard.svelte`, `LinkedTimeEntries.svelte`, new `NotePreviewPopover.svelte`, new `NoteLinkingPicker.svelte`, new `TimeEntryLinkingPicker.svelte`, DataService interface and implementations.

---

## 8. Component Cleanup

These components should be removed during migration. All are either orphaned (not imported by any active route) or superseded by the redesigned components.

| Component | Path | Status | Replacement |
|-----------|------|--------|-------------|
| `WeeklyEntryRow.svelte` | `src/lib/components/weekly/` | Duplicate of TimeEntryCard | Consolidated into redesigned `TimeEntryCard` |
| `DaySection.svelte` | `src/lib/components/weekly/` | Orphaned | Superseded by inline snippet in `TimeEntriesPanel` |
| `WeekHeader.svelte` | `src/lib/components/weekly/` | Orphaned | Superseded by `WeekSectionHeader` (and now WeekStrip) |
| `TimeEntryRow.svelte` | `src/lib/components/time/` | Legacy server-action approach | Superseded by `TimeEntryCard` with inline editing |
| `WeekListPanel.svelte` | `src/lib/components/layout/` | Eliminated in redesign | Replaced by `WeekStrip` |

Removal should happen in Phase 2 (WeekListPanel) and Phase 3 (entry row variants). Verify no imports exist before deletion.

---

## 9. Trade-offs and Alternatives Considered

### 2-Panel vs. 3-Panel in Time Mode

**Decision:** Eliminate WeekListPanel, use 2-panel layout with inline WeekStrip.

**Alternative:** Keep 3-panel but improve WeekListPanel content (add mini calendars, richer summaries). Rejected because the fundamental problem is structural redundancy -- the panel duplicates information already visible in the content area. No amount of enrichment changes the fact that clicking a week summary just scrolls to content already present on the page.

### Description-First vs. Time-First Hierarchy

**Decision:** Description as hero text, duration and contract as secondary.

**Alternative:** Keep time/contract-first layout (the Harvest/Clockify approach). Rejected because Chronolog serves a solo consultant who needs to recall what they worked on, not a billing administrator scanning totals. Toggl's research and design uses the same description-first approach for the same reason -- the work narrative is what users review most.

### WeekStrip vs. Mini Calendar vs. Tab-Based Navigation

**Decision:** Horizontal day strip with hours and color bars, inspired by Fantastical's DayTicker.

**Alternatives:**
- *Mini calendar (like Google Calendar sidebar):* Too much temporal zoom for a weekly workflow. A month grid wastes space when the user cares about "this week" and "last week."
- *Tabs (Day/Week/Month view switching):* Adds cognitive overhead. A single continuous scroll with a compact strip is simpler and more discoverable than forcing view-mode selection.
- *No navigation element (just scroll):* Loses at-a-glance weekly context and per-day hour totals. The WeekStrip earns its 80px by providing summary data the scroll view alone cannot show compactly.

### Popover vs. Split View for Note Preview

**Decision:** Floating popover for quick note reference, with "Open in editor" link for full reading.

**Alternative:** Split the content panel into timesheet + note editor side-by-side. Rejected because the 2-panel layout already gives the content area limited width (~960px). Splitting it further creates two cramped columns. Most linked-note checks are quick reference ("which note was this?"), not sustained reading. The popover handles the 80% case; the 20% case warrants a full mode switch.

### Client Colors Per Client vs. Per Contract

**Decision:** Colors assigned per client. All contracts under "Big Cheese Inc." share one color.

**Alternative:** Per-contract colors would provide finer granularity but exhaust the 8-color palette quickly. A solo consultant with 4 clients averaging 3 contracts each would need 12 colors. Per-client assignment keeps the palette manageable and reinforces client identity as the primary visual grouping.

### Spreadsheet Grid vs. Journal-Style Scroll

**Decision:** Journal-style vertical scroll with day sections and description-rich cards (Toggl pattern).

**Alternative:** Spreadsheet grid with project rows and day columns (Harvest/Clockify pattern). Rejected because the grid sacrifices narrative context -- it turns "Reviewed API design and wrote feedback" into "2.5" in a cell. For a solo consultant maintaining descriptive records, the journal style preserves the work story. Grid views may be added later as an alternative view mode without changing the primary layout.

### Custom Font vs. System Font

**Decision:** System font stack.

**Alternative:** A humanist sans-serif (e.g., Inter, Source Sans) would add warmth. Rejected because custom fonts add load time and bundle size for minimal benefit in a productivity tool. The warm stone palette, client colors, and generous spacing provide sufficient aesthetic warmth without a font change.

---

## 10. Open Questions

These decisions are flagged for user input before or during implementation:

1. **Configurable week hour target?** The current-week header shows "32.5 / ~40 hrs" with a dotted "remaining capacity" segment. Should the ~40h target be user-configurable in settings, or should the target indicator be omitted entirely?

2. **"Copy last week" feature?** Clockify and Harvest both offer a "copy last week's project/task structure" button for Monday-morning setup. Should Chronolog include this? It is most useful for consultants with 3-5 recurring contracts where the weekly structure is predictable.

3. **Monthly/weekly reporting views?** The redesign focuses on the daily journal view. Should reporting views (monthly summaries, per-client hour breakdowns) be added as a separate section, or is the WeekStrip + week header breakdown sufficient? Flagged for a future sprint.

4. **Dark mode?** The visual hierarchy spec defines only light-mode classes. Should a dark mode variant be designed? The stone palette and client colors would need dark-mode equivalents. Bear and Day One offer multiple themes; Harvest and Clockify do not.

---

## Supporting Documents

| Document | Contents |
|----------|----------|
| `current-layout-analysis.md` | Full analysis of the existing 3-panel layout, component inventory, data flow diagrams, and issue severity matrix |
| `reference-app-research.md` | Research on 9 reference apps (Day One, Bear, Notion, Obsidian, Harvest, Toggl, Clockify, Fantastical, Google Calendar) with synthesized pattern recommendations |
| `wireframes-timesheet-redesign.md` | ASCII wireframes for desktop, mobile, collapsed-sidebar, WeekStrip close-up, entry card anatomy, empty states, and timer indicator states |
| `visual-hierarchy-spec.md` | Complete Tailwind class specifications for colors, typography, spacing, card states, interactive affordances, status badges, and accessibility checklist |
| `notes-integration-design.md` | Note-time entry linking design including card variants, picker modals, preview popover, edge cases, and API surface requirements |
