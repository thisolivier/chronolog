# UX friction review — 2026-11-03

Exploratory "use it for a working week" review of Chronolog at desktop (1440×900) and phone (390×844)
sizes. Everything below was observed in the running app; screenshots are in
`docs/review/screenshots/ux-friction/`. Items already being fixed in sprint 019-CL are excluded. Items
already listed in `2026-11-03-qa-state.md` §4 item 11 are only mentioned where they were found to be
worse than described.

## Method

- One fresh user (`ux-mw0va8nh@chronolog.test`) registered through the UI, then driven with Playwright
  scripts (Chromium headless; the phone pass repeated in WebKit). Scripts and logs live outside the repo
  in the session scratchpad (`ux-review/`). The user and its data are left in the dev database.
- Data built the way a consultant would: two clients (Acme Corp 🚀, Globex Corp), three contracts
  (Rocket Build, Support Retainer, Data Audit), three deliverables; ten time entries across five days of
  two weeks by every path (inline row, Add Entry modal, timer start/pause/resume/stop/save, card edits of
  time, contract and description); one entry deleted; week status cycled; previous/next/future weeks
  visited. Seven notes across four contracts with headings, bullet and numbered lists, a code block,
  three wiki-links, one image attachment, one move, Markdown and PDF export, raw-mode editing.
- Admin: create, rename, inline-edit, delete clients, contracts and deliverables; delete a contract that
  had entries and notes.
- Keyboard: Tab order from page load, Enter/Escape in every inline editor and modal, shortcut probes.
- Resilience: double-click on save buttons and New Note, reload and note switching mid-edit, offline
  typing and saving, resize across the mobile breakpoint, 500-character descriptions, 150-character
  note titles, HTML and emoji in text.

## Environment

- Main checkout `/Users/olivier/sites/chronolog`, started at `06e673e`. **Sprint 019-CL was merged to
  `main` (`19f01bb`) partway through the run** and Vite hot-reloaded it; everything from the time-entry
  pass onwards was tested on `19f01bb` (deliverable selects, timer refresh and colour palette present).
  Later `63aa218` (sprint 023 dispatch) landed with no UI changes.
- Dev server `vite dev --port 5194`, `BETTER_AUTH_URL=http://localhost:5194 ALLOW_REGISTRATION=true`,
  dev Postgres on `localhost:5432`.
- Environment noise (not product findings, but worth knowing): Vite in the main checkout watches
  `.claude/worktrees/*/.svelte-kit/tsconfig.json` and force-reloads whenever another worktree rebuilds
  (28 reloads in ~25 minutes). **Each reload appears to leak the server's Postgres pool**: the dev server
  held 86 connections when Postgres started refusing clients (`53300 too many clients already`), which
  broke sessions for every dev server on the machine. Restarting the server released them; it had
  climbed to 35 again 10 minutes later. One WebKit pass hit this and was re-run.
- `e2e-playwright/manual-checklist/qa-driver.mjs` shows as modified in the main checkout; that edit was
  made by another session at 08:16 and is not part of this review.

## Ranked findings (most annoying first)

| # | Sev | Finding | Where | Shot |
|---|-----|---------|-------|------|
| 1 | Blocker | Deleting a contract silently deletes all its time entries and notes | `/admin/clients/[id]` contract row | 69, 70, 71 |
| 2 | Blocker | Note text typed in the last ~0.5 s is lost on note switch, contract switch, reload or layout change | NoteEditor | 53, 54 |
| 3 | Annoying | Offline: no indicator, note edits silently never saved, timesheet shows "No entries / 0 hrs" | AppShell, NoteEditor, TimeEntriesPanel | 56, 57, 58 |
| 4 | Annoying | Bulleted and numbered lists render without bullets or numbers (editor and print) | NoteEditor | 42, 48 |
| 5 | Annoying | Wiki-links show raw IDs everywhere instead of note titles | editor, cards, Linked from, Linked time entries | 46, 61, 64 |
| 6 | Annoying | `[[` autocomplete offers the note being edited, ranked first; Enter creates a self-link | NoteEditor wiki-link suggestion | 44 |
| 7 | Annoying | No way to search notes (API exists, no UI) | NoteListPanel | 41 |
| 8 | Annoying | Duration entry is unforgiving and inconsistent: `1.5`, `1:30`, `90`, `1.5h` rejected inline; modal rejects `3h` with a silently disabled Create; `25h` accepted | NewEntryRow, AddTimeEntryModal, TimeEntryCard | 22, 24, 29 |
| 9 | Annoying | Entry forms fail silently: no messages for missing contract, bad time or server errors | NewEntryRow, TimeEntryCard, AddTimeEntryModal | 21, 22, 58 |
| 10 | Annoying | Attached images render as broken images (`chronolog://attachment/undefined`, 500 on every load) | NoteEditor attachments | 49, 79 |
| 11 | Annoying | Export as PDF produced a page reading only "Loading note…"; print styles leave app chrome | NoteEditorPanel export | 48, 48b |
| 12 | Annoying | Escape in the card description editor saves instead of cancelling; Escape does not close the card contract select | TimeEntryCard | 82 |
| 13 | Annoying | Cannot log time for a future day; future weeks say "No days to display for this week" | TimeEntriesPanel, WeekStrip | 38, 39, 83 |
| 14 | Annoying | Week status is a blind click-to-cycle (Unsubmitted → Draft ready → Submitted → Unsubmitted) | WeekStrip status pill | 36 |
| 15 | Annoying | Entry delete button is invisible on touch and when keyboard-focused (hover-only) | TimeEntryCard | 31, 73 |
| 16 | Annoying | Phone: Start Timer / Add Entry only exist on the contracts screen; new-entry selects squashed to "Select a▾" | mobile AppShell, NewEntryRow | 73, 75 |
| 17 | Annoying | "Mobile" layout starts below 1024 px, so a half-screen laptop window gets the phone drill-down | AppShell `max-width: 1023px` | 53 |
| 18 | Annoying | Sidebar lists contracts flat and alphabetically, with no client names or grouping | ContractsSidebar | 19 |
| 19 | Annoying | New Note creates an empty persisted "Untitled" note, doesn't focus the editor, and double-click makes two | NoteListPanel | 41, 55 |
| 20 | Annoying | Deleting a deliverable silently removes it from every entry that used it | `/admin/.../contracts/[id]` | 67, 68 |
| 21 | Annoying | Linking is one-way: notes cannot reference a time entry, and linked entries in a note are not clickable | LinkedTimeEntries | 64 |
| 22 | Annoying | "Load older weeks" fetches data but shows nothing | TimeEntriesPanel | 84 |
| 23 | Annoying | Sidebar note counts are stale after create, move and delete until reload | ContractsSidebar | 42, 44, 51 |
| 24 | Annoying | Raw markdown view shows HTML entities (`L1 -&gt; on-call`) | NoteEditor raw mode | 52 |
| 25 | Polish | Phone note editor: toolbar wraps to two rows beside "Rich"; editor box is short with panels stacked below | NoteEditorPanel (mobile) | 79 |
| 26 | Polish | Hours formatting mixed (decimals in totals, h/m on cards); a 1-minute entry gives the day "0 hrs"; timer range "08:03-08:03" | WeekStrip, day header, card | 35, 73 |
| 27 | Polish | Contract label has three formats: "Acme Corp — Rocket Build", "Acme Corp / Rocket Build", "ACME / Rocket Build" | selects, cards, timer form | 25, 34 |
| 28 | Polish | Entry forms disagree on button order, field order and placeholders | NewEntryRow vs AddTimeEntryModal vs TimerCompletionForm | 20, 25, 34 |
| 29 | Polish | Admin feedback is generic ("Operation completed successfully.", "Failed to create client."); add-forms stay open; toggle turns into a blue primary "Cancel" | admin pages | 10, 17 |
| 30 | Polish | Admin: two breadcrumbs, inline-edit inputs misaligned with columns, Escape doesn't cancel, sort order is a raw number (all 0) with no reorder | admin pages | 12, 17 |
| 31 | Polish | First run gives no guidance; New Contract modal cannot create a client | `/`, ContractCreateModal | 04, 05 |
| 32 | Polish | No `<title>` on any page (blank tab/window title; screen readers announce "untitled page") | all routes | — |
| 33 | Polish | "Settings" opens a page titled "Admin"; the 2FA settings page is linked from nowhere | sidebar, `/admin`, `/settings/two-factor` | 87, 88 |
| 34 | Polish | Italic "Add deliverable..." on every card without one is visual noise | TimeEntryCard | 28 |
| 35 | Polish | "NOVEMBER 2026" month divider splits a week in two | TimeEntriesPanel | 37 |
| 36 | Polish | Sidebar timer buttons wrap ("Start / Timer"); collapsing the sidebar hides the timer entirely | TimerWidget, AppShell | 04, 85 |
| 37 | Polish | Note delete uses native `confirm()` (elsewhere inline Yes/No); red "Delete" sits beside "New Note" | NoteListPanel | 86 |
| 38 | Polish | Code block has a large empty band at the top; toolbar underline stops short of the Rich toggle | NoteEditor | 42 |
| 39 | Polish | Bare "404 Not Found"; a malformed admin ID gives "500 Internal Error" | error pages | 89, 90 |
| 40 | Polish | Note list shows modified time but sorts by creation; no sort toggle or pinning (spec) | NoteListPanel | 49 |
| 41 | Polish | First Tab after load lands mid-page (today's "+") instead of the sidebar | `/` | 81 |
| 42 | Polish | Note ID sequence is global across users (new user's first Internal note is `INTL.20261103.020`) | note IDs | 45 |
| 43 | Polish | "Moved to …" confirmation stays in the notes list header after switching contract | NoteListPanel | 51 |
| 44 | Polish | Phone: home highlights "Time Entries" as if open; Back bar plus title bar use ~220 px | mobile shell | wk-72, 73 |
| 45 | Polish | Long descriptions are not clamped (5-line cards); a long first line becomes a giant H1 | TimeEntryCard, notes | 44, 62 |

**Counts:** 2 Blocker, 22 Annoying, 21 Polish (45 total).

## Detailed findings

### 1. Deleting a contract silently deletes its time entries and notes — Blocker
- **Where:** `/admin/clients/[clientId]` → contract row → Delete → Confirm.
- **Did:** deleted "Data Audit" (three entries totalling 4 h 45 m across two weeks, three notes).
- **Happened:** the row's confirm asks only "Confirm / Cancel". After confirming: "Operation completed
  successfully." The contract, **all three time entries** (Fri 30 Oct 3 h, Wed 28 Oct 1 h 15 m, Tue 3
  Nov 30 m) and **all three notes** (`GET /api/notes/GLBX.20261103.001` → 404) are gone. No undo.
- **Expected:** refuse while entries exist, or say "This deletes 3 time entries (4 h 45 m) and 3 notes",
  or offer archive (the contract already has an Active flag). Billable time should never disappear from
  one click in an admin table.
- **Shots:** 69-admin-delete-contract-confirm, 70-admin-after-delete-contract,
  71-timesheet-after-contract-delete.

### 2. Recent note edits are lost on switch, reload or layout change — Blocker
- **Where:** `NoteEditor.svelte` — `onDestroy` clears the pending 500 ms autosave timer without flushing it.
- **Did:** typed a word and clicked another note in the list straight away; separately, typed and
  reloaded; separately, typed and resized the window from 1440 to 600 px wide and back.
- **Happened:** in all three cases the typed text was not saved (verified after reopening the note).
  There is no "unsaved" indicator and no `beforeunload` guard. Resizing across the breakpoint (finding
  17) unmounts the editor too, so a window snap or rotation loses text the same way.
- **Expected:** flush the pending save on destroy, note switch, `visibilitychange` and `beforeunload`.
- **Shots:** 53-resized-to-600-mid-edit, 54-resized-back-1440.

### 3. Offline is invisible and loses work — Annoying
- **Did:** with the network off: typed in a note for ~3 s, switched to Time Entries, tried to add an entry.
  Then went back online and reloaded.
- **Happened:** no offline or "not saved" indicator anywhere. Note saves fail to the console only and are
  never retried; the offline text was gone after reload. The timesheet shows "No entries", "0 hrs" and
  "--" for every day, as if the data had been deleted. The contract dropdown is empty and Save does
  nothing, with no message.
- **Expected:** an offline banner (a `ConnectionStatus` component exists but isn't visible), keep the
  last loaded weeks on screen, queue or retry failed note saves, and say "Couldn't save".
- **Shots:** 56-offline-typing-note, 57-offline-time-entries, 58-offline-save-entry.

### 4. Lists have no bullets or numbers — Annoying
- **Where:** NoteEditor (Tailwind preflight resets `list-style`; the editor has no list styles).
- **Did:** typed `- ` and `1. ` lists.
- **Happened:** items render as indented plain lines; a numbered list looks the same as a bulleted one.
  The markdown is correct (export shows `-` and `1.`), and the print output has the same problem.
- **Expected:** discs and numbers (`list-disc` / `list-decimal` or a prose style on `.tiptap`).
- **Shots:** 42-note-kickoff-content, 48-print-media.

### 5. Wiki-links read as `ACME.20261103.002` everywhere — Annoying
- **Happened:** an editor link chip shows the ID; a time card reads "Rocket kickoff workshop, notes in
  ACME.20261103.002"; "Linked from" shows `INTL.20261103.020`; the note's "Linked time entries" shows the
  raw `[[ACME.20261103.002]]`. Autocomplete inside a time-entry description lists IDs only, while the
  editor's autocomplete shows titles and previews.
- **Expected:** show the note's title (first line) with the ID as a tooltip or secondary text.
- **Shots:** 46-kickoff-after-reload-backlinks, 60-entry-wikilink-autocomplete,
  61-entry-with-wikilink-card, 64-note-linked-entries-section.

### 6. `[[` suggests the current note first — Annoying
- **Did:** in "Data audit interview plan…" typed `[[CFO` to link "Interview: CFO" and pressed Enter.
- **Happened:** the first suggestion was the note being edited (its body now contains "CFO"), so Enter
  inserted a link to itself. Typing `[[` alone shows "No matching notes" instead of recent notes.
- **Expected:** exclude the current note, rank title matches above body matches, and show recent notes
  for an empty query.
- **Shots:** 43-wikilink-autocomplete-open, 44-wikilink-autocomplete-by-title.

### 7. No note search — Annoying
- There is no search box in the sidebar, the notes list or anywhere else, and no shortcut. An
  `/api/notes/search` route exists. With notes split by contract, finding "that note about the ground
  station" means opening contracts one by one.

### 8. Duration entry is unforgiving and inconsistent — Annoying
- **Inline row and card:** accept only `2h30m`, `2h 30m`, `45m`, `2h` and `09:00-11:15`. Rejected:
  `1.5`, `1.5h`, `1:30`, `90`, `9-10:30`. Accepted: `25h` (saved a 25-hour entry; the day showed 26.5 h).
- **Add Entry modal:** labelled "Duration (HH:MM)". `3h` leaves Create disabled with no message, so the
  user can't tell what is wrong.
- **Expected:** one shared parser that accepts all the common forms (decimal hours, `H:MM`, bare
  minutes), a sanity cap (warn above 12 h), and an inline hint for invalid input.
- **Shots:** 22-inline-invalid-time, 24-week-with-25h-entry, 29-modal-3h-format.

### 9. Entry forms fail silently — Annoying
- Enter in the inline row with no contract chosen does nothing. An invalid time turns the border red,
  with no text. A failed create or update (`createTimeEntry`, `saveField`) is only `console.error`ed:
  offline, the row just stays open. Card inline edits behave the same way.
- **Expected:** a short inline message ("Pick a contract", "Use 1h30m, 1.5 or 9:00-10:30",
  "Couldn't save — retry").
- **Shots:** 21-after-enter-in-time-field, 22-inline-invalid-time, 58-offline-save-entry.

### 10. Image attachments are broken — Annoying
- **Did:** Attach → chose a PNG.
- **Happened:** the file uploads (it appears under "Attachments", 25.9 KB), but the image inserted in the
  note has `src="chronolog://attachment/undefined"`, which renders as a broken-image icon with alt text.
  Every later load of the note fires `GET /api/attachments/undefined` → 500 (20 times in this run), and
  the browser logs `ERR_UNKNOWN_URL_SCHEME`. The image went into the H2 at the caret, making the heading
  enormous.
- **Shots:** 49-after-attach-image, 79-phone-note-editor.

### 11. PDF export is unreliable — Annoying
- `Export as PDF` calls `window.print()`. With print media emulated, the sidebar, notes column and header
  are still laid out (blank). Chromium's PDF render of the same page contained only "Loading note…": the
  print width is under the 1024 px breakpoint, so the layout switches to mobile and remounts the editor
  (finding 17). The native macOS print dialog was not exercised headless; check it on the Mac before
  trusting this export.
- **Shots:** 48-print-media, 48b-export-pdf-rendered.

### 12. Escape means "save" in card editors — Annoying
- **Did:** opened a card's description with Enter, appended " (edited)", pressed Escape.
- **Happened:** the edit was saved (the blur handler commits). In the card's contract editor, Escape
  leaves the select open. The time editor's Escape does cancel, so the three editors on one card behave
  differently.
- **Shot:** 82-card-contract-after-escape.

### 13. No logging ahead; future weeks look broken — Annoying
- The current week lists only Monday to today. Clicking Thu/Fri in the WeekStrip does nothing. Next week
  shows a full strip but the body says "No days to display for this week." and offers "Load older
  weeks". Logging tomorrow's booked workshop is only possible through the modal's date field.
- **Shots:** 38-next-week-future, 39-weeks-ahead, 83-click-future-day.

### 14. Week status is a blind cycle — Annoying
- Clicking the pill cycles Unsubmitted → Draft ready → Submitted → Unsubmitted. A stray click on a
  submitted week resets it, with no menu, confirmation or undo, and nothing shows what the next state will
  be. **Expected:** a small menu of states.
- **Shot:** 36-week-status-after-cycling.

### 15. Delete is invisible on touch and keyboard — Annoying
- The card's × is `opacity-0 group-hover:opacity-100`. On the phone its computed opacity is 0, so entries
  can't be deleted by touch. With the keyboard it takes focus (Tab stop 2) while staying invisible.
  **Expected:** visible on `focus-visible`, and an always-visible (or swipe/long-press) delete on touch.
- **Shots:** 31-card-hover-delete-x, 73-phone-time-entries.

### 16. Phone time screen lacks the timer and squashes the entry row — Annoying
- The spec's persistent timer footer only exists on the contracts list. Inside Time Entries or a note
  there is no Start Timer or Add Entry. The inline new-entry row puts Contract, Deliverable and Time on one
  390 px line, so the selects read "Select a▾" and "Pick a co".
- **Shots:** 73-phone-time-entries, 75-phone-new-entry-row (WebKit: wk-73, wk-75).

### 17. The phone layout starts at 1023 px — Annoying
- `AppShell` uses `matchMedia('(max-width: 1023px)')`. A laptop window snapped to half a 1920 px screen
  gets the single-panel drill-down with "← Back" bars. Crossing the threshold remounts every panel
  (finding 2) and seems to be behind the PDF problem (finding 11).
- **Shot:** 53-resized-to-600-mid-edit.

### 18. Sidebar is not grouped by client — Annoying
- Contracts are a flat alphabetical list (Data Audit, General, Rocket Build, Support Retainer). The spec
  and the selects ("Acme Corp — Rocket Build") group by client; the sidebar shows no client at all. Two
  clients with a "Support" contract would be indistinguishable.
- **Shot:** 19-sidebar-with-contracts.

### 19. Empty and duplicate notes pile up — Annoying
- New Note immediately persists an "Untitled" note. Leaving it empty keeps it in the list and the count
  forever, and a double-click creates two. Focus stays on `<body>`, so the user must click into the
  editor before typing.
- **Shots:** 41-new-note-blank, 55-double-click-new-note.

### 20. Deleting a deliverable strips it from entries without warning — Annoying
- Deleted "Phase 1 - Discovery" (used by two entries) after the same bare Confirm/Cancel. Those entries
  now show "Add deliverable...". There is no warning, count or archive option.
- **Shots:** 67-admin-delete-deliverable-confirm, 68-admin-after-delete-deliverable.

### 21. Note ↔ entry linking only works one way — Annoying
- An entry can reference a note (`[[`), and the note then lists it under "Linked time entries". But a
  note cannot reference an entry (no syntax or picker). The listed entries are plain text with only an ×
  (unlink), so you can't jump to the entry or its week.
- **Shot:** 64-note-linked-entries-section.

### 22. "Load older weeks" does nothing visible — Annoying
- Clicking it fires `/api/time-entries/weekly` but the panel still shows only the selected week (the
  same two day headers), and the button stays. It is a leftover from the pre-WeekStrip continuous scroll.
- **Shot:** 84-load-older-weeks.

### 23. Sidebar note counts go stale — Annoying
- Rocket Build showed "1" while it had three notes. After moving a note the source and target counts
  were unchanged, and Data Audit showed no count with two notes. Counts correct themselves on reload.
- **Shots:** 42-note-kickoff-content, 44-wikilink-autocomplete-by-title, 51-after-move.

### 24. Raw markdown view shows HTML entities — Annoying
- A note containing `L1 -> on-call` shows `L1 -&gt; on-call -&gt; Olivier.` in the raw textarea. It
  rendered correctly after toggling back, but raw mode is where a markdown user goes to edit precisely.
- **Shot:** 52-raw-mode.

### 25–45. Polish (one line each; see the table for location and screenshot)
- **25** Phone editor: the toolbar wraps to two rows with the Rich button beside it. The editor card is
  short, with Linked from, Linked time entries and Attachments stacked under it, so long notes scroll
  inside a small box.
- **26** Totals use decimals ("5.8 hrs", "1.3h") while cards use "2h 15m". A 1-minute timer entry makes
  the day read "0 hrs" / "0h" next to a visible entry. Short timer entries show "08:03-08:03".
- **27** Contract labels: selects "Acme Corp — Rocket Build", cards and move menu "Acme Corp / Rocket
  Build", timer completion form "ACME / Rocket Build".
- **28** Inline row is description first, [Cancel][Save]. The modal is description last, [Create][Cancel],
  with no autofocus. New Contract modal is [Cancel][Create]. Deliverable placeholders: "Pick a contract
  first", "No deliverable", "Select a deliverable...".
- **29** Every admin action shows "Operation completed successfully." A duplicate client short code
  gives "Failed to create client." with no reason. Add forms stay open after create, and the "Add X"
  button turns into a blue primary "Cancel".
- **30** Admin shows "Chronolog / Admin" in the header and "Admin / Clients / Acme Corp" below it. The
  client inline-edit inputs don't line up with the columns, and Escape doesn't cancel. Deliverable "Sort
  Order" is a free number field (everything is "order: 0"), with no drag or up/down.
- **31** The first login shows an empty week and a "General" contract (under a hidden "Internal"
  client). Nothing says that clients and contracts are made under Settings. The sidebar's New Contract
  modal can only pick an existing client.
- **32** `document.title` is empty on every route, so the browser tab and Tauri window show the URL, and
  SvelteKit's announcer says "untitled page".
- **33** The sidebar "Settings" link opens `/admin` ("Admin — Manage your client hierarchy"). Nothing
  links to `/settings/two-factor`.
- **34** Every card without a deliverable shows italic "Add deliverable...". With most entries
  deliverable-less, it is the most repeated text on the page.
- **35** In Week 44 a "NOVEMBER 2026" divider sits between Saturday 31 Oct and Sunday 1 Nov.
- **36** At the 240 px sidebar width "Start Timer" and "Add Entry" wrap to two lines. Collapsing the
  sidebar (≡) removes the timer with it.
- **37** Note delete is a native `confirm()` dialog (Tauri webviews may suppress it), while entries and
  admin use inline Yes/No. The red "Delete" sits right next to "New Note".
- **38** A code block has a ~40 px empty band above the first line and a small font. The toolbar's dark
  bottom rule ends before the "Rich" toggle.
- **39** `/nope` shows an unstyled "404 Not Found". `/admin/clients/not-a-uuid` shows "500 Internal
  Error".
- **40** The note list shows each note's modified time but orders by creation. There is no sort toggle
  and no pinning, though both are in the UI spec.
- **41** The first Tab after load focuses Tuesday's "+" (mid-page), then the cards, then wraps to the
  sidebar.
- **42** The note ID counter is shared across users, so a brand-new user's first Internal note was
  `.020`.
- **43** After a move, "Moved to Acme Corp / Support Retainer" stays in the list header even after
  switching to another contract.
- **44** Phone home highlights "Time Entries" as selected. Inside, a "← Back" bar plus a "Time Entries"
  title bar take ~220 px before the WeekStrip.
- **45** A 500-character description renders as a five-line card (no clamp or expand). A long first line
  becomes a three-line H1 note title.

## Console and server errors seen

Browser (all runs, de-duplicated):
- `GET /api/attachments/undefined` → **500** (×20) and `Failed to fetch attachment undefined: 500`,
  plus `net::ERR_UNKNOWN_URL_SCHEME` for `chronolog://attachment/undefined` (×7). Finding 10.
- Offline runs: `Error saving note: TypeError: Failed to fetch`, `Error loading initial weeks`,
  `Error loading week`, `Failed to load clients` (all console-only; finding 3).
- `401` on `POST /api/auth/sign-in/email` (the deliberate wrong-password test; the UI message is good).
- No TipTap duplicate-extension warnings and no `each_key_duplicate` errors this run (fixed by 019/020).

Dev server:
- `[500] GET /api/attachments/undefined` — Postgres rejects `'undefined'` as a uuid (same root as
  finding 10).
- `[500] GET /` `lifecycle_outside_component` (`setContext` in `+layout.svelte` via
  `setNavigationContext`) ×4 at 07:59, while sprint 019 was being merged and Vite was hot-reloading
  mid-merge. Not reproduced afterwards.
- `53300 sorry, too many clients already` from Better Auth and `/api/time-entries/weekly` at 08:13–08:15
  (environment; see Environment above for the pool leak on Vite reloads).
- Compile warnings still printed on every reload: `state_referenced_locally` (`+layout.svelte`,
  `TimerCompletionForm`), `a11y_label_has_associated_control` (`NewEntryRow` Contract/Time labels),
  `a11y_autofocus` (`TimeEntryCard`, `WikiLinkInput`), `a11y_no_static_element_interactions`
  (`AddTimeEntryModal` backdrop).

## Three things that work well (do not regress)

1. **Inline time entry with ranges.** `09:00-11:15` becomes "2h 15m" with the range under it. Card inline
   edits of time and contract save on Enter and refresh the day and week totals immediately. After 019,
   timer saves and modal entries also appear without a reload, and the timer keeps its draft contract and
   description through stop.
2. **Editor markdown shortcuts and export.** `#`, `##`, `- `, `1. ` and ``` input rules work as a
   markdown writer expects, code is highlighted, and the Markdown export is clean, faithful markdown (the
   filename is still `untitled-note.md`, as already known).
3. **Auth and the inline confirms.** Login errors are clear ("Invalid email or password"), register
   validates the password match inline and logs straight in, and the inline Confirm/Cancel and Yes/No
   delete pattern (admin rows, entry cards) is quick and unobtrusive. It just needs consequences spelled
   out (finding 1). Wiki-link clicks on cards now open the note, and backlinks appear (019/020 fixes
   verified in passing).

## If you fix only five things

1. **Make contract (and deliverable) deletion safe:** block it or archive when entries or notes exist, and
   state the counts in the confirm (finding 1, 20).
2. **Flush note autosave on destroy, note switch, `visibilitychange` and `beforeunload`**, and show a
   saved/unsaved/offline indicator (findings 2, 3).
3. **Render wiki-links by title, exclude the current note from `[[` suggestions, and add note search**
   (findings 5, 6, 7).
4. **One forgiving duration parser with visible error text, used by the inline row, card and modal**
   (findings 8, 9, 12).
5. **Restore list bullets/numbers and fix image attachments** so notes look like the notes you wrote
   (findings 4, 10).
