# Timesheet Redesign -- ASCII Wireframes

Sprint 012-UX. These wireframes define the new 2-panel time-entries layout that replaces the
current 3-panel Apple Notes style with a sidebar + content area arrangement. The middle column
(WeekListPanel) is eliminated in time mode and replaced by an inline WeekStrip at the top of
the content area.

**Palette note:** "Warm" throughout these wireframes means stone/warm gray tones (stone-50,
stone-200, amber-50 for today) rather than the current cool gray. Pure gray (#f9fafb) becomes
warm stone (#fafaf9). Blue accents remain for interactive elements.

---

## 1. Desktop Layout -- Full View (Primary)

The primary 2-panel layout for time entries mode. Sidebar is 240px, content fills the
remaining space (~960px on a 1200px screen).

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [=] Chronolog                                              ** 0:47:12 API review  Acme Corp **  │
├─────────────────────┬────────────────────────────────────────────────────────────────────────────┤
│                     │                                                                          │
│   Time Entries  <<  │  ◄ Week 21      May 19 -- May 25, 2026      Week 23 ►                    │
│                     │  ┌──────┬──────┬──────┬──────┬──────┬──────┬──────┐───────────────────────│
│  ─────────────────  │  │ Mon  │ Tue  │ Wed  │ Thu  │░░░░░░│ Sat  │ Sun  │  Total: 32.5h        │
│  CONTRACTS          │  │  19  │  20  │  21  │  22  │░ 23 ░│  24  │  25  │  [Draft ready]       │
│                     │  │ 7.5h │ 8.0h │ 6.5h │ 7.0h │░3.5h░│  --  │  --  │                      │
│  * Acme: API Integ  │  │▓▓▓▒▒│▓▓▓▓▒│▓▓▒▒▒│▓▓▓▒▒│░▓▓▒░░│      │      │  ▓ Acme  ▒ BigCo      │
│  * BigCo: Consult   │  └──────┴──────┴──────┴──────┴░░░░░░┴──────┴──────┘  ░ Startup           │
│  * Startup: MVP     │  ─────────────────────────────────────────────────────────────────────────│
│    Zeta: Audit      │                                                                          │
│                     │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│                     │  ░ Friday, May 23                            Today           3.5h      ░ │
│                     │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│  ─────────────────  │                                                                          │
│  New Contract       │  ┌─┬──────────────────────────────────────────────────────────────┬─────┐ │
│  Settings           │  │▓│ Reviewed endpoint auth for the payments API                 │     │ │
│                     │  │▓│ * Acme Corp / API Integration                               │2.0h │ │
│  ─────────────────  │  │▓│   Integration > Development                                 │     │ │
│                     │  └─┴──────────────────────────────────────────────────────────────┴─────┘ │
│  ┌───────────────┐  │                                                                          │
│  │ ** 0:47:12 ** │  │  ┌─┬──────────────────────────────────────────────────────────────┬─────┐ │
│  │ API review    │  │  │▒│ Weekly sync call with product team                          │     │ │
│  │ Acme Corp     │  │  │▒│ * BigCo / Consulting                                       │1.0h │ │
│  │               │  │  │▒│                                                             │     │ │
│  │ [Pause] [Stop]│  │  └─┴──────────────────────────────────────────────────────────────┴─────┘ │
│  └───────────────┘  │                                                                          │
│                     │  ┌─┬──────────────────────────────────────────────────────────────┬─────┐ │
│                     │  │░│ Set up CI pipeline and staging env                          │     │ │
│                     │  │░│ * Startup / MVP Build                                       │0.5h │ │
│                     │  │░│                                                             │     │ │
│                     │  └─┴──────────────────────────────────────────────────────────────┴─────┘ │
│                     │                                                                  [ + ]   │
│                     │                                                                          │
│                     │  ── Thursday, May 22 ──────────────────────────────────────────── 7.0h ── │
│                     │                                                                          │
│                     │  ┌─┬──────────────────────────────────────────────────────────────┬─────┐ │
│                     │  │▓│ Wrote integration tests for payment webhook handler         │     │ │
│                     │  │▓│ * Acme Corp / API Integration                               │4.0h │ │
│                     │  │▓│   Integration > Development                                 │     │ │
│                     │  └─┴──────────────────────────────────────────────────────────────┴─────┘ │
│                     │                                                                          │
│                     │  ┌─┬──────────────────────────────────────────────────────────────┬─────┐ │
│                     │  │▒│ Architecture review for data migration                      │     │ │
│                     │  │▒│ * BigCo / Consulting                                        │3.0h │ │
│                     │  │▒│   Advisory > Review                                         │     │ │
│                     │  └─┴──────────────────────────────────────────────────────────────┴─────┘ │
│                     │                                                                  [ + ]   │
│                     │                                                                          │
│                     │  ── Wednesday, May 21 ─────────────────────────────────────────── 6.5h ── │
│                     │                                                                          │
│                     │  ┌─┬──────────────────────────────────────────────────────────────┬─────┐ │
│                     │  │▓│ Designed retry logic for failed webhook deliveries           │     │ │
│                     │  │▓│ * Acme Corp / API Integration                               │3.5h │ │
│                     │  └─┴──────────────────────────────────────────────────────────────┴─────┘ │
│                     │  ...                                                                     │
└─────────────────────┴────────────────────────────────────────────────────────────────────────────┘
```

**Key design decisions:**

- **Top bar**: The persistent timer indicator lives in the top-right of the app chrome. It
  shows the pulsing dot, elapsed time, description snippet, and contract name. This stays
  visible regardless of sidebar state. The `[=]` hamburger on the left toggles the sidebar.
- **WeekStrip**: Sits at the very top of the content area, always visible (sticky). Each day
  column shows the abbreviation, date number, hours worked, and a small color proportion bar
  showing client mix. Today (Fri 23) is highlighted with a warm tinted background.
- **Description-first cards**: The work description is the first line in each entry card,
  rendered large and dark. The contract/client label is secondary (smaller, with color dot
  prefix). Duration is right-aligned and visually quiet. Deliverable/work type is the smallest
  text, only shown when set.
- **Left color border**: Each entry card has a 3px left border in the client's assigned color
  (shown here as block characters: `▓` = Acme, `▒` = BigCo, `░` = Startup).
- **Today section**: The current day gets a warm background tint and a "Today" label badge
  next to the date. It is always the first day section shown (most recent at top).
- **Day headers**: Lightweight horizontal rules with the date, optional "Today" badge, and
  daily total right-aligned. The `[ + ]` add button sits right-aligned below the last entry.
- **Sidebar**: Contracts have a color dot before the name (matching the entry border colors).
  The timer widget remains at the bottom of the sidebar as the full interactive control.

**Interactive elements:**
- `[=]` -- toggles sidebar (clickable)
- `◄` / `►` -- navigate to previous/next week (clickable)
- Day column cells in WeekStrip -- click to scroll content to that day section
- `[Draft ready]` -- click to cycle through status options (clickable chip)
- Entry card description -- click to edit inline
- Entry card contract label -- click to change contract/deliverable
- Entry card duration -- click to edit time
- `[ + ]` -- expand inline NewEntryRow for that day
- `[Pause]` / `[Stop]` -- timer controls

---

## 2. Desktop Layout -- Sidebar Collapsed

When the sidebar is collapsed to 0px, the content area expands to full width. The timer
indicator persists in the top bar.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [=]  Chronolog                                             ** 0:47:12 API review  Acme Corp **  │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                │
│  ◄ Week 21      May 19 -- May 25, 2026      Week 23 ►                                         │
│  ┌──────┬──────┬──────┬──────┬──────┬──────┬──────┐──────────────────────────────────────────── │
│  │ Mon  │ Tue  │ Wed  │ Thu  │░░░░░░│ Sat  │ Sun  │  Total: 32.5h  [Draft ready]               │
│  │  19  │  20  │  21  │  22  │░ 23 ░│  24  │  25  │                                            │
│  │ 7.5h │ 8.0h │ 6.5h │ 7.0h │░3.5h░│  --  │  --  │  ▓ Acme  ▒ BigCo  ░ Startup               │
│  │▓▓▓▒▒│▓▓▓▓▒│▓▓▒▒▒│▓▓▓▒▒│░▓▓▒░░│      │      │                                            │
│  └──────┴──────┴──────┴──────┴░░░░░░┴──────┴──────┘                                            │
│  ───────────────────────────────────────────────────────────────────────────────────────────── │
│                                                                                                │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│  ░ Friday, May 23                                                  Today           3.5h      ░ │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│                                                                                                │
│  ┌─┬─────────────────────────────────────────────────────────────────────────────────────┬─────┐│
│  │▓│ Reviewed endpoint auth for the payments API                                       │     ││
│  │▓│ * Acme Corp / API Integration                                                     │2.0h ││
│  │▓│   Integration > Development                                                       │     ││
│  └─┴─────────────────────────────────────────────────────────────────────────────────────┴─────┘│
│                                                                                                │
│  ┌─┬─────────────────────────────────────────────────────────────────────────────────────┬─────┐│
│  │▒│ Weekly sync call with product team                                                │     ││
│  │▒│ * BigCo / Consulting                                                              │1.0h ││
│  └─┴─────────────────────────────────────────────────────────────────────────────────────┴─────┘│
│                                                                                                │
│  ┌─┬─────────────────────────────────────────────────────────────────────────────────────┬─────┐│
│  │░│ Set up CI pipeline and staging env                                                │     ││
│  │░│ * Startup / MVP Build                                                             │0.5h ││
│  └─┴─────────────────────────────────────────────────────────────────────────────────────┴─────┘│
│                                                                                        [ + ]   │
│                                                                                                │
│  ── Thursday, May 22 ───────────────────────────────────────────────────────────────── 7.0h ──  │
│  ...                                                                                           │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Rationale:**

- The timer indicator in the top bar is the critical design element here. When the sidebar is
  collapsed, the full TimerWidget (with Pause/Stop buttons and contract select) is hidden, but
  the running state is always visible in the top bar. Clicking the top-bar indicator could
  re-expand the sidebar or open a mini popover with timer controls.
- Content area stretches to fill the full width, giving entry cards more horizontal breathing
  room. The WeekStrip also expands, but its 7-column grid keeps a consistent rhythm.
- The `[=]` hamburger icon remains in the top-left corner for re-opening the sidebar.

---

## 3. WeekStrip Close-Up

Detailed breakdown of the WeekStrip component. This replaces the entire WeekListPanel (the
old Panel 2) with a compact horizontal strip.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                               │
│  ◄  Week 22  ·  May 19 -- May 25, 2026                                          Week 24  ►   │
│                                                                                               │
│  ┌────────┬────────┬────────┬────────┬░░░░░░░░┬────────┬────────┐                             │
│  │  Mon   │  Tue   │  Wed   │  Thu   │░ Fri  ░│  Sat   │  Sun   │    Week total               │
│  │   19   │   20   │   21   │   22   │░  23  ░│   24   │   25   │    ═══════════              │
│  │        │        │        │        │░      ░│        │        │    32.5 hrs                  │
│  │  7.5h  │  8.0h  │  6.5h  │  7.0h  │░ 3.5h ░│   --   │   --   │                             │
│  │        │        │        │        │░      ░│        │        │    [Draft ready ▼]           │
│  │ ▓▓▓▓▒▒│ ▓▓▓▓▓▒│ ▓▓▒▒░░│ ▓▓▓▒▒░│░▓▓▒▒░░░│        │        │                             │
│  │        │        │        │        │░      ░│        │        │    ▓ Acme     19.5h          │
│  └────────┴────────┴────────┴────────┴░░░░░░░░┴────────┴────────┘    ▒ BigCo     9.0h          │
│                                                                      ░ Startup   4.0h          │
│                                        ▲                                                      │
│                                   click to                                                    │
│                                   scroll to                                                   │
│                                   this day                                                    │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Component anatomy:**

```
     Week navigation row
     ├── ◄ button (go to previous week)
     ├── "Week NN" label + date range ("May 19 -- May 25, 2026")
     └── ► button (go to next week)

     Day columns (Mon--Sun)
     ├── Day abbreviation (Mon, Tue, Wed, ...)
     ├── Date number (19, 20, 21, ...)
     ├── Per-day hour total (7.5h, 8.0h, ...)
     │   └── "--" for days with no entries (future or empty)
     └── Color proportion bar
         ├── Horizontal bar split proportionally by client
         ├── Each client's segment uses their assigned color
         └── Empty if no entries that day

     Week summary (right of grid)
     ├── Week total hours (bold, large)
     ├── Status badge (clickable chip/dropdown)
     │   └── Options: Unsubmitted, Draft ready, Submitted
     │   └── Chip color: gray (unsubmitted), amber (draft), green (submitted)
     └── Client legend
         ├── Color swatch + client name + client total for the week
         └── One row per active client
```

**Design decisions:**

- **Today highlighting**: The current day column gets a warm background tint (amber-50/stone
  warm) that extends the full height of the column. The day abbreviation may also show
  "Today" as a subscript or replace the abbreviation entirely.
- **Color proportion bars**: Each day has a small horizontal bar at the bottom of its cell.
  The bar is split proportionally by client hours. This gives an at-a-glance sense of which
  clients dominated each day. If a day has only one client, the bar is a single solid color.
- **Status badge as chip**: Replaces the old inline text input. Clicking opens a dropdown with
  3 options (Unsubmitted / Draft ready / Submitted). The chip is color-coded: gray bg for
  unsubmitted, amber for draft, green for submitted.
- **Click-to-scroll**: Clicking any day column smoothly scrolls the content area below to that
  day's section. This replaces the old WeekListPanel's scroll-to-week behavior with a more
  granular scroll-to-day.
- **Week navigation**: Simple prev/next arrows. The center label shows the ISO week number
  and the Monday-to-Sunday date range. Navigating weeks replaces the content below entirely
  (loads that week's entries). "This week" is the default on app load.

---

## 4. Day Section Detail

Detailed wireframe of a single day's entry list, showing the description-first card hierarchy,
"Today" styling, and the inline add flow.

### 4a. Today Section (with warm background)

```
 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
 ░                                                                                           ░
 ░  Friday, May 23                                            Today                  3.5h    ░
 ░  ─────────────────────────────────────────────────────────────────────────────────────────  ░
 ░                                                                                           ░
 ░  ┌─┬───────────────────────────────────────────────────────────────────────────┬──────┐    ░
 ░  │▓│                                                                         │      │    ░
 ░  │▓│  Reviewed endpoint auth for the payments API                            │      │    ░
 ░  │▓│                                                                         │ 2.0h │    ░
 ░  │▓│  * Acme Corp / API Integration                                         │      │    ░
 ░  │▓│    Integration > Development                                            │9-11a │    ░
 ░  │▓│                                                                         │      │    ░
 ░  └─┴───────────────────────────────────────────────────────────────────────────┴──────┘    ░
 ░                                                                                           ░
 ░  ┌─┬───────────────────────────────────────────────────────────────────────────┬──────┐    ░
 ░  │▒│                                                                         │      │    ░
 ░  │▒│  Weekly sync call with product team                                     │      │    ░
 ░  │▒│                                                                         │ 1.0h │    ░
 ░  │▒│  * BigCo / Consulting                                                   │      │    ░
 ░  │▒│                                                                         │      │    ░
 ░  └─┴───────────────────────────────────────────────────────────────────────────┴──────┘    ░
 ░                                                                                           ░
 ░  ┌─┬───────────────────────────────────────────────────────────────────────────┬──────┐    ░
 ░  │░│                                                                         │      │    ░
 ░  │░│  Set up CI pipeline and staging env                                     │      │    ░
 ░  │░│                                                                         │ 0.5h │    ░
 ░  │░│  * Startup / MVP Build                                                  │      │    ░
 ░  │░│    MVP > Development                                                    │      │    ░
 ░  │░│                                                                         │      │    ░
 ░  └─┴───────────────────────────────────────────────────────────────────────────┴──────┘    ░
 ░                                                                                           ░
 ░                                                                               [ + Add ]   ░
 ░                                                                                           ░
 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
```

### 4b. Entry Card Anatomy

```
 ┌─┬───────────────────────────────────────────────────────────────────────┬──────────┐
 │ │                                                                     │          │
 │C│  Description text goes here (primary, 15px, stone-900)              │          │
 │O│  This is the hero text -- what the person actually did              │ 2.5h     │
 │L│                                                                     │ 9:00-    │
 │O│  * Client / Contract (secondary, 13px, stone-500)                   │ 11:30a   │
 │R│    Deliverable > Work Type (tertiary, 12px, stone-400)              │          │
 │ │                                                                     │ stone-400│
 │ │                                                                     │ text     │
 └─┴───────────────────────────────────────────────────────────────────────┴──────────┘
  │                              │                                            │
  │                              │                                            │
  3px left border                Click to edit                        Right-aligned,
  in client color                description inline                   quiet weight.
                                                                      Shows duration
                                 Click contract line                  always. If entry
                                 to change contract/                  has start+end,
                                 deliverable                          shows times below
                                                                      in even smaller
                                 Click deliverable line               text.
                                 to change work type
```

**Text hierarchy (largest to smallest):**

1. **Description** -- 15px, font-weight 500, stone-900. The primary content. If empty, shows
   italic placeholder "Add description..." in stone-400.
2. **Contract label** -- 13px, font-weight 400, stone-500. Prefixed with a small filled circle
   in the client's color. Format: "Client Name / Contract Name".
3. **Deliverable/Work Type** -- 12px, font-weight 400, stone-400. Only shown when set. Format:
   "Deliverable > Work Type". Indented slightly under the contract line.
4. **Duration** -- 14px, font-weight 400, stone-400, right-aligned. Shows "2.5h" as the
   primary time. If entry has explicit start/end times, shows "9:00-11:30a" below in 11px.

### 4c. Inline NewEntryRow (expanded after clicking [ + ])

```
 ── Friday, May 23 ──────────────────────────────────── Today ────── 3.5h ──

  (existing entries above...)

  ┌─────────────────────────────────────────────────────────────────────────┐
  │                                                                       │
  │  What did you work on?                                                │
  │  ┌─────────────────────────────────────────────────────────────────┐   │
  │  │                                                            ... │   │
  │  └─────────────────────────────────────────────────────────────────┘   │
  │                                                                       │
  │  ┌─── Contract ──────────┐  ┌── Deliverable ────────┐  ┌── Time ──┐  │
  │  │ Select contract...  ▼ │  │ (auto-populated)    ▼ │  │ 2h30m    │  │
  │  └───────────────────────┘  └───────────────────────┘  └──────────┘  │
  │                                                                       │
  │                                              [ Cancel ]  [ Save ]     │
  │                                                                       │
  └─────────────────────────────────────────────────────────────────────────┘
```

**Improvements from current NewEntryRow:**

- Description input is first (top, full-width), matching the description-first hierarchy.
- Contract, Deliverable, and Time inputs are in a horizontal row below.
- Deliverable select is now included (currently missing from NewEntryRow).
- Cancel and Save buttons are explicit (current uses "x" icon only).
- The form sits at the bottom of the day's entries, pushing content up rather than inserting
  below the day header.

**Interactive elements:**
- Description text -- click to edit (shows text input or textarea)
- Contract label (`*`) -- click to show ContractSelect dropdown
- Deliverable/Work Type line -- click to show DeliverableSelect dropdown
- Duration -- click to edit (accepts "2h30m", "2.5h", "9:00-11:30" formats)
- `[ + Add ]` -- expands the NewEntryRow form below the last entry
- Long-press or right-click on card -- shows delete option (or swipe-to-delete on mobile)
- Hover over card -- reveals a subtle `x` delete button in top-right corner

---

## 5. Week Header Detail

The week header appears at the boundary between weeks when scrolling through the content area.
It doubles as a summary bar and a navigation anchor.

### 5a. Standard Week Header

```
 ┌─────────────────────────────────────────────────────────────────────────────────────────────┐
 │                                                                                           │
 │  Week 21  ·  May 12 -- May 18                                                            │
 │                                                                                           │
 │  37.5 hrs        ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒▒▒▒▒▒▒▒░░░░░           [Submitted ✓]                   │
 │                  Acme 22h       BigCo 11h  Start 4.5h                                     │
 │                                                                                           │
 └─────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Component anatomy:**

```
  Week Header
  ├── Week number + date range (left-aligned, bold)
  │   └── "Week 21  ·  May 12 -- May 18"
  │
  ├── Total hours (left, large, bold)
  │   └── "37.5 hrs"
  │
  ├── Client breakdown bar (center, horizontal stacked bar)
  │   ├── Each segment proportional to client hours
  │   ├── Colored with client color
  │   └── Labels below: "Acme 22h    BigCo 11h    Start 4.5h"
  │
  └── Status badge (right, chip)
      ├── [Submitted ✓] -- green chip with checkmark
      ├── [Draft ready] -- amber chip
      └── [Unsubmitted] -- stone/gray chip
      └── Click to cycle or open dropdown
```

### 5b. Month Transition Divider

When a week crosses a month boundary (or when scrolling past a month change), a subtle month
divider appears between weeks.

```

 ── Thursday, May 1 ──────────────────────────────────────────────────────── 6.0h ──

  (entries for May 1...)

 ═══════════════════════════════════════════════════════════════════════════════════
                                   April 2026
 ═══════════════════════════════════════════════════════════════════════════════════

 ── Wednesday, April 30 ──────────────────────────────────────────────────── 7.5h ──

  (entries for April 30...)
```

**Rationale:**

- The month divider uses double-line box drawing (`═`) to distinguish it from the lighter
  single-line day separators. It is purely decorative/navigational -- it does not affect data
  grouping (weeks are still the primary unit).
- The month name is centered. No additional data is shown on the month divider -- aggregate
  monthly stats belong in a reporting view, not the daily journal.
- This divider only appears within a week that crosses a month boundary. It does not appear
  between weeks that fall entirely within one month.

### 5c. Current Week Header (Special Treatment)

The current week gets a slightly different header treatment to distinguish it from past weeks:

```
 ┌─────────────────────────────────────────────────────────────────────────────────────────────┐
 │                                                                                           │
 │  This Week  ·  Week 23  ·  May 19 -- May 25                                              │
 │                                                                                           │
 │  32.5 hrs / ~40     ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒▒▒▒▒▒░░░░        ·····    [Draft ready ▼]            │
 │                     Acme 19.5h   BigCo 9h  Start 4h   remaining                          │
 │                                                                                           │
 └─────────────────────────────────────────────────────────────────────────────────────────────┘
```

- "This Week" label replaces the plain week number.
- A "/ ~40" soft target indicator next to the total (configurable hours-per-week target).
- The client breakdown bar shows the same proportional fill, but the unfilled portion uses
  a dotted pattern to suggest "remaining capacity."
- Status defaults to "Draft ready" for the current week (user can change).

---

## 6. Mobile Layout -- Time Entries Mode

On screens < 1024px, the layout collapses to single-panel push/pop navigation. The WeekStrip
adapts to a vertical arrangement.

### Level 0: Sidebar (Contracts + Timer)

```
 ┌──────────────────────────────────┐
 │  Chronolog            ** 0:47 ** │
 ├──────────────────────────────────┤
 │                                  │
 │  [ Time Entries ]                │
 │                                  │
 │  ──────────────────────────────  │
 │  CONTRACTS                       │
 │                                  │
 │  ▓ Acme: API Integration         │
 │  ▒ BigCo: Consulting             │
 │  ░ Startup: MVP Build            │
 │    Zeta: Audit                   │
 │                                  │
 │  ──────────────────────────────  │
 │  New Contract                    │
 │  Settings                        │
 │  ──────────────────────────────  │
 │                                  │
 │  ┌──────────────────────────┐    │
 │  │ ** 0:47:12 **            │    │
 │  │ API review               │    │
 │  │ Acme Corp                │    │
 │  │                          │    │
 │  │ [Pause]       [Stop]     │    │
 │  └──────────────────────────┘    │
 │                                  │
 └──────────────────────────────────┘
```

### Level 1: Week Overview (WeekStrip + Day List)

Tapping "Time Entries" advances to Level 1, which shows the WeekStrip and a summary list of
days for the selected week.

```
 ┌──────────────────────────────────┐
 │  ← Back               ** 0:47 **│
 ├──────────────────────────────────┤
 │                                  │
 │  ◄ Wk 22     May 19-25   Wk 24 ►│
 │                                  │
 │  ┌────┬────┬────┬────┬░░░░┬────┐ │
 │  │ M  │ T  │ W  │ Th │░Fr░│ Sa │ │
 │  │ 19 │ 20 │ 21 │ 22 │░23░│ 24 │ │
 │  │7.5 │8.0 │6.5 │7.0 │░3.5│ -- │ │
 │  │▓▓▒▒│▓▓▓▒│▓▒▒░│▓▓▒░│░▓▒░│    │ │
 │  └────┴────┴────┴────┴░░░░┴────┘ │
 │  Sun is hidden (no entries)      │
 │                                  │
 │  Total: 32.5h  [Draft ready ▼]  │
 │                                  │
 │  ──────────────────────────────  │
 │                                  │
 │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
 │  ░ Fri 23       Today     3.5h ░│
 │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
 │       3 entries  ▓▓▒░       ►   │
 │                                  │
 │  ──────────────────────────────  │
 │  Thu 22                   7.0h   │
 │       2 entries  ▓▓▒        ►   │
 │                                  │
 │  ──────────────────────────────  │
 │  Wed 21                   6.5h   │
 │       3 entries  ▓▒░        ►   │
 │                                  │
 │  ──────────────────────────────  │
 │  Tue 20                   8.0h   │
 │       2 entries  ▓▓         ►   │
 │                                  │
 │  ──────────────────────────────  │
 │  Mon 19                   7.5h   │
 │       3 entries  ▓▓▒        ►   │
 │                                  │
 └──────────────────────────────────┘
```

**Rationale:**

- On mobile the WeekStrip stays horizontal (it fits in ~375px with compact 1-letter
  abbreviations and tighter spacing). Sunday is hidden when it has no entries to save space.
- Below the strip, days are listed vertically as tappable rows, newest first. Each row shows
  the date, entry count, a mini color bar, and a `►` chevron indicating drill-down.
- Tapping a day row advances to Level 2.
- Today is highlighted with a warm background tint, matching the desktop treatment.
- The timer indicator appears in the top-right of the header bar (compact: just elapsed time).

### Level 2: Day Detail View

```
 ┌──────────────────────────────────┐
 │  ← Back  Fri 23        ** 0:47 **│
 ├──────────────────────────────────┤
 │                                  │
 │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
 │  ░ Friday, May 23    Today 3.5h░ │
 │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
 │                                  │
 │  ┌─┬────────────────────┬──────┐ │
 │  │▓│ Reviewed endpoint  │      │ │
 │  │▓│ auth for the       │ 2.0h │ │
 │  │▓│ payments API       │      │ │
 │  │▓│                    │ 9-11a│ │
 │  │▓│ * Acme / API Integ │      │ │
 │  │▓│   Integ > Dev      │      │ │
 │  └─┴────────────────────┴──────┘ │
 │                                  │
 │  ┌─┬────────────────────┬──────┐ │
 │  │▒│ Weekly sync call   │      │ │
 │  │▒│ with product team  │ 1.0h │ │
 │  │▒│                    │      │ │
 │  │▒│ * BigCo / Consult  │      │ │
 │  └─┴────────────────────┴──────┘ │
 │                                  │
 │  ┌─┬────────────────────┬──────┐ │
 │  │░│ Set up CI pipeline │      │ │
 │  │░│ and staging env    │ 0.5h │ │
 │  │░│                    │      │ │
 │  │░│ * Startup / MVP    │      │ │
 │  │░│   MVP > Dev        │      │ │
 │  └─┴────────────────────┴──────┘ │
 │                                  │
 │  ┌──────────────────────────────┐│
 │  │      [ + Add Entry ]         ││
 │  └──────────────────────────────┘│
 │                                  │
 └──────────────────────────────────┘
```

**Mobile-specific decisions:**

- Entry cards use full width of the screen. Description text may wrap to 2-3 lines.
- Duration is still right-aligned but the column is narrower.
- Tapping an entry card opens it for inline editing (same behavior as desktop).
- The `[ + Add Entry ]` button is a full-width button at the bottom, more discoverable than
  the desktop's subtle `[ + ]` icon.
- Swipe-left on a card reveals a red "Delete" action (iOS-style).
- The timer indicator in the header bar is always visible.

---

## 7. Empty States

### 7a. Day with No Entries (within a week that has other entries)

```
 ── Saturday, May 24 ──────────────────────────────────────────────────────── 0h ──

  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
  │                                                                           │
        No entries for Saturday.                              [ + Add ]
  │                                                                           │
  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

- Dashed border indicates an empty container. Light stone-300 text.
- The `[ + Add ]` button is always visible, inviting the user to log work.
- This section is compact -- just enough to acknowledge the day exists without wasting space.

### 7b. Completely Empty Week

```
 ┌─────────────────────────────────────────────────────────────────────────────────────────────┐
 │                                                                                           │
 │  Week 20  ·  May 5 -- May 11                                                             │
 │                                                                                           │
 │  0 hrs                                                        [Unsubmitted]               │
 │                                                                                           │
 └─────────────────────────────────────────────────────────────────────────────────────────────┘

  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
  │                                                                                         │
                           Nothing logged this week.
  │                                                                                         │
             Were you on holiday? You can collapse this week.
  │                                                                                         │
                                   [ Collapse ]
  │                                                                                         │
  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

- The week header still shows (so the user knows which week it is) but the body area uses a
  dashed border and a friendly message. No individual day sections are rendered.
- The "Collapse" button hides the empty week body, leaving just the header line (like the
  current collapsible behavior but with friendlier copy).
- Collapsed state shows: `Week 20 · May 5-11 ── No entries ── [Expand]`

### 7c. First-Time App (No Entries at All)

```
 ┌─────────────────────────────────────────────────────────────────────────────────────────────┐
 │  [=]  Chronolog                                                                            │
 ├──────────────────────┬──────────────────────────────────────────────────────────────────────┤
 │                      │                                                                    │
 │  Time Entries    <<  │                                                                    │
 │                      │                                                                    │
 │  ─────────────────── │                                                                    │
 │  CONTRACTS           │                                                                    │
 │                      │                                                                    │
 │  (empty)             │          Welcome to Chronolog                                      │
 │                      │                                                                    │
 │                      │          Start by adding a client and contract                     │
 │                      │          in Settings, then come back here to                       │
 │                      │          log your first day.                                       │
 │                      │                                                                    │
 │                      │          ┌─────────────────────────┐                               │
 │  ─────────────────── │          │   Go to Settings ►      │                               │
 │  Settings            │          └─────────────────────────┘                               │
 │  ─────────────────── │                                                                    │
 │                      │          Or start a timer right now and                             │
 │  ┌────────────────┐  │          assign a contract later.                                  │
 │  │                │  │                                                                    │
 │  │ [Start Timer]  │  │          ┌─────────────────────────┐                               │
 │  │ [Add Entry]    │  │          │   Start Timer ►         │                               │
 │  │                │  │          └─────────────────────────┘                               │
 │  └────────────────┘  │                                                                    │
 │                      │                                                                    │
 └──────────────────────┴──────────────────────────────────────────────────────────────────────┘
```

- The content area shows a centered welcome message with two clear calls to action.
- No WeekStrip is shown (nothing to summarize). The strip appears once the first entry exists.
- The sidebar still shows the Timer Widget so the user can start immediately.
- Friendly, warm tone: "Welcome to Chronolog" rather than "No data found."

### 7d. New Week (Monday Morning, Nothing Logged Yet)

```
 ◄ Week 22      May 26 -- Jun 1, 2026      Week 24 ►
 ┌────────┬────────┬────────┬────────┬────────┬────────┬────────┐
 │  Mon   │  Tue   │  Wed   │  Thu   │  Fri   │  Sat   │  Sun   │    Week total
 │   26   │   27   │   28   │   29   │   30   │   31   │    1   │    ═══════════
 │        │        │        │        │        │        │        │    0 hrs
 │   --   │   --   │   --   │   --   │   --   │   --   │   --   │
 │        │        │        │        │        │        │        │    [Unsubmitted]
 │        │        │        │        │        │        │        │
 └────────┴────────┴────────┴────────┴────────┴────────┴────────┘

 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
 ░ Monday, May 26                                            Today           0h    ░
 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
  │                                                                               │
         Good morning! Ready to start the week?
  │                                                                               │
                                                                    [ + Add ]
  │                                                                               │
  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

- The WeekStrip shows but with all `--` dashes (no hours yet). Today's column is still
  highlighted with the warm tint.
- Only today's day section is rendered (future days are hidden).
- The empty state uses a contextual greeting: "Good morning!" (or "Good afternoon!" based on
  time of day). This adds warmth without being saccharine.
- The `[ + Add ]` button is prominent, inviting the first entry of the week.

---

## 8. Timer Indicator States

The timer system has two display locations:
1. **Sidebar widget** (full controls) -- visible when sidebar is expanded
2. **Top bar indicator** (compact) -- always visible, including when sidebar is collapsed

### 8a. No Timer Running

```
 Top bar:
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │  [=]  Chronolog                                                             │
 └──────────────────────────────────────────────────────────────────────────────┘
    Nothing shown in the timer area. The top bar is clean.

 Sidebar widget:
 ┌───────────────────────┐
 │                       │
 │  [ Start Timer ]      │
 │  [ Add Entry   ]      │
 │                       │
 └───────────────────────┘
```

### 8b. Timer Running

```
 Top bar:
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │  [=]  Chronolog                                     ** 1:23:45  API review **│
 └──────────────────────────────────────────────────────────────────────────────┘
                                                       ^^
                                                 pulsing green dot
                                                 (CSS animation,
                                                  slow 2s pulse)

 Sidebar widget:
 ┌───────────────────────┐
 │  ** 1:23:45 **        │
 │  API review           │
 │  Acme Corp            │
 │                       │
 │  ┌─────────┐ ┌──────┐ │
 │  │  Pause  │ │ Stop │ │
 │  └─────────┘ └──────┘ │
 │                       │
 │  Contract             │
 │  ┌─────────────────┐  │
 │  │ Acme: API Int ▼ │  │
 │  └─────────────────┘  │
 │                       │
 │  Description          │
 │  ┌─────────────────┐  │
 │  │ API review      │  │
 │  │                 │  │
 │  └─────────────────┘  │
 └───────────────────────┘
```

**Top bar indicator anatomy:**

```
 ┌──────────────────────────────────────────────┐
 │  ●  1:23:45  API review  ·  Acme Corp       │
 │  │    │         │              │             │
 │  │    │         │              └── contract  │
 │  │    │         └── description (truncated)  │
 │  │    └── elapsed time (HH:MM:SS)           │
 │  └── pulsing green dot (2s CSS animation)   │
 └──────────────────────────────────────────────┘
```

- Clicking the top bar indicator when the sidebar is collapsed opens the sidebar.
- The indicator uses a warm-toned background (stone-100) with a subtle left border in the
  client's color to visually connect the timer to its contract.

### 8c. Timer Paused

```
 Top bar:
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │  [=]  Chronolog                              ○  1:23:45 (paused) API review │
 └──────────────────────────────────────────────────────────────────────────────┘
                                                ^^
                                          hollow dot (not pulsing)
                                          "(paused)" label in stone-400

 Sidebar widget:
 ┌───────────────────────┐
 │  ** 1:23:45 **        │
 │  (paused)             │
 │  API review           │
 │  Acme Corp            │
 │                       │
 │  ┌─────────┐ ┌──────┐ │
 │  │ Resume  │ │ Stop │ │
 │  └─────────┘ └──────┘ │
 │                       │
 │  Contract             │
 │  ┌─────────────────┐  │
 │  │ Acme: API Int ▼ │  │
 │  └─────────────────┘  │
 │                       │
 │  Description          │
 │  ┌─────────────────┐  │
 │  │ API review      │  │
 │  │                 │  │
 │  └─────────────────┘  │
 └───────────────────────┘
```

- The dot changes from a filled pulsing green (`●`) to a hollow static circle (`○`).
- The elapsed time is still displayed but no longer incrementing.
- "(paused)" appears next to the time in the top bar indicator.
- Pause button changes to "Resume" in the sidebar widget.

### 8d. Sidebar Collapsed -- Timer Running

```
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │  [=]  Chronolog                                    ** 1:23:45  API review ** │
 ├──────────────────────────────────────────────────────────────────────────────┤
 │                                                                            │
 │  ◄ Week 22      May 19 -- May 25, 2026      Week 24 ►                     │
 │  ┌──────┬──────┬──────┬──────┬──────┬──────┬──────┐                        │
 │  ...                                                                       │
 └──────────────────────────────────────────────────────────────────────────────┘

 The top bar indicator is the ONLY timer visibility when the sidebar is
 collapsed. It must provide enough information for the user to know:
   1. A timer is running (green pulsing dot)
   2. How long it has been running (1:23:45)
   3. What they are working on (description + contract)

 Clicking the indicator expands the sidebar so the user can access
 Pause/Stop controls and edit the contract/description.
```

### 8e. State Transition Diagram

```
           ┌─────────────────────────────────────┐
           │                                     │
           ▼                                     │
     ┌───────────┐    Start    ┌───────────┐     │
     │           │ ──────────► │           │     │
     │   Idle    │             │  Running  │◄──┐ │
     │           │             │           │   │ │
     └───────────┘             └─────┬─────┘   │ │
           ▲                         │         │ │
           │                    Pause│    Resume│ │
           │                         │         │ │
           │                         ▼         │ │
           │                   ┌───────────┐   │ │
           │                   │           │   │ │
           │                   │  Paused   │───┘ │
           │                   │           │     │
           │                   └─────┬─────┘     │
           │                         │           │
           │                    Stop │ (from     │
           │                         │ Running   │
           │                         │ or Paused)│
           │                         ▼           │
           │                   ┌───────────┐     │
           │     Discard       │           │     │
           │◄──────────────────│  Stopped  │     │
           │                   │           │     │
           │                   └─────┬─────┘     │
           │                         │           │
           │        Save             │           │
           │◄────────────────────────┘           │
           │                                     │
           │             (timer resets            │
           │              to idle)               │
           └─────────────────────────────────────┘
```

**Top bar indicator visibility by state:**

| Timer State | Top Bar Shows | Sidebar Widget Shows |
|-------------|---------------|----------------------|
| Idle | Nothing | Start Timer + Add Entry buttons |
| Running | `● 1:23:45 API review · Acme` | Full controls (Pause/Stop + fields) |
| Paused | `○ 1:23:45 (paused) API review` | Full controls (Resume/Stop + fields) |
| Stopped | Nothing (completion form is in sidebar) | TimerCompletionForm |

---

## Appendix: Color Assignments

Client colors should be drawn from a warm, distinguishable palette. Suggested defaults for
the first 5 clients:

```
 Client 1:  ▓  #b45309  (amber-700)    -- warm brown-amber
 Client 2:  ▒  #0369a1  (sky-700)      -- calm blue
 Client 3:  ░  #15803d  (green-700)    -- natural green
 Client 4:  ▐  #7e22ce  (purple-700)   -- soft purple
 Client 5:  █  #be123c  (rose-700)     -- muted rose
```

Colors are assigned automatically on client creation (cycling through the palette) and can
be overridden in Settings. The same color is used for:
- Left border on entry cards
- Color dot in sidebar contract list
- Proportion segments in WeekStrip day bars
- Client breakdown bar in Week Headers
- Mini color bars on mobile day list rows

---

## Appendix: Responsive Breakpoints

| Breakpoint | Layout | Panel Behavior |
|------------|--------|----------------|
| >= 1024px | Desktop 2-panel | Sidebar (240px, collapsible) + Content (fills remaining) |
| < 1024px | Mobile single-panel | Push/pop: Sidebar -> Week Overview -> Day Detail |

The transition from 3-panel to 2-panel (eliminating WeekListPanel) only affects time-entries
mode. Notes mode retains the existing 3-panel layout (sidebar + note list + editor)
unchanged.
