# Sprint 064-DR — Owner polish round: timesheet bars, notes headers, timer contract picker

**Branches:** `design-r1-polish-time` (timesheet and timer) and `design-r1-polish-notes` (notes), both from `design-r1` at `3d58241` (v1.6.0); merged back into `design-r1`. **Status:** in progress. No new dependencies, no migrations, nothing in `src-tauri/`.

Source: owner instruction 2026-11-08 (verbatim in the next section), with the follow-up "Feel free to carry these over to the non-noted platform where it makes sense": a change written for desktop also applies on the phone (and the other way round) unless the layout there makes it meaningless.

## Owner's words

> Timesheets: the brown bar should go edge to edge (there's a margin right now) Actual text content is the right width. Times in the individual time entry rows should be right aligned to the same as the times in the week summary bar. Same across mobile and desktop.
> Notes: On desktop, the faded pattern repeat should fill the available space in the top bar.
> Notes: On desktop, we don't need Notes in the middle bar, we can just have 'created' and its arrow, and the 'new note' button, no border, just the icon on the right.
> Notes: On desktop, the linked time doesn't need a heading, just a clock icon next to each line item, and the x button should show a confirm dialogue.
> Timer, ditch the pulsing green light entirely, the clock ticking is enough feedback. Selecting the contract I want to re-work, let's ditch the contract form item/dropdown, can we dropdown directly from the heading? The image section should be missing when the contract has not yet been selected, we add a 'select' subtitle (mirror of the change when we have selected one) and clicking on it once it has been brings down the dropdown from that location. Clicking away without selecting cancels the action.

## PM reading of each item (decisions, not reopened)

### T1 — Day heading bar edge to edge (`layout/TimeEntriesPanel.svelte`)

The "brown bar" is the sticky day heading (`data-testid="day-heading"`, `bg-bark-600`, sprint 057-DR TR-02). It sits inside the scroller, which has `px-3 sm:px-6`, so the bar stops short of the panel's edges. The bar must now reach both edges of the scroller at every width (phone and desktop) while every piece of text, the Add entry control and the day total keep exactly the x positions they have today. The Today ochre marker sits at the true left edge. The entries below keep their current width. Sticky behaviour, the `scroll-padding-top` arrangement and the day-jump maths must still hold (057-DR). The quiet variant (`bg-bark-100`, empty past days) and the older-week sections get the same treatment.

### T2 — Entry times right-aligned with the day total (`weekly/TimeEntryCard.svelte`, `layout/TimeEntriesPanel.svelte`)

The owner's "times in the week summary bar" are the day total at the right end of the brown bar (`data-testid="day-total"`). The right edge of each entry's duration (`entry-field … tabular-nums` in `.entry-time`) and of its time range (`entry-time-range`) must coincide with the right edge of the day total, at every width, on desktop and on the phone, with the row's delete affordance still usable. Prefer insetting the day total (the bar's right padding) over moving the delete control; if that reads badly on the phone where the delete button is always visible, say so in the report with a screenshot and pick the better of the two. Measure the alignment in a Playwright test (bounding boxes within 1 px) in both the wide (`@container ≥ 36rem`) and the narrow card layouts.

### T3 — No pulsing light (`timer/TimerPulseDot.svelte` and every caller)

Delete `TimerPulseDot.svelte` and every use of it: the expanded and compact identity header (`timer/TimerIdentityHeader.svelte`) and the header pill (`weekly/TimerIndicator.svelte`). Remove `data-testid="timer-running-dot"` expectations from the specs, the component readme entry and any token that existed only for the dot. The ticking clock is the running feedback (owner, 2026-11-08; supersedes TC-02's "running dot pulses" and O03's pulse timing).

### T4 — Contract picked from the heading (`timer/TimerIdentityHeader.svelte`, `timer/TimerRunningPanel.svelte`, `timer/TimerWidget.svelte`)

Remove the "Contract" labelled field (the `ContractSelect`, the "No contract yet: pick one now or when you stop" hint and "Keep this contract") from the running panel in both layouts (`panel` and `screen`). `ContractSelect.svelte` stays for its other callers.

The expanded identity header becomes the picker:

- **No contract yet:** no tile region at all (not the dashed placeholder). Title "No contract yet", subtitle a link-styled "Select" in the position "Change" has today.
- **Contract chosen:** tile region, contract name, client name and "Change" as today.
- **Clicking "Select" or "Change"** (while running) opens a dropdown anchored under that text: one list of the user's contracts labelled `formatContractLabel(clientName, name)` (existing helper), `role="menu"` / `menuitem`, `menu-panel` / `menu-item` recipes (see `layout/NoteListNewNoteButton.svelte` for the house pattern), the current contract marked with `aria-checked` or a check glyph. Choosing an item does what the select did (`draftContractId` set, server draft created or moved). Clicking anywhere outside, pressing Escape, or collapsing the widget closes the menu with nothing changed; focus returns to the trigger. Arrow keys move, Enter / Space choose, Home / End jump. Touch rows at least 44 px tall. The menu must not be clipped by the sidebar's overflow or the capture screen: check both, and position it so it stays on screen at the 240 px sidebar width.
- The chevron still only collapses / expands and never chooses (053-DR). The compact header is unchanged apart from T3.
- `isChangingContract` becomes the menu's open state (or is replaced); nothing in the completion form (`TimerCompletionForm`, `CascadeFields`) changes.
- Phone capture screen (`placement="screen"`): same header picker; the "Contract" field goes there too.

Specs that drive `#draft-contract` (`attach-note-sidebar`, `search-and-picker`, `timer-start-today`, `timer-visibility`, `timesheet-polish`, `contract-tiles`, the manual `qa-driver.mjs`) move to the new picker; add cases for: no tile region without a contract; "Select" opens the menu, outside click closes it with no change, Escape closes it, choosing a contract starts the server draft and shows the tile; "Change" moves the draft; the menu is fully on screen in the sidebar and on the phone.

### N1 — Editor header repeat fills the row (`notes/NoteEditorHeader.svelte`)

Remove the ten-tile cap (`max-w-[calc(var(--size-tile-repeat)*10)]`): the repeat fills whatever the row leaves between the status group and the actions, at every width where it is drawn. The single-column phone layout still has no repeat (063-DR). Update the `contract-tiles.spec.ts` case that asserts "at most ten tiles".

### N2 — List header without the "Notes" title (`layout/NoteListPanel.svelte`, `layout/NoteListNewNoteButton.svelte`)

When the list header's owner is `notes` (the sidebar already names the contract, `note-context-ownership.ts`), the header is one row: the sort toggle ("Created ↓" / "Modified ↓") at the left, the contract's quiet repeat filling the middle, the New note icon at the right. No "Notes" title, no visible count; keep the count and the contract for screen readers (`sr-only`, existing testids where the specs use them). The eyebrow line goes with the title in that case. The `contract`, `client` and `all` owners keep their title rows (those titles carry information the sidebar does not) with the sort toggle on its own row as today. All widths, phone included.

The New note button loses its border and background everywhere (icon only, `btn-quiet`-style hover, same 44 px touch size, same menu for client / all views).

### N3 — Linked time without a heading, with a confirm (`notes/LinkedTimeEntries.svelte`)

Drop the "Linked time · N" heading. Each row starts with a small clock glyph (inline SVG, `aria-hidden`, `text-ink-faint`) before the date; the row's accessible name says it is a linked time entry. The × no longer unlinks at once: it swaps the row's right-hand group for an inline confirm in the house style of the editor header's "Delete this note? Delete / Cancel" (`notes/NoteEditorHeader.svelte`): "Unlink? Unlink / Cancel", Escape cancels, focus goes to Unlink when it appears and back to the row's × (or the next row) after. Not a browser `confirm()`. Same on the phone (inside the "Links and attachments" disclosure on short screens). Update the specs that unlink directly.

## Shared rules for this sprint

- Verbose names, no single-letter identifiers; keep files under about 200 lines (split when a file grows past it); update each touched module's readme; tests for every change; no new dependencies; no migrations.
- Tokens and recipes come from `src/lib/styles/tokens.css` and `recipes.css`; add a token only for a new thing.
- `npm run check`, `npm run lint`, `npm test` clean; `npm run test:playwright` for the touched specs on chromium, webkit and the `@iphone` projects, then the full suite once before reporting.
- Screenshots (1280 × 800 chromium; phone from `iphone-15`) into `docs/review/screenshots/sprint-064-DR/`, before and after for each item.
- Commit on the branch only. Do not merge, do not touch `main`, `design-r1` or `CLAUDE.md`.

## Results

_Filled in by the PM after merge._
