# Reference App Research: Layout & UX Patterns

Sprint 012-UX: Patterns research for timesheet redesign.

Sources: Product documentation, App Store descriptions, help centers, user reviews, and design analysis of each app's publicly documented interface patterns.

---

## Category 1: Journal/Planner Apps

### Day One

**Layout architecture:** Three-panel on desktop (Mac). Left sidebar shows a list of journals (e.g., "Work", "Personal") as colored entries. The middle panel shows a chronological timeline of entries for the selected journal, grouped by day with date headers. The right panel shows the full content of the selected entry.

**Temporal organization:**
- Entries are grouped under date headers (e.g., "Monday, February 3, 2025") in the timeline list.
- Multiple entries per day stack under the same date header.
- An "On This Day" feature surfaces entries from the same calendar date in previous years -- a retrospective layer.
- Calendar view available as an alternate navigation mode, showing dots on days that have entries (streak-style visualization).
- Map view provides geographic browsing of entries.

**Visual hierarchy:**
- Each entry in the timeline shows the first line of text (as a title), a preview of body text, and thumbnail of any attached photo.
- Date headers are bold and act as section dividers.
- Metadata (time, weather, location, moon phase) is automatically captured and displayed subtly below entries -- context without visual dominance.
- Entries with photos get prominent thumbnails, creating visual rhythm and breaking the text monotony.

**Warm/journal aesthetic elements:**
- Soft color palette with blues and purples as brand accents rather than corporate grays.
- Photo integration makes entries feel personal rather than transactional.
- Auto-captured metadata (weather, location) adds ambient context -- it tells you "where you were" without you having to type it.
- "On This Day" creates emotional resonance, encouraging reflection.
- Multiple journal support with custom colors provides personalization.
- The overall feeling is "personal record" rather than "data entry".

**Key pattern: Metadata as ambient context, not primary data.** The date, time, weather, and location are captured automatically and displayed subtly. The user's written content is always the hero element.

---

### Bear

**Layout architecture:** Classic three-panel layout on Mac/iPad:
- Panel 1 (sidebar): Tag-based navigation. Tags are created inline with `#hashtag` syntax in notes and automatically populate the sidebar. Nested tags supported (`#project/subproject`). Tags can be pinned and given custom icons ("TagCons").
- Panel 2 (note list): Chronological list of notes matching the selected tag. Each note shows title (first line, bold), date, and a 2-3 line body preview.
- Panel 3 (editor): Full note content with Markdown rendering. Info panel includes table of contents and backlinks.

**Temporal organization:**
- Notes sorted by modification date (most recent first) by default.
- No explicit temporal grouping (no "today", "this week" sections) -- it is a flat chronological list.
- Time appears as small metadata under each note title in the list.

**Visual hierarchy:**
- Writing content is the absolute priority. The editor pane dominates.
- Nearly 30 themes in light and dark modes create the sense of a personal space.
- Customizable typography (fonts, line height, paragraph spacing, line width) lets users craft their reading environment.
- Tags are organizational but never dominate the visual layout.

**Warm/journal aesthetic elements:**
- Described as "elegant and cozy" -- the app won Apple's Design Award 2017.
- "Tools stay out of your way so you can just write" -- UI chrome is minimal.
- Theming creates ownership and warmth: the app looks different for every user.
- Typography customization means the text itself feels crafted, not default.
- The sidebar hides completely when not needed (three-panel collapses to two or one).

**Key pattern: The content is the interface.** Bear's design philosophy is that the note content itself is what you should see. All organizational structure (tags, metadata, navigation) exists to serve the content, never to compete with it.

---

### Notion

**Layout architecture:** Left sidebar with a page tree (nested pages/databases). Main content area fills remaining space. No fixed middle panel -- navigation is hierarchical (click into a page, which may contain databases, sub-pages, or inline content).

**Database views relevant to timesheet design:**
- **Table view:** Rows are entries, columns are properties. Each row is clickable to open as a full page. Properties shown inline include text, dates, selects, numbers. Feels like a spreadsheet but each row has rich content behind it.
- **Calendar view:** Entries placed on a calendar grid by their date property. Hover over any day to see a "+" icon for quick-add. Entries show as cards on their respective days. Good for seeing distribution across time.
- **Timeline view:** Horizontal time axis with entries as bars spanning their date ranges. Useful for seeing overlapping or sequential work. Supports zooming between day/week/month scales.
- **Grouping:** Any view can be grouped by a property (e.g., group by client, group by status). This creates collapsible sections within the view, each with its own sub-total or count.

**Visual hierarchy:**
- Properties (metadata) appear at the top of each page; free-form content below.
- In table view, the first column (usually "Name") is bold and acts as the primary identifier.
- Color-coded selects and multi-selects provide visual differentiation.
- Filters and sorts are accessible but hidden behind toggles to keep the view clean.

**Key pattern: Multiple views of the same data.** A single Notion database can be viewed as table, calendar, timeline, board, gallery, or list. The underlying data doesn't change -- only the lens. This lets users switch between "what did I do this week?" (calendar) and "how much time on Client X?" (table grouped by client) without duplicating data.

---

### Obsidian

**Layout architecture:** Flexible panel system. Default is a file explorer sidebar on the left and an editor pane on the right. Users can split panes horizontally or vertically, open multiple notes simultaneously, and rearrange freely. Community plugins extend the layout significantly.

**Daily notes plugin:**
- Core plugin that creates (or opens) a note named with today's date (default format: `YYYY-MM-DD`).
- One-click access via a calendar icon in the ribbon or a keyboard shortcut.
- Supports folder hierarchy via date formatting: `YYYY/MMMM/YYYY-MMM-DD` creates `2025/February/2025-Feb-03.md` automatically.
- Template support: new daily notes auto-populate from a configured template (e.g., pre-filled with "## Tasks", "## Time Log", "## Notes" sections).
- Calendar community plugin adds a sidebar calendar widget where clicking any date opens that day's note. Dots on dates indicate existing notes.

**Temporal navigation:**
- The calendar sidebar plugin is the primary temporal navigation pattern: a small month calendar with clickable dates.
- Daily notes link to each other implicitly through the date-based naming convention.
- Date properties in any note auto-link to the corresponding daily note when clicked.
- No built-in weekly or monthly aggregation -- users build this via templates and dataview queries.

**Key pattern: Date as a first-class navigation axis.** Clicking a date anywhere in Obsidian navigates to that day's note. The calendar widget provides visual overview of which days have content. This makes temporal navigation effortless without imposing a rigid temporal structure.

---

## Category 2: Time Tracking Apps

### Harvest

**Layout architecture:** Single-panel primary view with a top navigation bar. The timesheet is the main screen.

**Daily view (default):**
- The screen shows a single day at a time.
- Each entry is a row with: project name, task name, notes field, and hours.
- A running timer can be started for any entry.
- New entries are added via a "New Row" button at the bottom.
- The date is shown at the top with Previous/Next arrows for day navigation.
- A summary bar shows total hours for the day.

**Weekly view:**
- A grid/table layout: rows are project+task combinations, columns are days (Mon-Sun).
- Each cell contains the hours worked on that project/task on that day.
- Row totals on the right, column totals at the bottom.
- Clicking a cell allows direct hour entry.
- The "Copy Last Week" function imports the previous week's project/task rows (structure without hours).

**Visual hierarchy:**
- Project and task names are the row identifiers (left-aligned, text-dominant).
- Hours are right-aligned numbers in the grid cells.
- The design is described consistently as "clean", "intuitive", "minimalist", and "lightweight".
- Users praise the simplicity but note the design is "black-and-white" -- some wish for "different colored tabs" for visual scanning.
- Billable vs. non-billable is a toggle on each entry, not a visual distinction.

**Navigation:** Top bar with sections: Time, Expenses, Projects, Reports, Team. Within Time, tabs or toggles switch between Day and Week view.

**User feedback themes:**
- 4.6/5 ease-of-use rating (646 reviews on GetApp).
- Praised for: "simplifies day-to-day workflow without adding unnecessary complexity."
- Criticized for: limited visual differentiation, basic customization, "buggy tabs."
- The design is functional but "corporate" -- it serves teams and billing workflows, not personal reflection.

**Key pattern: The grid timesheet for bulk entry.** Harvest's weekly view is essentially a spreadsheet: projects as rows, days as columns, hours as cell values. This is extremely efficient for end-of-week bulk entry ("I worked on Project A Monday 3h, Tuesday 2h, Wednesday 4h") but removes all narrative context. There is no description field in the weekly grid view.

---

### Toggl Track

**Layout architecture:** Single-panel with a top navigation bar. The timer page is the primary view.

**Timer page (default view):**
- A persistent timer bar at the top of the page: description field, project selector, tag selector, billable toggle, and Start/Stop button all in one row.
- Below the timer: a chronological list of time entries, grouped by day.
- Day headers show the date and total hours for that day.
- Each entry row shows: description (primary text), project name with a colored dot, duration, and action icons.
- Identical entries can be grouped (collapsed) showing the count and combined duration.
- "Favorites" (pinned entries) appear at the top of the timer page for one-click repeat tracking.

**Calendar view:**
- Time entries displayed as colored blocks on a weekly calendar grid (like Google Calendar but for tracked time).
- Block height represents duration; block color represents the project.
- Entries can be created by clicking and dragging on the calendar.
- Integrates with Google and Outlook calendars to show calendar events alongside tracked time.
- Day columns, hour rows -- standard calendar grid layout.

**Visual hierarchy:**
- Project colors are a dominant visual element -- each project has a colored dot/stripe that carries through timer bar, entry list, and calendar blocks.
- Description text is the primary label on each entry (not the project name).
- Duration is right-aligned and secondary.
- The timer bar at the top is always visible and prominent -- tracking is the primary action.

**Reporting:**
- Profitability tracking at project, task, client, member, and team levels.
- Flexible filtering and grouping.
- Scheduled automatic report delivery.

**Key pattern: Project color as visual identity.** Toggl's strongest design decision is giving each project a color that carries consistently through every view -- the timer bar, the entry list, and the calendar blocks. A user can glance at a day's calendar view and immediately see "mostly blue (Client A) with some orange (Client B)." This visual coding removes the need to read text for at-a-glance recognition.

---

### Clockify

**Layout architecture:** Left sidebar navigation with sections: Timer, Timesheet, Calendar, Dashboard, Reports, Projects, Team. Main content area fills the rest.

**Timesheet view (weekly grid):**
- Traditional grid: rows = project + task combinations, columns = days of the week.
- Users select project/task via dropdown, then enter time in the corresponding day cell.
- "Add row" button to add new project/task lines.
- Time format: hours:minutes or decimal, depending on workspace settings.
- Hovering a cell shows three dots for accessing a popup with description, tags, billable status, and start/end times.
- Status indicators per entry: green checkmark (approved/locked), orange checkmark (pending/editable), no icon (unsubmitted).
- "Copy last week" imports previous week's row structure.
- "Save as template" preserves recurring weekly structures.

**Navigation:** Date navigation in top-right corner to switch between weeks.

**Visual hierarchy:**
- Project/task names are the row identifiers.
- Day columns are equal-width.
- Hours are the cell values -- numeric, center-aligned.
- Color-coded approval status indicators provide workflow visibility.
- The design prioritizes efficiency for bulk time entry.

**Key pattern: Template-based repetition.** Clockify's "save as template" and "copy last week" features acknowledge that most weeks for a consultant look structurally similar -- same projects, same tasks, different hours. The template eliminates re-selecting projects every Monday. This is a workflow pattern, not just a layout pattern.

---

## Category 3: Calendar Apps

### Fantastical

**Layout architecture:** Hybrid layout with the "DayTicker" as a distinctive element.

**The DayTicker:**
- A compact, horizontally scrollable row of dates at the top of the screen.
- Each date shows the day name, number, and subtle indicators of event density.
- Tapping a date scrolls the detail view below to show that day's events.
- Functions as a "scrubber" -- fast temporal navigation without switching to a full calendar grid.

**View hierarchy:** Full-screen views for Day, Week, Month, Quarter, and Year. Each provides increasing levels of temporal compression.

**Week view:**
- Standard calendar grid: 7 day columns, time-of-day rows.
- Events appear as colored blocks spanning their duration.
- All-day events in a dedicated section above the time grid.
- Tasks (todos) displayed alongside calendar events in a unified list.
- Custom event colors provide visual differentiation.

**Visual hierarchy:**
- Clean, minimal chrome. Described as "beautiful" and "intuitive."
- The DayTicker provides at-a-glance temporal context without consuming a full calendar grid's worth of space.
- Events are color-coded by calendar/category.
- Accessibility: VoiceOver, larger text, reduced motion options built in.

**Key pattern: The DayTicker as lightweight temporal navigation.** Instead of a full month calendar taking up significant space, Fantastical uses a compact horizontal date strip. This provides date awareness and navigation in minimal vertical space. For a timesheet app, a similar "week ticker" could show Mon-Sun with hours per day as a compact summary bar above the detail view.

---

### Google Calendar

**Layout architecture:** Two-panel layout. Left sidebar with a mini month calendar and calendar list (toggleable visibility per calendar). Main area shows the selected view (day, week, month, year, schedule, or custom range).

**Week view:**
- 7 day columns with time-of-day rows (typically 7am-midnight visible).
- Events rendered as colored blocks positioned at their start time and sized by duration.
- All-day events in a horizontal strip above the time grid.
- Current time shown as a red horizontal line across the current day's column.
- The current day's column header is highlighted (blue circle on the date number).
- Day boundaries are vertical lines; hour boundaries are horizontal lines.
- Weekend columns can be dimmed or hidden.

**Temporal navigation:**
- Mini calendar in sidebar: clicking a date jumps the main view to that week.
- Previous/Next arrows in the top bar to move one period at a time.
- "Today" button to jump back to the current date.
- The mini calendar always shows the current month with the currently-viewed week highlighted.

**Visual hierarchy:**
- Event colors are the dominant visual differentiator (each calendar/category has its own color).
- Event titles are the primary text within each block.
- Time is encoded positionally (vertical position = time of day, block height = duration) rather than as explicit text.
- The current-time red line provides instant orientation: "where am I right now?"

**Key pattern: Positional encoding of time.** Rather than writing "9:00 AM - 11:00 AM" as text, Google Calendar encodes time as position and size on the grid. A 2-hour meeting at 9 AM is a block starting at the 9 AM row and spanning 2 rows of height. This makes duration and time-of-day instantly readable without reading text. For a timesheet, this pattern could show daily time distribution as colored bars rather than numbers.

---

## Synthesized Findings

### 1. Key Patterns Identified

| Pattern | Source Apps | Applicability to Chronolog |
|---------|-----------|---------------------------|
| **Content-first hierarchy** | Day One, Bear | High. Description/narrative should be the hero, not contract path or hours. |
| **Project color coding** | Toggl, Google Calendar, Fantastical | High. Each client/contract gets a persistent color that appears everywhere. |
| **Ambient metadata** | Day One | Medium. Auto-captured context (date, duration) shown subtly, not as primary data. |
| **Multiple views of same data** | Notion | Medium. Same time entries viewable as timeline (daily scroll), grid (weekly spreadsheet), or calendar (visual blocks). |
| **DayTicker / compact temporal nav** | Fantastical | High. A compact week strip replacing the full WeekListPanel -- shows Mon-Sun with per-day hour totals in minimal space. |
| **Template-based repetition** | Clockify, Harvest | Medium. "Copy last week" or saved templates for recurring project/task structures. |
| **Current-time indicator** | Google Calendar | High. A clear "you are here" marker for the current day and time. |
| **Grouped entries with day totals** | Toggl | High. Day headers with date + total hours, entries listed below each. Already partially implemented. |
| **Positional time encoding** | Google Calendar | Low-Medium. Could use bar widths or fill levels to show hours visually, but may be over-engineering for a text-based timesheet. |
| **Tag/category as sidebar nav** | Bear, Obsidian | Low. Chronolog already uses contracts for this; adding tags would be redundant. |

### 2. Visual Hierarchy Choices

**Journal/planner apps emphasize content over structure:**
- Day One: Entry text > date > metadata (weather, location)
- Bear: Note content > tags > date
- Obsidian: Note content > file structure > metadata

**Time tracking apps emphasize structure over content:**
- Harvest: Project/task > hours > notes (notes barely visible in weekly view)
- Clockify: Project/task > hours per day > (descriptions hidden behind hover)
- Toggl: Description > project (color-coded) > duration

**Calendar apps emphasize time position:**
- Google Calendar: Time position > event color > event title
- Fantastical: Event color > event title > time position

**The hybrid that serves Chronolog best:** Toggl's approach -- description as primary text, project identified by color rather than text dominance, duration as secondary right-aligned data. This lets the user scan "what did I work on?" rather than "which project bucket?" at a glance.

### 3. Temporal Organization Patterns

| Approach | Used By | Pros | Cons |
|----------|---------|------|------|
| **Continuous vertical scroll with day headers** | Toggl, Day One | Natural reading flow, no context switching | Can lose orientation in long lists |
| **Grid (rows = projects, cols = days)** | Harvest, Clockify | Efficient bulk entry, clear totals | Loses narrative/description, feels corporate |
| **Calendar grid (time-of-day axis)** | Google Cal, Fantastical, Toggl Calendar | Visual time distribution | Poor for variable-length descriptions |
| **Single-day focus with date nav** | Harvest (day view), Day One | Deep focus on one day | No weekly context visible |
| **Week-at-a-glance with drill-down** | Fantastical (DayTicker) | Compact overview + detail | Requires good day-level summaries |

**Best for Chronolog:** A hybrid approach:
- A compact "week strip" at the top (like Fantastical's DayTicker) showing Mon-Sun with per-day hour totals and client color proportions.
- Below it, a scrollable day-by-day breakdown (like Toggl's timer page) with entries grouped under day headers.
- The week strip serves as both orientation ("where am I in the week?") and navigation ("click Friday to jump to Friday's entries").

### 4. Entry Grouping Patterns

| Approach | Used By | When It Works |
|----------|---------|--------------|
| **By day (primary), then chronologically** | Toggl, Day One | When narrative/sequence matters. "What did I do today, in what order?" |
| **By project (primary), then by day** | Harvest weekly, Clockify | When billing/totals matter. "How many hours on Project X this week?" |
| **By day (primary), then by project** | Google Calendar (by calendar color) | When daily rhythm matters but project identity is needed. |
| **Flat chronological** | Bear | When there's no meaningful grouping beyond time. |

**Best for Chronolog:** **By day (primary), then by contract/project within each day.** This preserves the daily narrative flow while grouping related work visually. Within a day, entries for the same contract should be visually clustered (same color, grouped together) so the user can see "I spent the morning on Client A, then switched to Client B after lunch."

### 5. Navigation Patterns

| Pattern | Used By | Assessment for Chronolog |
|---------|---------|------------------------|
| **3-panel (sidebar + list + content)** | Bear, Day One, current Chronolog | Works well for notes mode. Problematic for time entries where Panel 2 is redundant. |
| **2-panel (sidebar + content)** | Notion, Harvest, Toggl | Better for time entries. Sidebar provides navigation, content area shows the detail. |
| **Top nav + single content area** | Harvest, Clockify, Toggl | Simple but loses persistent navigation context. |
| **DayTicker + scrollable detail** | Fantastical | Compact temporal nav without burning a full panel. |

**Best for Chronolog:** **Asymmetric panel use by mode.**
- **Notes mode:** Keep the 3-panel layout (sidebar + note list + editor). This is the correct pattern for document-browsing workflows.
- **Time entries mode:** Drop to a 2-panel layout. The sidebar remains for contract navigation and mode switching. Panel 2 (WeekListPanel) is replaced by an inline "week strip" component at the top of the content area, and the full content area becomes the time entry view. This reclaims 280px of horizontal space.

### 6. Warm/Journal Aesthetic vs. Corporate Time Tracker

| Element | Journal Apps (Warm) | Time Trackers (Corporate) | Recommendation |
|---------|-------------------|-------------------------|----------------|
| **Color palette** | Soft, warm tones. Blues, purples, creams. | Gray-50/white/black. Functional. | Use warm neutrals (stone/amber tints) instead of pure gray. |
| **Typography** | Variable sizes. Larger headings, comfortable line height. Serif or humanist sans. | Uniform small text. System sans-serif. | Use a slightly warmer font. Increase heading sizes for week/day headers. Add line height breathing room. |
| **Entry appearance** | Cards with personality. Photos, metadata, variable heights. | Uniform rows/cells. All entries identical. | Add client color accents (left border or dot). Allow description-first layouts with variable heights. |
| **Empty states** | Encouraging, friendly. "Start writing..." | Functional. "No entries." | Add contextual empty states: "Quiet day so far" or show the day's calendar events as prompts. |
| **Density** | Loose, breathable. White space is generous. | Dense, compact. Maximize data per pixel. | Find a middle ground. Time tracking needs scannability, but entries should breathe. |
| **Motion** | Smooth transitions, subtle animations. | Instant state changes. | Smooth scroll-to-day, gentle expand/collapse animations. Nothing flashy. |
| **Personalization** | Themes, custom fonts, custom colors. | Fixed design. | At minimum, let users assign colors to clients/contracts. Consider a light/dark mode. |

---

## Recommendations for Chronolog Redesign

### Best Patterns for a Solo Consultant Timesheet

1. **Eliminate WeekListPanel in time mode.** Replace with a compact "WeekStrip" component at the top of the content area. This strip shows Mon-Sun as a horizontal row, with each day displaying: day abbreviation, date number, total hours, and a color-proportioned bar showing client distribution. Clicking a day scrolls the detail view to that day. Current day is highlighted. This provides all the navigation value of the current WeekListPanel in approximately 48px of vertical space instead of 280px of horizontal space.

2. **Flip the entry visual hierarchy.** Make description the primary text element (larger, bolder). Show the contract/client as a secondary label with a colored dot/stripe. Display duration as a right-aligned quiet element. The question the user is answering when scanning entries is "what did I do?" not "which bucket did this go in?"

3. **Add client/contract color coding.** Assign each client or contract a color (user-configurable, with sensible defaults). Use this color as:
   - A left border on entry cards.
   - A colored dot next to the contract name.
   - Proportional fill in the WeekStrip's daily summary bars.
   - Background tint in the sidebar contract list.
   This single addition addresses the "all entries look identical" problem and borrows Toggl's strongest pattern.

4. **Emphasize "today" prominently.** The current day's section should have:
   - A distinct background tint (very subtle warm color).
   - A "Today" label next to the date in the day header.
   - The WeekStrip should highlight today's column (like Google Calendar's blue circle).
   - On app launch, the view should auto-scroll to today's section.

5. **Add weekly context summaries.** The week header should show:
   - Total hours (already present).
   - Hours by client (as colored segments in a horizontal bar or as a compact breakdown).
   - Status with more visual weight (badge/chip rather than plain text input).
   - Week number and date range.

6. **Warm up the palette.** Replace `gray-50`/`gray-200` with `stone-50`/`stone-200` (Tailwind's warm gray). Use `amber-50` or `orange-50` as the "today" background tint. Keep blue for interactive elements but warm the neutral base.

7. **Template / Copy Last Week.** Borrow from Clockify/Harvest: a "Copy last week's structure" button that pre-populates this week with the same project/task combinations (without hours). For a consultant with 3-5 recurring contracts, this eliminates Monday setup friction.

### Patterns to Avoid

1. **The spreadsheet grid (Harvest/Clockify weekly view).** A rows-as-projects, columns-as-days grid is efficient for bulk data entry but kills the narrative quality Chronolog aims for. It turns "I reviewed the API design and wrote feedback" into "2.5" in a cell. Solo consultants benefit from maintaining descriptive records, not just numbers.

2. **Calendar-style time-of-day grid (Toggl calendar, Google Calendar).** Encoding time entries as blocks on a time axis works for meetings and appointments but not for consulting work that may span irregular periods, be entered manually without precise start/end times, or involve overlapping contexts. It also requires more UI complexity (drag-resize, snap-to-grid) for minimal benefit.

3. **Full monthly calendar as primary nav.** A month calendar (like Google Calendar's sidebar) is too much temporal zoom for a weekly timesheet workflow. The user's primary concern is "this week" and "last week," not "February at a glance." A small monthly calendar could be a secondary navigation element but should not be the primary one.

4. **Tab-based view switching (Day/Week/Month tabs).** Adding tabs to switch between views creates cognitive overhead. A single continuous scroll view with a compact week strip is simpler and more discoverable than forcing users to choose a view mode.

5. **Dense corporate styling.** Harvest's "black-and-white" design where "everything looks the same" is a known user complaint. For a personal tool used daily, visual monotony creates fatigue. Avoid uniform gray-on-white-on-gray.

### Recommended Layout Direction

**A "journal-informed timesheet" that reads like a work diary but functions as a billing tool.**

The layout should follow this structure:

```
+------------------+------------------------------------------------+
|                  |                                                |
|  SIDEBAR         |  WEEK STRIP (compact, always visible)          |
|  (Panel 1)       |  [Mon 3] [Tue 4] [Wed 5*] [Thu 6] [Fri 7]    |
|                  |   3.5h    4.0h    2.5h      --      --         |
|  Contracts       |  ============================================  |
|  (color-coded)   |                                                |
|                  |  SCROLLABLE DAY SECTIONS                       |
|  - Client A      |                                                |
|  - Client B      |  Wednesday, Feb 5 -- TODAY          5.5 hrs    |
|  - Client C      |  +---------------------------------------+    |
|                  |  | * Reviewed API design feedback    2.0h |    |
|  [Timer Widget]  |  |   Client A - API Contract              |    |
|  (or floating)   |  +---------------------------------------+    |
|                  |  | * Wrote onboarding guide          1.5h |    |
|                  |  |   Client B - Onboarding                |    |
|                  |  +---------------------------------------+    |
|                  |  | [+ Add entry]                          |    |
|                  |  +---------------------------------------+    |
|                  |                                                |
|                  |  Tuesday, Feb 4                       4.0 hrs  |
|                  |  +---------------------------------------+    |
|                  |  | * Sprint planning session         1.5h |    |
|                  |  |   Client A - API Contract              |    |
|                  |  +---------------------------------------+    |
|                  |  ...                                           |
+------------------+------------------------------------------------+
```

**Key principles:**
- **2-panel in time mode**, 3-panel in notes mode. The WeekStrip replaces WeekListPanel as inline navigation.
- **Description-first entries.** The work narrative is the largest text. Contract/client shown smaller with a color accent.
- **Client colors everywhere.** Entry cards, sidebar, week strip summary bars.
- **Today is always obvious.** Background tint, label, auto-scroll.
- **Breathing room.** Entries are not packed edge-to-edge. Day sections have clear visual separation. The week strip is compact but not cramped.
- **The timer stays visible.** Either a persistent floating element or a top bar indicator when a timer is running, regardless of sidebar state.

This approach combines Toggl's description-first entries and project colors, Fantastical's compact temporal navigation strip, Day One's content-as-hero philosophy, Bear's warm minimalism, and the practical grid-totals awareness from Harvest/Clockify -- without adopting any single app's full layout wholesale.
