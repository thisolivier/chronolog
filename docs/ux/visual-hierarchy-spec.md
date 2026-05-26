# Visual Hierarchy Specification

Design specification for the Chronolog timesheet redesign. Every visual decision documented here serves a specific purpose: making the daily experience of time-tracking feel like reviewing a work journal rather than filling in a spreadsheet.

This document specifies colors, typography, spacing, and interactive states using Tailwind CSS classes. It replaces the current gray-50/gray-200/white + blue-600 palette with a warm, client-color-coded system where the work description is the hero element.

---

## 1. Color System

### Base Palette (Warm Neutrals)

The current gray-* scale is replaced with Tailwind's `stone-*` scale throughout the app. Stone uses a warm undertone (slight yellow/brown) instead of pure neutral gray, giving the interface a journal-like warmth without sacrificing readability.

| Role | Old Class | New Class | Why |
|------|-----------|-----------|-----|
| Page background | `bg-gray-50` | `bg-stone-50` | Warm base that makes white cards pop without the clinical feel of pure gray-50. |
| Card background | `bg-white` | `bg-white` | White stays. Cards need to be the brightest element to draw the eye. Stone-50 behind them creates enough contrast. |
| Card border | `border-gray-200` | `border-stone-200` | Warm borders that blend with the stone background rather than creating harsh lines. |
| Divider lines | `border-gray-100` | `border-stone-200` | Slightly more visible than the card borders to act as section separators. |
| Text primary | `text-gray-900` | `text-stone-900` | Near-black with warm undertone. Used for entry descriptions and day headers. |
| Text secondary | `text-gray-600` | `text-stone-600` | Contract labels, metadata, secondary information. |
| Text muted | `text-gray-400` | `text-stone-400` | Timestamps, empty states, placeholder text. |
| Input border | `border-gray-300` | `border-stone-300` | Form inputs and editable field borders. |
| Hover background | `hover:bg-gray-50` | `hover:bg-stone-100` | Subtle warmth on hover states. |

### "Today" Accent Color

| Role | Class | Why |
|------|-------|-----|
| Today section background | `bg-amber-50/60` | A very light amber wash (60% opacity) that says "this is now" without overwhelming the content. Amber is warm and natural -- it reads as "sunlight on today's page" rather than a clinical highlight. |
| Today header text accent | `text-amber-700` | The "Today" label uses this to tie back to the background tint. |
| Today WeekStrip highlight | `bg-amber-100` with `border-b-2 border-amber-400` | The current day's column in the WeekStrip gets a bottom border accent and background tint. |

### Interactive Color (Blue)

Blue is kept for interactive elements. It is the universal signifier for "this is clickable" and changing it would sacrifice learned behavior.

| Role | Class | Why |
|------|-------|-----|
| Primary button | `bg-blue-600 hover:bg-blue-700 text-white` | Kept from current design. Blue-600 has excellent contrast on white (4.5:1+). |
| Link text | `text-blue-600 hover:text-blue-700` | Standard link treatment. |
| Focus ring | `ring-blue-500` | Input focus indicator. |
| Selected state | `bg-blue-50 border-blue-600` | Sidebar selected item, active WeekStrip day. |

### Danger / Delete Color

| Role | Class | Why |
|------|-------|-----|
| Delete button | `text-red-600 hover:bg-red-50` | Red for destructive actions. Ghost style (text-only) because delete is always a secondary action in Chronolog. |
| Confirm-delete state | `bg-red-50 border-red-200` | Card background shifts to light red during the "Are you sure?" state. |
| Error text | `text-red-600` | Validation errors on time input. |

### Success / Submitted Color

| Role | Class | Why |
|------|-------|-----|
| Submitted badge | `bg-emerald-100 text-emerald-800` | Emerald rather than green to add warmth. Reads as "done, approved, good." |
| Success toast | `bg-emerald-50 text-emerald-700` | Consistent with the badge. |

### Client Color Palette

Eight colors chosen for maximum mutual distinguishability on white/stone backgrounds. The palette avoids blue (reserved for interactive elements), red (reserved for danger), and pure gray/stone (the base palette). Colors are selected at the 400 level for borders/dots and the 50 level for subtle backgrounds.

| Slot | Color Name | Border/Dot Class | Background Class | Hex (approx.) | Why This Color |
|------|-----------|------------------|-----------------|---------------|----------------|
| 1 | Rose | `bg-rose-400` | `bg-rose-50` | #fb7185 | Warm, distinct from red-600 danger. The most visually "present" color -- good for the primary client. |
| 2 | Sky | `bg-sky-400` | `bg-sky-50` | #38bdf8 | Cool contrast to rose. Lighter than blue-600 interactive, so no confusion. |
| 3 | Violet | `bg-violet-400` | `bg-violet-50` | #a78bfa | Purple family -- distinct from both rose and sky on every axis (hue, warmth). |
| 4 | Amber | `bg-amber-500` | `bg-amber-50` | #f59e0b | Warm gold. Uses 500 instead of 400 because amber-400 is too light for sufficient contrast on white. |
| 5 | Teal | `bg-teal-400` | `bg-teal-50` | #2dd4bf | Cool green-blue. Sits between sky and emerald, distinct from both. |
| 6 | Fuchsia | `bg-fuchsia-400` | `bg-fuchsia-50` | #e879f9 | Vibrant pink-purple. Distinct from both rose (which is warm pink) and violet (which is cooler). |
| 7 | Lime | `bg-lime-500` | `bg-lime-50` | #84cc16 | Yellow-green. Uses 500 for contrast. The only green-family color in the palette. |
| 8 | Orange | `bg-orange-400` | `bg-orange-50` | #fb923c | Warm and distinct from amber (which is more golden). Sits between rose and amber on the wheel. |

**Contrast validation:** All border/dot colors at the 400-500 level achieve a minimum 3:1 contrast ratio against white backgrounds, meeting WCAG AA for non-text elements (UI components). Text labels using these colors should use the corresponding 700 shade (e.g., `text-rose-700`) for WCAG AA text compliance (4.5:1).

**Assignment logic:**

1. Each client is assigned a color in creation order. First client gets slot 1 (rose), second gets slot 2 (sky), etc.
2. The color index is stored on the client record (`colorIndex: 0-7`).
3. If a user has more than 8 clients (unlikely for a solo consultant with 3-5), colors wrap: client 9 gets slot 1 again. At this scale, active overlap is improbable.
4. Users can reassign colors in the admin panel (stretch goal -- not in initial implementation).
5. The color follows the client, not the contract. All contracts under "Big Cheese Inc." share the rose color. This reinforces client identity and keeps the color count manageable.

**Where client colors appear:**

- Left border on time entry cards (`border-l-3` using the client's color)
- Colored dot next to contract labels in entry cards
- Sidebar contract list (colored dot or left accent)
- WeekStrip proportion bars (stacked horizontal segments showing hours per client)
- Week header client breakdown

---

## 2. Typography Hierarchy

All sizes use Tailwind's `text-*` scale. The system font stack is kept (no custom fonts -- they add weight and load time for minimal benefit in a productivity tool).

| Element | Size | Weight | Color | Tracking | Example | Why |
|---------|------|--------|-------|----------|---------|-----|
| Month divider | `text-xs` | `font-medium` | `text-stone-400` | `tracking-widest uppercase` | "FEBRUARY 2026" | Small and quiet. Month boundaries are orientation markers, not content. The wide tracking and uppercase treatment make them visually distinct at a small size. A horizontal rule on each side (`border-stone-200`) frames the text. |
| Week header label | `text-base` | `font-semibold` | `text-stone-800` | -- | "Week 23 -- May 19-25" | Larger than day headers to establish the week as the primary organizational unit. Semibold for scannability. |
| Week total hours | `text-base` | `font-semibold` | `text-stone-500` | `tabular-nums` | "32.5 hrs" | Same size as the week label but in muted color. The number needs `tabular-nums` so totals align vertically when scanning multiple weeks. Semibold because it is a summary figure. |
| Day header | `text-sm` | `font-semibold` | `text-stone-700` | -- | "Wednesday, May 21" | Slightly smaller than the week header. Semibold to act as an anchor when scanning. Stone-700 rather than 900 -- days are sub-sections, not primary content. |
| Day total | `text-sm` | `font-medium` | `text-stone-400` | `tabular-nums` | "5.5 hrs" | Muted and right-aligned. The day total is reference information, not something the user acts on. Medium weight keeps it legible but subordinate. |
| Entry description | `text-sm` | `font-medium` | `text-stone-900` | -- | "Reviewed API design feedback" | **The hero text.** Stone-900 (near-black) and font-medium make this the most prominent element within a card. Larger effective weight than the contract label ensures the eye goes here first. |
| Entry contract label | `text-xs` | `font-normal` | `text-stone-500` | -- | "Big Cheese -- API Contract" | Small, muted, and secondary. The contract provides context but should never compete with the description. The client color dot next to it provides faster recognition than reading the text. |
| Entry deliverable/work type | `text-xs` | `font-normal` | `text-stone-400` | -- | "Onboarding > Development" | Even more muted than the contract label. This is tertiary metadata -- useful when reviewing for billing accuracy but not needed during daily scanning. Separated from contract by a subtle divider or placed on its own line. |
| Entry duration | `text-sm` | `font-medium` | `text-stone-500` | `tabular-nums` | "2h 30m" | Same size as description but muted color. The duration is important but should not dominate. Medium weight for legibility. Right-aligned to create a consistent column when scanning. |
| "Today" label | `text-xs` | `font-semibold` | `text-amber-700` | `uppercase tracking-wide` | "TODAY" | Small but high-contrast against the amber-50 background. Uppercase + tracking makes it a badge-like marker. Sits next to the day header text. |
| Status badge | `text-xs` | `font-medium` | (varies by status) | -- | "Submitted" | Chip style with background color. Small because it is metadata, but the color-coded background makes it scannable without reading. |
| Timer elapsed | `text-2xl` | `font-bold` | `text-stone-900` | `font-mono tabular-nums` | "01:23:45" | Large and monospaced. The timer is a real-time element that needs to be readable at a glance, even peripherally. Kept from the current design. |
| WeekStrip day label | `text-xs` | `font-medium` | `text-stone-500` | -- | "Mon 19" | Compact. The WeekStrip is a dense summary element; labels must be small to fit 5-7 days in a row. |
| WeekStrip day hours | `text-sm` | `font-semibold` | `text-stone-700` | `tabular-nums` | "3.5h" | Slightly larger than the day label. This is the primary data in the WeekStrip -- how much time was logged each day. Semibold for scannability. |
| Sidebar contract name | `text-sm` | `font-normal` | `text-stone-700` | -- | "Big Cheese -- API" | Standard list item weight. The client color dot provides faster identification than the text, so the text can be quiet. |
| Empty state message | `text-sm` | `font-normal` | `text-stone-400` | `italic` | "No entries yet" | Italicized to distinguish from actual content. Muted color says "nothing here, but that is okay." |

---

## 3. Visual Weight Ordering

Ranked from most to least visually prominent. This ordering drives every other design decision -- if an element's visual weight does not match its rank, the hierarchy is broken.

| Rank | Element | Visual Cues | Why This Position |
|------|---------|-------------|-------------------|
| 1 | **Entry description** | `text-sm font-medium text-stone-900`, largest text in the card | The core question a consultant asks when reviewing their timesheet is "what did I do?" The description answers this directly. It must be the first thing the eye finds within each card. |
| 2 | **Today section** | `bg-amber-50/60` background tint, "TODAY" badge | When opening the app, the user needs to immediately locate "now." The amber background creates a warm landing zone that draws attention before any text is read. |
| 3 | **Timer elapsed** | `text-2xl font-bold font-mono`, largest text element on screen | A running timer is the only real-time element. It must be peripherally readable -- the user should be able to confirm "yes, it is still running" without focusing. |
| 4 | **Day header** | `text-sm font-semibold text-stone-700`, anchors each day section | Day headers are the primary structural markers. Users scan them to find a specific day ("where is Wednesday?"). They need to be prominent enough to serve as anchors but not compete with entry content. |
| 5 | **Week header** | `text-base font-semibold text-stone-800` | The week header establishes the broadest temporal context. Larger than day headers but seen less frequently (once per week section). |
| 6 | **Client color accent** | `border-l-3` on cards, colored dots | Color is processed pre-attentively -- the brain registers it before reading text. A rose border on an entry card says "Big Cheese" before the contract label is read. This is why color is ranked above the contract text. |
| 7 | **Entry duration** | `text-sm font-medium text-stone-500`, right-aligned | Important for billing but secondary to "what did I do." Right-alignment creates a scannable column. Muted color keeps it subordinate to the description. |
| 8 | **WeekStrip** | Compact row, `text-xs`/`text-sm`, colored proportion bars | Provides weekly context at a glance. Stays visible at the top of the content area but should not pull focus from the entry list below it. |
| 9 | **Entry contract label** | `text-xs text-stone-500` with colored dot | Context, not content. The colored dot does most of the identification work; the text is confirmation. |
| 10 | **Day total** | `text-sm font-medium text-stone-400`, right-aligned | Reference data. Useful when checking "did I log enough today?" but not part of the primary scan flow. |
| 11 | **Week total** | `text-base font-semibold text-stone-500` | Summarizes the week. Important for weekly review but not during daily use. |
| 12 | **Status badge** | `text-xs`, chip with background color | Workflow metadata. Only relevant during the weekly submission process, not during daily time entry. |
| 13 | **Entry deliverable/work type** | `text-xs text-stone-400` | Tertiary categorization. Needed for billing detail but almost never scanned during daily use. |
| 14 | **Month divider** | `text-xs uppercase tracking-widest text-stone-400` | Orientation marker. Noticed when scrolling past, not actively sought. The lightest structural element. |
| 15 | **Empty state message** | `text-sm italic text-stone-400` | The absence of content. Should be visible enough to confirm "nothing here" but should never compete with actual entries. |

---

## 4. Card / Entry Styling

### Time Entry Card Anatomy

```
+--+----------------------------------------------------------+
|  | Reviewed API design feedback and wrote summary   2h 30m  |
|  | * Big Cheese -- API Contract                             |
|  |   Onboarding > Development                               |
+--+----------------------------------------------------------+
 ^
 | 3px client color border
```

**Structure:**

| Property | Value | Why |
|----------|-------|-----|
| Border | `border border-stone-200 border-l-3` | The left border is 3px in the client's color (e.g., `border-l-rose-400`). Other borders are standard stone-200. The thick left edge is the primary visual differentiator between clients. 3px is thick enough to be instantly visible but thin enough to not feel heavy. |
| Background | `bg-white` | White is the brightest surface, giving cards maximum contrast against the stone-50 page background. |
| Border radius | `rounded-lg` | Rounded corners soften the card edges, contributing to the journal aesthetic. Matches the current design. |
| Padding | `px-3 py-2.5` | Comfortable padding. Slightly more vertical padding than the current `py-2` to give the description breathing room. |
| Shadow | None (`shadow-none`) | No box shadow. Shadows add visual weight and create a "floating card" metaphor that feels corporate. The left color border + white-on-stone contrast provides sufficient card definition without shadows. |
| Min height | None | Cards should be content-sized. A single-line entry should be compact; a multi-line description should expand naturally. |

**Content layout within the card:**

- **Row 1:** Description (left, `text-sm font-medium text-stone-900`) and duration (right, `text-sm font-medium text-stone-500 tabular-nums`). These share a flex row with `justify-between`.
- **Row 2:** Client color dot (4px circle, inline) + contract label (`text-xs text-stone-500`). Visually separated from Row 1 by `mt-1`.
- **Row 3 (optional):** Deliverable and work type (`text-xs text-stone-400`), only shown if set. Separated from Row 2 by `mt-0.5`.

### Card States

| State | Treatment | Why |
|-------|-----------|-----|
| **Default** | `bg-white border-stone-200 border-l-{client-color}` | Clean, quiet, readable. The client color border is the only "decoration." |
| **Hover** | `bg-stone-50 cursor-pointer` with `transition-colors duration-150` | A subtle background shift signals interactivity without being distracting. The transition duration (150ms) is fast enough to feel responsive but slow enough to not flicker. |
| **Editing** | `bg-white ring-1 ring-blue-300 border-l-{client-color}` | A blue focus ring appears around the card to indicate active editing. The ring (not border) avoids layout shift. The client color border is preserved to maintain identity. |
| **Confirm-delete** | `bg-red-50 border-red-200 border-l-red-400` | The card turns a light red, replacing the client color border. This is a strong visual signal: "this card is about to be deleted." The "Yes / No" buttons appear inline, replacing the description row. |

---

## 5. Day Section Styling

### Day Header

```
Wednesday, May 21                                        5.5 hrs
──────────────────────────────────────────────────────────────────
```

| Property | Value | Why |
|----------|-------|-----|
| Day name + date | `text-sm font-semibold text-stone-700` | Semibold anchors the section. Stone-700 is strong but doesn't compete with stone-900 entry descriptions within the cards below. |
| Day total | `text-sm font-medium text-stone-400 tabular-nums` | Right-aligned, muted. A reference number, not a call to action. |
| Underline | `border-b border-stone-200` | A single-pixel line under the header creates a clean shelf for the entries to sit on. Lightweight and unobtrusive. |
| Padding | Header row: `pb-1.5`, entries start `mt-2` below the line | Small gap between header and first entry. |

### Today vs. Other Days

| Aspect | Today | Other Days | Why |
|--------|-------|------------|-----|
| Section background | `bg-amber-50/60 rounded-lg` | `bg-transparent` | The amber tint creates a warm "spotlight" on today. The 60% opacity (`/60`) keeps it subtle -- this is a glow, not a highlight. Rounded corners on the container wrap the entire day section in the tint. |
| Header text | Day name in `text-stone-700` + `TODAY` badge adjacent | `text-stone-700`, no badge | The badge (see Typography section) reinforces the background tint with a text marker. |
| "TODAY" badge | `text-xs font-semibold uppercase tracking-wide text-amber-700 bg-amber-100 rounded-full px-2 py-0.5` | Not present | A small pill badge next to the day name. Uses amber-700 text on amber-100 background for sufficient contrast (approximately 4.5:1). |
| Section padding | `p-3` around the entire day section | `py-2 px-0` | Today gets slightly more breathing room due to its background container. |

### Spacing

| Spacing | Value | Why |
|---------|-------|-----|
| Between entries within a day | `gap-2` (0.5rem / 8px) | Tight enough that entries within a day feel grouped, loose enough that individual cards are distinct. |
| Between day sections | `space-y-6` (1.5rem / 24px) | Generous vertical breathing room between days. Days are the primary sections within a week and need clear visual separation. |
| Between day header and first entry | `mt-2` (0.5rem / 8px) | The underline provides the visual break; the gap just needs to be enough that the first entry does not touch the line. |

### Empty Day Appearance

Empty days within the current week are shown to maintain temporal rhythm. Past weeks only show days that have entries.

| Property | Value | Why |
|----------|-------|-----|
| Header | Same as a non-empty day header, but with `0 hrs` in `text-stone-300` | Maintaining the header keeps the daily rhythm visible. The "0 hrs" in a very light shade confirms "nothing here" without drawing attention. |
| Body | `text-sm italic text-stone-400` showing "No entries" + the "+" add button | The italic text distinguishes this from real content. The "+" button is the primary element -- its presence says "you can start here." |
| Height | Minimal -- just the header + one line for the empty message | Empty days should be compact to avoid pushing content-rich days out of view. |

---

## 6. Week Section Styling

### Week Header

```
Week 23 -- May 19-25                    32.5 hrs    [Submitted]
[rose ████ sky ██ violet █]
```

| Property | Value | Why |
|----------|-------|-----|
| Week label | `text-base font-semibold text-stone-800` | Larger than day headers (`text-sm`) to establish the week as the parent container. Stone-800 is one shade darker than the day header's stone-700 to reinforce hierarchy through color progression. |
| Week total hours | `text-base font-semibold text-stone-500 tabular-nums` | Same size as the label, muted color. Positioned to the right of the label in the same flex row. |
| Status badge | See Section 9 (Status Badge System) | A colored chip -- not a plain text input. Positioned to the right of the hours total. |
| Client breakdown bar | A horizontal bar (height `h-1.5`, width fills available space) with colored segments proportional to each client's hours | This is a small, dense visualization. Each segment uses the client's color at the 400 level. If a week has 20h on rose-client and 12.5h on sky-client, the bar is ~62% rose-400 and ~38% sky-400. The bar sits below the week header text with `mt-1.5`. Rounded ends: `rounded-full`. |
| Spacing below header | `mb-4` (1rem / 16px) before the first day section | Enough room for the header + breakdown bar + visual breathing. |

### Week Transition (Between Weeks)

| Property | Value | Why |
|----------|-------|-----|
| Separator | `border-t border-stone-200` with `my-8` (2rem / 32px) vertical spacing | A simple horizontal line with generous whitespace. Weeks are the primary containers and need the most visual separation. The 2rem spacing is nearly double the day-section spacing (1.5rem), creating a clear hierarchy. |

### Month Transition

When a week boundary crosses into a new month, a month divider is rendered before the week header:

```
                     ── FEBRUARY 2026 ──

Week 9 -- Feb 2-8                        28.0 hrs
```

| Property | Value | Why |
|----------|-------|-----|
| Month label | `text-xs font-medium uppercase tracking-widest text-stone-400` | Small and quiet -- this is an orientation marker, not a navigation element. The wide letter-spacing and uppercase treatment give it a distinct visual signature at a tiny size. |
| Horizontal rules | `border-stone-200` lines on each side of the text, implemented as a flex row with `flex-grow border-t` on each side and the text centered with `px-4` | The "rule -- text -- rule" pattern is a classic typographic section divider. It reads as "you have crossed a boundary" without demanding attention. |
| Spacing | `my-10` (2.5rem / 40px) above and below | Even more generous than the week separator. Month boundaries are rare (once every 4-5 weeks) and should feel like turning a page. |

---

## 7. Spacing System

A consistent spacing system using Tailwind's scale. All values chosen to create a visual rhythm that compresses as you zoom in (month > week > day > entry).

| Spacing Context | Tailwind Class | Pixel Value | Why |
|-----------------|----------------|-------------|-----|
| Between entries within a day | `gap-2` | 8px | Entries in the same day are siblings. Tight spacing groups them visually. |
| Between day header underline and first entry | `mt-2` | 8px | Matches inter-entry gap for consistency within the day. |
| Between day sections | `space-y-6` | 24px | 3x the inter-entry gap. Days are distinct sections and need clear separation for scanning. |
| Between week header and first day | `mb-4` | 16px | 2x the inter-entry gap. The week header content (label, hours, status, breakdown bar) needs a clear separation from the first day's content. |
| Between week sections | `my-8` | 32px | 4x the inter-entry gap. The largest intra-page spacing. Combined with a `border-t` line, this creates unmistakable week boundaries. |
| Month divider spacing | `my-10` | 40px | 5x the inter-entry gap. Month boundaries are the rarest and most significant temporal markers. |
| Padding inside entry cards | `px-3 py-2.5` | 12px / 10px | Horizontal: enough room that text doesn't feel cramped against the left color border. Vertical: enough breathing room for 2-3 content rows. |
| Content area horizontal padding | `px-4` (mobile) / `px-6` (desktop) | 16px / 24px | Keeps content away from the screen edge. Desktop gets more breathing room because the sidebar already constrains the width. |
| Content area top padding | `pt-4` | 16px | Below the WeekStrip. Enough to separate the navigation strip from the scrollable content. |
| WeekStrip height | `h-20` | 80px | Compact but not cramped. Fits the day labels, hours, and proportion bar for each day in 80px of vertical space. |
| WeekStrip internal padding | `px-3 py-2` | 12px / 8px | Tight padding because the WeekStrip is a dense summary element. Every pixel counts in an 80px strip. |
| WeekStrip day column gap | `gap-1` | 4px | Minimal gap between day columns. The columns should feel like cells in a strip, not isolated cards. |

---

## 8. Interactive Affordances

Every editable element must communicate its editability before the user clicks. The approach is restrained: affordances appear on hover, not at rest. At rest, the timesheet reads cleanly; on hover, editing handles appear.

### Entry Description (Click-to-Edit)

| State | Treatment | Why |
|-------|-----------|-----|
| Rest | `text-sm font-medium text-stone-900` -- plain text, no cursor change, no underline | At rest, the description is just text. No edit chrome. The card's hover state (below) provides the first signal. |
| Card hover | Card background shifts to `bg-stone-50`. The description text shows no additional change. | The card-level hover is sufficient to signal "this card is interactive." Individual field affordances are unnecessary at this stage. |
| Description hover (within hovered card) | `cursor-text` and a subtle `border-b border-dashed border-stone-300` underline appears below the text | The dashed underline is the universal signifier for "editable text." `cursor-text` reinforces this. The underline only appears when hovering the description specifically, not the entire card. |
| Editing | Text is replaced by an `<input>` or `<textarea>` with `ring-1 ring-blue-300 rounded bg-white px-2 py-1` | A visible text input with a blue focus ring. Auto-focused on click. Saves on blur or Enter (debounced for textarea). |

### Entry Duration (Click-to-Edit)

| State | Treatment | Why |
|-------|-----------|-----|
| Rest | `text-sm font-medium text-stone-500 tabular-nums` -- right-aligned | Quiet number, no edit chrome. |
| Hover (within hovered card) | `cursor-pointer` and text shifts to `text-stone-700` (slightly darker) | Darkening the number on hover signals interactivity without adding underlines or icons that would disrupt the right-aligned number column. |
| Editing | Replaced by a compact `<input>` with `w-24 text-right ring-1 ring-blue-300 rounded px-2 py-1 text-sm font-mono` | Fixed-width input, right-aligned text, monospaced to match the display format. Accepts "2h30m" or "9:00-11:30" formats. |
| Invalid input | `ring-1 ring-red-400` and `text-xs text-red-600` error message below | Red ring replaces blue ring. Error text appears below explaining the expected format. |

### Entry Contract Label (Click-to-Edit)

| State | Treatment | Why |
|-------|-----------|-----|
| Rest | `text-xs text-stone-500` with colored dot | Plain metadata text. |
| Hover (within hovered card) | `cursor-pointer` and text shifts to `text-stone-600` with subtle `underline decoration-dotted` | Dotted underline on metadata text signals "click to change this." |
| Editing | Replaced by `ContractSelect` dropdown, compact mode | The select component appears inline, replacing the text. Auto-opened on click. Selecting a contract saves immediately and collapses back to text. |

### "+ Add Entry" Button

| State | Treatment | Why |
|-------|-----------|-----|
| Rest | `text-sm text-stone-400 hover:text-blue-600 cursor-pointer` showing "+ Add entry" | Quiet at rest (stone-400 is very muted) so empty-day add buttons don't dominate the view. Blue on hover confirms interactivity. |
| Hover | `text-blue-600` | Blue signals "this is a clickable action." |
| Active (form expanded) | The "+" disappears and a `NewEntryRow` form expands in its place with `ring-1 ring-blue-200 rounded-lg bg-white p-3` | The form is visually contained in a card-like container. The ring distinguishes it from existing entry cards. |

### WeekStrip Day Column (Clickable)

| State | Treatment | Why |
|-------|-----------|-----|
| Rest | `cursor-pointer rounded-md` with day label, hours, and proportion bar | Each day is a column cell. The `rounded-md` provides a subtle container. |
| Hover | `bg-stone-100` background | Light background shift. Consistent with the card hover pattern. |
| Active/selected (currently viewing this day) | `bg-blue-50 ring-1 ring-blue-200` | Blue treatment consistent with other selected states in the app. |
| Today column | `bg-amber-100 border-b-2 border-amber-400` (overrides default, preserved on hover) | The amber accent identifies today. This persists even when another day is selected, so the user never loses track of "now." |

---

## 9. Status Badge System

Weekly status is displayed as a colored chip/badge, not a plain text input. This replaces the current invisible inline text field with a visible, scannable element.

### Badge Base Styling

All badges share: `rounded-full px-2.5 py-0.5 text-xs font-medium inline-flex items-center gap-1`

The `rounded-full` creates a pill shape. The small size (`text-xs`) keeps badges subordinate to the week header text they accompany.

### Status Treatments

| Status | Background | Text | Dot/Icon | Why |
|--------|-----------|------|----------|-----|
| **Unsubmitted** | `bg-stone-100` | `text-stone-600` | `bg-stone-400` (4px dot) | The default state. Stone colors blend with the base palette -- this badge is quiet because "unsubmitted" is the expected state during a work week. It should not demand attention. |
| **Draft ready** | `bg-amber-100` | `text-amber-800` | `bg-amber-500` (4px dot) | Amber signals "in progress, needs attention." It is warmer and more visible than the unsubmitted badge, encouraging the user to submit. The amber family ties it to the "today" treatment (both represent "current focus"). |
| **Submitted** | `bg-emerald-100` | `text-emerald-800` | `bg-emerald-500` (4px dot) | Green/emerald means "done." Universally understood. The color is distinctly different from both stone and amber, making submitted weeks instantly scannable when scrolling through the history. |
| **Custom text** | `bg-blue-100` | `text-blue-800` | None | Blue for anything that does not match the three predefined statuses. Since the status field is free text, users might type "Invoiced" or "Awaiting review." Blue is neutral enough to not imply a specific meaning. |

### Interaction

The badge is clickable. Clicking it transforms into a compact text input (`text-xs`, same pill shape, `ring-1 ring-blue-300`) where the user can type or clear the status text. Pressing Enter or blurring saves. The input auto-selects the current text on focus for easy replacement.

When the input is empty and saved, the status reverts to "Unsubmitted" (the default badge).

---

## 10. "Today" Treatment

Today must be unambiguously identifiable at every scale: when scrolling the entry list, when glancing at the WeekStrip, and when opening the app for the first time.

### Day Section Background

| Property | Value | Why |
|----------|-------|-----|
| Container | A `div` wrapping the entire day section (header + entries + add button) with `bg-amber-50/60 rounded-lg p-3` | The amber tint covers everything that belongs to "today" as a single visual unit. The `rounded-lg` container creates a soft boundary. The `/60` opacity modifier keeps the amber subtle -- it should feel like warm light, not a yellow highlight. |
| Contrast | Cards within the today section remain `bg-white` | White cards on amber-50 create slightly more contrast than white cards on stone-50, making today's entries marginally more prominent than other days' entries. This is intentional. |

### Day Header Treatment

| Property | Value | Why |
|----------|-------|-----|
| Day text | Same as other days: `text-sm font-semibold text-stone-700` | The day name formatting should not change. The background tint and badge provide the "today" signal. |
| "TODAY" badge | `text-xs font-semibold uppercase tracking-wide text-amber-700 bg-amber-100 rounded-full px-2 py-0.5 ml-2` | A small pill badge immediately after the day name (e.g., "Wednesday, May 21 TODAY"). Amber-700 on amber-100 provides a warm, high-contrast marker. |
| Auto-scroll | On mount and on week selection, the viewport scrolls to position the today section at the top of the visible area | The user should not have to scroll to find today. This is the most important temporal navigation action and it happens automatically. |

### WeekStrip Column Highlight

| Property | Value | Why |
|----------|-------|-----|
| Background | `bg-amber-100` (replaces the default transparent/stone-50) | A stronger amber than the day section's `bg-amber-50/60` because the WeekStrip is smaller and more information-dense. The highlight needs to be more obvious at a smaller scale. |
| Bottom border | `border-b-2 border-amber-400` | A bottom accent line reinforces the column highlight. This is the same pattern Google Calendar uses for the current day. |
| Day label | `text-xs font-semibold text-amber-800` (instead of `text-stone-500`) | The label text darkens to match the amber background. This ensures sufficient contrast (amber-800 on amber-100 achieves approximately 5:1). |
| Persistence | The today highlight is always visible, even when another day column is selected | Selected day uses a `ring-1 ring-blue-200` overlay; today uses the amber background. When today IS the selected day, both treatments combine: amber background + blue ring. |

### Additional Markers

| Marker | Treatment | Why |
|--------|-----------|-----|
| Running timer indicator | If a timer is running, a small pulsing `bg-emerald-400` dot (6px, `animate-pulse`) appears in the WeekStrip's today column, next to the hours figure | This links the timer (which may be in the sidebar) to the current day's time total. The pulse draws the eye to "time is being recorded right now." Emerald matches the timer's "running" state color. |
| No-entries-yet today | The today section always renders, even if empty. The empty state shows "No entries yet -- start your day" instead of the generic "No entries" | A warmer empty state for today specifically. The message implies "the day is ahead of you" rather than "nothing happened." |

---

## Appendix: Migration Notes

### Changes from Current Design

| Current | New | Scope |
|---------|-----|-------|
| `gray-*` throughout | `stone-*` throughout | Global find-and-replace in utility classes |
| `bg-gray-50` page background | `bg-stone-50` | AppShell, layout components |
| `border-gray-200` card borders | `border-stone-200` + `border-l-3 border-l-{client-color}` | TimeEntryCard |
| Contract path as hero text | Description as hero text, contract as secondary `text-xs` | TimeEntryCard layout reorder |
| Time as `font-bold text-gray-900` | Duration as `font-medium text-stone-500` | TimeEntryCard |
| Plain text status input | Status badge (chip with background color) | WeekSectionHeader |
| No today emphasis | Amber-50 background + TODAY badge + WeekStrip highlight | DaySection, WeekStrip |
| No client colors | Client color palette + left borders + dots | TimeEntryCard, sidebar, WeekStrip |
| Uniform entry cards | Client-color-differentiated cards with description-first layout | TimeEntryCard |
| `shadow-sm` on cards | No shadows | TimeEntryCard |

### Accessibility Checklist

| Requirement | How It Is Met |
|-------------|---------------|
| Text contrast (WCAG AA, 4.5:1) | `text-stone-900` on `bg-white` = 15.4:1. `text-stone-600` on `bg-white` = 5.7:1. `text-stone-500` on `bg-white` = 4.6:1. All pass AA. |
| Text contrast on amber background | `text-stone-700` on `bg-amber-50` = approximately 6.5:1. `text-amber-700` on `bg-amber-100` = approximately 4.5:1. Both pass AA. |
| Non-text contrast (WCAG AA, 3:1) | Client color dots/borders at the 400-500 level all exceed 3:1 against white. |
| Focus indicators | All interactive elements use `ring-1 ring-blue-300` or `ring-blue-500` on focus. Visible, not hidden. |
| Color not sole differentiator | Client colors are always paired with text labels. Status badges have both color and text. Today has both color and a text badge. |
| Motion sensitivity | No animations except the timer pulse (`animate-pulse`). All transitions are color/opacity only (`transition-colors duration-150`). Users who prefer reduced motion: the pulse can be disabled via `prefers-reduced-motion`. |
