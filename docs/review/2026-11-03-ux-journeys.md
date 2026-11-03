# UX Journey Review: cross-surface navigation and layout (2026-11-03)

Second UX pass, after the exploratory review in `2026-11-03-ux-friction.md` (45 findings). That review looked at one screen at a time. This pass follows the owner's brief: *"It's a very open-surface app: I might jump from writing a note to making a new deliverable, then go to move items to it, then check hours and dive via the hours into a note, and expect the sidebar to be showing the right hierarchy when I get there."* Findings already in the first review are not repeated here. Where a journey runs into one, it is cited as **UFR #n**.

Screenshots: `docs/review/screenshots/ux-journeys/` (84 files, called `shot` below).

## Method

- **Build:** `main` at 0c9edfe, after the 023-CL merge. The dev server was restarted after the coordinator's heads-up about `ENCRYPTION_KEY`.
- **Server:** the dev server ran on port 5198 with `ALLOW_REGISTRATION=true BETTER_AUTH_URL=http://localhost:5198`. Vite in the main checkout reloaded the page whenever another worktree built (`.claude/worktrees/*/src/app.html`), which broke scripted runs part-way through. For that reason the server ran through a scratchpad config that wraps `vite.config.ts` and adds `server.watch.ignored: ['**/.claude/**', '**/docs/**']`. No repo files were changed.
- **User and data:**
  - User: `journey-mw14lhlc@chronolog.test`.
  - Seed: two clients (Acme Corp ACME, Borealis Labs BORL) plus the auto-created Internal/General. Three contracts (Rocket Build and Launch Ops under Acme, Data Platform under Borealis), two deliverables each.
  - 8 notes with cross-links, including links across clients. 13 entries over 12 days, 6 of them containing `[[noteId]]`.
  - Clients and deliverables were created through the admin form actions. Contracts, notes and entries were created through the JSON API.
- **Browsers:**
  - Playwright headless Chromium at 1440×900 and at 390×844 (mobile, touch).
  - WebKit for the mobile journeys J8 and J14. It gave the same results as Chromium.
- **Scripts:** `/private/tmp/claude-501/-Users-olivier-sites-chronolog/149f7782-2562-48b2-9904-8fe2b200ea3d/scratchpad/ux-journeys/` (`00-register-seed.mjs`, `01-visual.mjs`, `10-j1-j4.mjs`, `20-j5-plus.mjs`, `30-mobile.mjs`, `40/41-keyboard*.mjs`, `50-reload.mjs`, `51-j2b.mjs`). The full step log is in `journey-log.txt` in the same folder.
- **How state was recorded:** after every step, `navState()` recorded:
  - the URL
  - the highlighted sidebar item
  - the open note ID
  - whether the editor or WeekStrip is on screen
  - the week label
  - the scroll offset
- **Artefacts I created** (not bugs):
  - two contracts called "Analytics Retainer", because J6 was re-run
  - two or three empty "Untitled" notes, from re-runs that clicked New Note (UFR #19)
  - Acme was renamed twice in J5 (to Acme Aerospace, then Acme Rocketry)

## Part 1: visual pass

| Shot | What I see |
|------|------------|
| `v01-empty-desktop` | First thing the eye goes to is the green Start Timer. The sidebar is 90% empty, showing a single "General" with a pink dot and no client name. **Today's section is inset 12 px from every other day:** Monday's "No entries" box starts at x=264, Tuesday's at x=276, so the left edges of the cards do not line up. Future days Wed–Sun look exactly like past empty days ("--"). |
| `v10/v11-time-week-desktop` | The timesheet is the most finished screen: clear hierarchy (day header, then card, then hours on the right) and a steady 8 px rhythm. The same 12 px inset on today's cards breaks the left line. Hours appear as decimals in the strip and headers and as h/m on cards (UFR #26). Raw IDs show as link text (UFR #5). The WeekStrip bars are the only colour key, and in the sidebar Rocket Build and Launch Ops share the same cyan dot with no client label, so the colour cannot be decoded (UFR #18). |
| `v12-time-prev-week-desktop` | The "◀ Week 43" link keeps a grey filled background after it is clicked, so it looks like a pressed toggle. The week label is the only place that says which week you are in, and it is small (14 px). |
| `v13-notes-list-no-selection` | Notes created through the API with a `title` and markdown show as **"Untitled"**: the list takes its title only from `contentJson` (finding P-09). Panel 2 has a pure white background, panels 1 and 3 are stone-50, and there is no shared header band, so the three panels read as separate cards rather than one window. |
| `v14-notes-editor` | Panel 3 never names the note's client or contract: its header has only a grey monospace ID (`ACME.20261103.005`) on the left and Move/Export on the right. **The sidebar is the only context.** The list's "Notes" header does not name the contract either. Previews drop wiki-links and leave "See ." / "See and ." behind. The bottom of the editor card is crowded by two linked panels at 12–13 px. "Linked time entries" shows the raw `[[ACME…]]` text. |
| `v15-notes-move-menu` | The menu reads "Client / Contract" (bold / regular), which is good, and it is the clearest hierarchy label in the app. It is right-aligned against the window edge and covers the Rich toggle. |
| `v16-notes-sidebar-collapsed` | With the sidebar collapsed **nothing on screen says which contract or client you are in.** Only the note ID prefix hints at it, and that prefix can be wrong (see P-07). |
| `v17-modal-new-contract` | Opened while viewing Acme / Rocket Build, the client field still says "Select a client…": the current context is not used. Its buttons are Cancel then Create (primary on the right). |
| `v18-modal-add-entry` | Opened while viewing a Rocket Build note, the contract is not preselected. Its buttons are in the opposite order to the New Contract modal (primary on the left, UFR #28). |
| `v19-timer-running-notes` | Start Timer was pressed while viewing Rocket Build. The widget says "Select a contract…", but **the server timer is already bound to Launch Ops**, the first active contract alphabetically. The indicator in the top bar has a pink left edge, which is the Internal client's colour index 0, although no contract was chosen. It shows `0:00:01` while the widget shows `00:00:01`. The widget grows and pushes New Contract and Settings 160 px up. |
| `v20/v21-timer-running-time / collapsed` | With the sidebar collapsed the only timer is the top-right pill. Pause and Stop are unreachable until the sidebar is reopened, but the pill does expand it, which is good. |
| `v22-timer-completion-form` | The completion form has "ACME / Launch Ops" preselected, a contract the user never picked (finding B-04). The time range reads "12:17 - 12:17" (UFR #26). |
| `v23–v26-admin-*` | Admin looks like a second app. It has a centred 5xl column, a larger bold brand, and an "Admin" crumb plus a second breadcrumb row (UFR #30). Its "Back to Dashboard" button points to a screen the app never calls a dashboard. The brand's left edge (x=224) does not line up with the content (x=232). The admin home is a single card on an empty page. A contract page has no way into that contract's notes or hours. Sign out exists only on `/admin`. |
| `v30–v33-mobile-*` | Level 1 time has a proper "Time Entries" title. **Level 1 notes has only "Notes"**, with no contract name, and Back is a bare "← Back". At level 2 the Back label does not say where it goes either. The toolbar wraps (UFR #25). In "Linked time entries" the date wraps to "Tue, / Nov 3" and the description runs into the duration (`v33`, `j14-03`). |
| `j8-02-chromium-landscape` | Phone landscape (844×390): the editor shrinks to about 80 px of visible text, and the Linked from / Linked time entries panels take the rest. You cannot write in landscape. |
| `j8-02b-webkit-tablet-landscape` | At 1180 px the desktop layout fits well. Two contracts with the same name cannot be told apart in the flat list. |

**Do the three panels read as one app?** In time mode, mostly yes. In notes mode they read as three separate widgets: there is no header band shared across the panels, and no breadcrumb tying panel 2 and panel 3 to the sidebar selection. Admin reads as a different product.

**Clickable but does not look it:** card description, contract and deliverable labels (edit on click, plain text). The WeekStrip day columns (scroll on click). The timer pill (expands the sidebar).

**Looks clickable but is not:** rows in "Linked time entries" (UFR #21). Note IDs in the panel 3 header (monospace, link-like grey).

## Part 2: journey log

`sidebar` = highlighted item in panel 1. The URL was `/` at every step of every in-app journey.

### J1. Write a note in A, go to admin, add a deliverable to B, come back, move the note to B
1. Opened Acme / Rocket Build, then "Supplier call — Valves", and typed. Sidebar: Rocket Build. (`j1-01`)
2. Settings, Clients, Borealis, Data Platform, Add Deliverable "Data Phase 3 (new)". (`j1-02`)
3. **Back to Dashboard: the note is still open, the sidebar is still on Rocket Build, and the typed text is there.** Navigation state lives in the root layout and survives client-side route changes. (`j1-03`) Good.
4. Browser Back from `/` goes to the admin contract page. That is sensible.
5. Move to Borealis / Data Platform: **the editor closes, the sidebar stays on Rocket Build with nothing selected, and the note list loses the note.** The sidebar counts stay at 3/3 (UFR #23). The green "Moved to…" banner is the only clue. (`j1-04`) Finding A-01.
6. Clicked Data Platform: the moved note is in the list but not selected, and "Moved to…" is still showing (UFR #43). (`j1-05`) Its ID is still `ACME.20261103.006` while it lives under Borealis (P-07).
7. The new deliverable appears on a Data Platform card's deliverable picker without a reload. Good.

### J2. Timesheet wiki-link to note, then the back path
1. Time mode, Week 44, scrolled 325 px. Sidebar: Time Entries. (`j2-01`)
2. Clicked the `ACME.20261103.007` link on a card. **The sidebar moves to Rocket Build and the note opens.** (`j2-02`) Correct: this path uses `openNote()`.
3. Opened "Engine design review" and clicked its in-editor link to `BORL.20261103.001` (a Borealis note). **Result: the sidebar still shows Rocket Build, the list still shows Rocket Build notes, and the editor shows Borealis' "Warehouse schema".** (`j2-03`) Finding B-02.
4. Clicked a "Linked from" chip (`BORL.20261103.002`): the same mismatch, still on Rocket Build. (`j2-04`)
5. **Browser Back leaves the app** (about:blank in a fresh tab; in real use this is whatever site came before, or the login page). Forward reloads `/` and lands on the current week (45), not Week 44. Finding B-01.
6. Same journey without the browser (J2b): from the note, click Time Entries. The week is kept (Week 44) but **the scroll position resets from 325 to 0.** (`j2-06`) Finding A-04.

### J3. A note's linked entries, then change that entry's contract
1. Opened Data Platform / "Ingestion pipeline". It lists "Sat, Oct 31 — Pipeline build … Borealis Labs / Data Platform 3h". Clicking the row does nothing (UFR #21). (`j3-01`)
2. Manual route instead: Time Entries, Week 44, changed the "Pipeline build" card's contract to Rocket Build. The card now reads "Acme / Rocket Build", and **the deliverable "Data Phase 2" is silently dropped** (shown as "Add deliverable…"). (`j3-02`) Finding P-05.
3. Back to the note: the linked-entries list shows the new contract label. Correct. It does not hint that the Borealis note now holds an Acme hour.

### J4. Timer on A while editing notes under B
1. On Rocket Build, pressed Start Timer. **Widget: "Select a contract…". Server timer: `contractId` = Launch Ops.** Finding B-04.
2. Picked Rocket Build in the widget and typed a description, then went to Data Platform and edited two notes. Sidebar: Data Platform. The pill keeps running. (`j4-02`)
3. Reload: the widget restores "Acme Corp — Rocket Build". The notes context is lost and the view goes back to time mode (B-01). (`j4-03`)
4. Stop: the completion form shows "ACME / Rocket Build". Correct, because the user set it. (`j4-04`)
5. Save: the entry shows under Today ("Rocket timer work 1m 12:21–12:21"). (`j4-05`)
6. J4b, the same but without a reload, stopping and saving while in notes mode: **no confirmation of any kind**, and the view stays on the Borealis note. The entry is there when you go to Time Entries. Finding A-07.

### J5. Rename a client in admin while notes mode has that client selected
1. On Rocket Build / "Engine design review", went through Settings to Acme, Edit Client, renamed it to "Acme Rocketry" with code ROKT, and came back with Back to Dashboard.
2. **No stale names**: the Move menu, the linked-entries label, the time cards and the Add Entry options all say "Acme Rocketry", because panels re-fetch on mount. (`j5-02`, `j5-03`, `j5-04`) The sidebar cannot be stale because it never shows client names.
3. **Old notes keep `ACME.` IDs; new notes get `ROKT.20261103.001`.** Finding P-07.
4. Side observation: my first attempt reached the admin page with a full page load (typed URL). Coming back from there **reset everything to time mode** (B-01).

### J6. Create a contract in admin, delete a deliverable that has entries
1. Created "Analytics Retainer" under Borealis, then browser Back ×2 to `/`. It appears in the sidebar without a reload, but **sorted first alphabetically, above every other contract, with no client grouping.** (`j6-01`, UFR #18) The earlier Data Platform selection was lost, because the admin client page had been opened with a full load (B-01).
2. Deleted "Rocket Phase 2" (inline Delete, then Confirm, with no warning that 1 entry uses it; `j6-02`). The "Test stand plan" entry now shows "Add deliverable…" (UFR #20, confirmed). (`j6-03`)

### J7. Two tabs
1. Opened the same note in both tabs. Tab 1 typed "TAB-ONE-EDIT" and it saved. Tab 2 does not see it.
2. Tab 2 typed "TAB-TWO-EDIT" and it saved. **The server holds only TAB-TWO; tab 1's text is gone.** Tab 1 still shows its own version and will overwrite tab 2 on its next keystroke. Neither tab says anything. (`j7-01`) Finding B-03.
3. Time entry: tab 1 edited the description and tab 2 edited the duration of the same entry. **Both changes survive** (partial PUT), and tab 2 shows tab 1's description after its own save refreshes the week. Good.

### J8. Mobile: three levels deep, rotate, reload, Back (Chromium and WebKit)
1. Went from level 0 to Rocket Build to the note (level 2). (`j8-01`)
2. Landscape 844×390: still level 2, but the editor is about 80 px tall (`j8-02`, finding A-09). Resized to 1180 (desktop layout), then back to portrait: the note stays open throughout. Good.
3. **Reload: back to level 0 with nothing selected.** (`j8-03`)
4. **Browser Back ×3 leaves the app on the first press.** In an installed PWA or on Android this closes Chronolog. (B-01)

### J9. Keyboard only: log an hour and link a note
1. The first Tab lands on today's "+" (UFR #41). Enter puts focus in the description field. Good.
2. Typing `[[Test` then Enter in the autocomplete inserts `[[ACME.20261103.007]]`. Good.
3. Tab order: contract select, then deliverable, then duration, then Cancel. Enter in duration saves the entry. Good. Native selects work by keyboard.
4. **After saving, focus drops to `<body>`.** Following the card's wiki-link with Enter opens the note, and **focus is on `<body>` again**: the next Tab goes to "Move ▾", not the editor. Finding A-11.
5. The sidebar is about 25 Tabs from the top of the timesheet (content comes first in the DOM). There are no shortcuts: ⌘K and Ctrl-N do nothing, and Escape drops focus.

### J10. Reload at every distinct URL

| URL / state | After reload |
|---|---|
| `/`, time mode, Week 44, sidebar collapsed | Week 45 (current), sidebar expanded |
| `/`, notes mode, Data Platform, note open | Time mode, nothing selected |
| `/admin`, `/admin/clients`, `/admin/clients/:id`, `/admin/clients/:id/contracts/:id`, `/settings/two-factor` | Same page (server-rendered), 200 |
| `/?note=…` | Ignored, opens the default |
| `/notes/:id` | 404 |

**The app has exactly one URL, so no in-app place can be bookmarked, shared, reloaded or reached with Back.**

### Own journeys

**J11. Log a past entry from notes mode.** In time mode, Week 44, then opened Rocket Build / "Test stand plan". Sidebar Add Entry, dated 10 days ago (Week 43), Create. The modal closes with no message and the view stays on the note. Back in Time Entries, Week 44 is shown and **the new entry is not visible** (it is in Week 43). Nothing tells you where it went. (`j11-01`, `j11-02`) Finding A-07.

**J12. Delete a note that time entries link to.** Deleted "Stakeholder interview — CFO" (native `confirm`). Week 44's "CFO interview" card **still shows the link**, and clicking it does nothing: no error, no "note deleted". (`j12-01`) Finding A-10. The backlinks of the other note updated correctly.

**J13. Create and delete while the list and editor disagree.** On Launch Ops, followed an in-editor link to the Rocket Build note `ACME.007`. The sidebar says Launch Ops, the list shows Launch Ops notes, and the editor shows the Rocket Build note.
- **New Note creates the note in Launch Ops** (the sidebar's contract), not the contract of the note you were reading. (`j13-01`)
- The list's **Delete button acts on the editor's note, which is not in the visible list**.

Then the same with the sidebar collapsed (`j13-02`): with the list showing Launch Ops and the editor showing Rocket Build, the screen gives no way to tell.

**J14. Mobile: from the timesheet to a note, then the app's Back.**
1. Time Entries, then the wiki-link on today's card: the note opens at level 2. (`j14-01`)
2. **The app's "← Back" goes to Rocket Build's note list, not the timesheet you came from.** That list still highlights the note and shows a live red **Delete** in its header, which would delete the note you just left. (`j14-02`) Findings A-05, A-06.
3. Back again goes to level 0. You never return to the timesheet.
4. With a timer running, tapping the pill at level 2 jumps to level 0 and abandons the note (`j14-04`). Acceptable, but it is another case of navigation with no history.

**J15. Timer stop and save while in notes mode.** Covered as J4b. No confirmation, and the view does not follow.

**J16. Switch layout mid-task.** Desktop to phone width and back while a note is open (J8.2): the note, contract and mobile level are all kept. Good: layout changes are safe; only document loads lose state.

## Ranked findings

IDs: B = Blocker, A = Annoying, P = Polish. "Owner" is the state or component most likely responsible.

| # | ID | Sev | Finding | Journey / step | Expected | Happened | Shot | Owner |
|---|----|-----|---------|----------------|----------|----------|------|-------|
| 1 | B-02 | Blocker | Note links inside the editor and "Linked from" chips open notes from other contracts and clients without moving the sidebar or list | J2.3, J2.4, J13 | Sidebar, list and editor all show the note's client/contract | Sidebar and list stay on the old contract; New Note goes to the old contract; Delete acts on a note not in the list | j2-03, j2-04, j13-01, j13-02 | `NoteEditorPanel` calls `navigation.selectNote()` instead of `openNote()` |
| 2 | B-01 | Blocker | Navigation state is not in the URL or history: reload, a document load, or browser/Android Back loses mode, contract, note, week, collapsed sidebar and mobile level; Back exits the app | J2.5, J4.3, J6.1, J8.3–4, J10 | `/` restores where I was; Back undoes the last in-app move | Always the default: time mode, current week, level 0; Back leaves Chronolog | j8-03, j6-00 | `navigation.svelte.ts` (memory only), no `goto`/`pushState` |
| 3 | B-04 | Blocker | Start Timer silently binds the timer to the first active contract (alphabetical); the widget shows "Select a contract…" and the completion form preselects that contract | Visual, J4.1 | Start on the current sidebar contract, or no contract until one is picked | Server holds Launch Ops while viewing Rocket Build; hours land on the wrong client if the user does not notice | v19, v22 | `FetchDataService.startTimer`, `TimerWidget.handleStart` |
| 4 | B-03 | Blocker | The same note open in two tabs or windows: last write wins silently; neither tab notices | J7.1–2 | Conflict detection (updatedAt precondition) or a "changed elsewhere" banner | Tab 1's text deleted on the server; tab 1 then overwrites tab 2 on its next keystroke | j7-01 | Notes PUT API (no version check), `NoteEditorPanel` |
| 5 | A-01 | Annoying | Moving a note does not follow it: the editor closes and you stay on the old contract | J1.5–6 | Sidebar moves to the destination with the note open, or the banner offers "Go to" | Old contract, nothing selected, note must be found by hand | j1-04, j1-05 | `NoteListPanel.handleNoteMoved`, navigation store |
| 6 | A-02 | Annoying | No panel names the current client/contract; the list header says "Notes" and the editor shows only an ID | Visual, J13 | A "Client / Contract" crumb on panel 2 and panel 3 (and as the mobile title) | Collapsed sidebar or phone: no context at all | v14, v16, v32, j13-02 | `NoteListPanel`, `NoteEditorPanel`, mobile `AppShell` |
| 7 | A-05 | Annoying | Mobile Back is a level decrement, not history: from a note reached via the timesheet, Back goes to that contract's note list and never back to the timesheet | J14.2–3 | Back returns to the timesheet I came from | Notes list, then root | j14-02 | `goBackMobile`, `AppShell` |
| 8 | A-03 | Annoying | Create flows ignore the current context: New Contract (client), Add Entry (contract, or the week in view), Start Timer | Visual, J11 | Defaults from the current client, contract and week | Blank selects; date is always today | v17, v18, v19 | `ContractCreateModal`, `AddTimeEntryModal`, `TimerWidget` |
| 9 | A-04 | Annoying | Returning to Time Entries keeps the week but resets scroll to the top | J2b | Same week and scroll position | Week kept, scrollTop 325 to 0 | j2-06 | `TimeEntriesPanel` remounts; scroll is not in the store |
| 10 | A-06 | Annoying | After Back on mobile the note list keeps the old note selected with a live Delete button | J14.2 | Delete only while a note is open, or selection cleared on Back | Red Delete next to New Note acts on the hidden note | j14-02 | `goBackMobile` keeps `selectedNoteId`; `NoteListPanel` header |
| 11 | A-07 | Annoying | Entries saved from the modal or the timer give no confirmation, and the view does not move to them; entries in another week are invisible | J11, J4b | A toast with a "Show" link, or the timesheet jumps to the entry's week | Silent; Week 44 shown while the entry is in Week 43 | j11-01, j11-02, j4b-01 | `AddTimeEntryModal`, `TimerWidget.handleSave`, `TimeEntriesPanel` |
| 12 | A-11 | Annoying | Keyboard focus is lost after saving an entry and after following a wiki-link (lands on `<body>`); the sidebar is about 25 Tabs away; no shortcuts | J9.4–5 | Focus moves to the new card or the editor; a skip link or shortcut to the sidebar | `<body>` | j9-04, j9-05 | `NewEntryRow`, `NoteEditorPanel` |
| 13 | A-10 | Annoying | Links to deleted notes still render and do nothing when clicked | J12 | Shown as broken ("deleted note"), or a message on click | Silent no-op (only a console error) | j12-01 | `WikiLinkRenderer`, `TimeEntriesPanel.handleNoteLinkClick` |
| 14 | A-09 | Annoying | Phone landscape: the editor is about 80 px tall; the linked panels take the screen | J8.2 | Editor fills; linked panels collapse or scroll below | Unusable for writing | j8-02 | `NoteEditorPanel` mobile layout |
| 15 | A-08 | Annoying | Notes created through the API with `title` and markdown show as "Untitled" in the list | Seed, Visual | The list uses `title`, or the first line of `content`, when `contentJson` is missing | "Untitled" ×3 | v13 | `extractPreviewLines` / notes list query; matters for the planned Claude secretary/API skills |
| 16 | P-07 | Polish | Note IDs keep the old client code after the client is renamed, or the note is moved to another client | J1.6, J5.3 | Stable neutral IDs, or a re-key on move with an alias | `ACME.…` notes under Borealis; new notes `ROKT.…` | j1-05, j5-02 | Note ID scheme |
| 17 | P-05 | Polish | Changing an entry's contract silently drops its deliverable, and can leave a cross-client note link without any hint | J3.2–3 | Warn, or keep the deliverable when a same-named one exists | Deliverable cleared without notice | j3-02, j3-03 | `TimeEntryCard`, time-entries PUT |
| 18 | P-01 | Polish | Today's section is inset 12 px, so its cards do not line up with other days | Visual | Same left edge for all cards | 264 px vs 276 px | v01, v11 | `TimeEntriesPanel` today wrapper padding |
| 19 | P-12 | Polish | Note previews drop wiki-links, leaving "See ." / "See and ." | Visual | The link label or ID kept in the preview | Dangling text | v13, v32, j14-02 | `extractPreviewLines` |
| 20 | P-02 | Polish | Timer pill shows the Internal (pink) colour when no contract is set; it shows `0:00:01` while the widget shows `00:00:01` | Visual | Neutral colour until a contract is set; one time format | Mismatch | v19, v21 | `TimerIndicator`, `timer-state` |
| 21 | P-03 | Polish | Admin is a visually separate app; "Back to Dashboard" names a screen that does not exist; header and content edges are 8 px apart; admin pages do not link into a contract's notes or hours | Visual, J1 | Same shell, or at least the same header; "Back to Chronolog"; "Open in app" links | Separate chrome | v23–v26 | `src/routes/admin/+layout.svelte` |
| 22 | P-06 | Polish | Phone "Linked time entries": the date wraps and the description runs into the duration | Visual | Single-line date, description truncated before the hours | Overlap | v33, j14-03 | `LinkedTimeEntries` |
| 23 | P-08 | Polish | Contracts with the same name under one client are allowed, and nothing in the sidebar tells them apart | J6.1 | A uniqueness warning, or a client and description hint | Two identical rows | j6-01, j8-02b | admin createContract, `ContractsSidebar` |

**Counts:** 4 Blocker, 11 Annoying, 8 Polish (23 new). UFR #5, #18, #19, #20, #21, #23, #25, #26, #28, #30, #41 and #43 were re-confirmed along the way.

**What works today:**
- State survives client-side trips to admin and back.
- Panels re-fetch on mount, so renamed clients and new contracts and deliverables show up without a reload, and nothing went stale.
- A wiki-link on a timesheet card sets the sidebar correctly.
- Concurrent edits to different fields of one time entry merge.
- Changing an entry's contract updates the note's linked-entries list.
- Changing between desktop and phone width keeps the open note.

## What the sidebar means: today vs target

### Rules the app follows today (as observed)
1. **Two modes, one highlight.** "Time Entries" is highlighted exactly when `mode = time-entries`. A contract is highlighted exactly when `mode = notes` and it is `selectedContractId`. Nothing in the sidebar ever reflects time mode's content (no client or contract filter).
2. **The client is stored, never shown.** `selectedClientId` is set by `selectContract` but nothing renders it. The list is flat and alphabetical across clients, and colour dots are the only client cue.
3. **Selecting a contract clears the note.** Selecting Time Entries clears contract, client and note.
4. **Only one entry point keeps the hierarchy consistent.** A timesheet card link uses `openNote()`, which sets contract, client and note together. Every other way to open a note (list click, in-editor wiki-link, Linked from) only sets `selectedNoteId`. As a result the sidebar can disagree with the editor.
5. **The week is sticky, scroll is not.** `selectedWeek` survives mode changes. Scroll is lost whenever the timesheet remounts.
6. **State lives in memory in the root layout.** It survives client-side route changes and layout switches. A document load of any kind wipes it. Nothing is in the URL.
7. **The mobile level is its own counter.** Back means `level - 1` and does not clear the selection. Browser history is never written.
8. **Sidebar data loads on mount.** Counts and the list are only refreshed by a remount (admin trip or reload), not by in-app mutations.
9. **Moving a note is a removal.** It disappears from the current list, the selection clears, and the contract does not change.

### Target rules for the fix sprint
1. **One invariant:** if a note is open, the selected contract is `note.contractId` and the selected client is that contract's client. All note-opening paths go through one function (`openNote(noteId)` resolves the contract itself). The note list always shows the open note's contract.
2. **The URL is the state.** For example `/time/2026-W44`, `/c/:contractId`, `/c/:contractId/n/:noteId`. Every user navigation pushes a history entry. Reload restores. Browser, Android and the app's Back all mean history back. The mobile level is derived from the route (time or contract = 1, note = 2), not stored.
3. **The sidebar shows hierarchy.** Contracts are grouped under client headers (Internal first, then clients A–Z). The selected contract's client header is also highlighted. In time mode no contract is highlighted, unless a client/contract filter is added later.
4. **Every panel names its context.** Panel 2 header: "Client · Contract". Panel 3 header: a breadcrumb plus the note ID. The mobile title says the same, and Back says where it goes ("← Rocket Build", "← Week 44").
5. **Create from context.** New Note, Add Entry, Start Timer and New Contract default to the selected client, contract and week. The timer never picks a contract the user did not see.
6. **The view follows the object.** After moving a note, saving an entry to another week, or following a link to another contract, the view goes there, or shows a toast with a "Go to" link.
7. **Returning restores.** Coming back to the timesheet restores week and scroll, ideally scrolled to the entry you came from.
8. **Mutations invalidate sidebar data.** Note create, move and delete, and contract create and rename, update counts and lists without a remount (a shared store or event).
9. **Destructive actions only act on what is visible.** The list's Delete shows only while the open note belongs to the visible list. On mobile it lives in the editor, not the list.

## Fix these five first
1. **Put a single `openNote(noteId)` behind every note-opening path** (B-02, A-01 partly). The editor's wiki-link handler and the Linked from chips call it; it looks up the note's contract and selects it. This is small, fixes the worst hierarchy break, and makes Delete and New Note safe.
2. **Back the navigation store with the URL and history** (B-01, A-05, A-04 partly). Routes for time week, contract and note; `goto`/`pushState` on every selection; mobile level derived from the route. This one change makes reload, bookmarks, browser and Android Back, and the mobile Back path work.
3. **Stop the timer choosing a contract silently** (B-04, A-03 partly). Start on the selected sidebar contract, or ask for one. Show the chosen contract in the widget and the pill immediately.
4. **Detect note conflicts across tabs** (B-03). Send `updatedAt` with each PUT, reject stale writes with 409, and show "This note changed elsewhere: reload / keep mine". This is a prerequisite for the Tauri multi-window spec.
5. **Show the context and follow the object** (A-02, A-01, A-07). Add the "Client · Contract" crumb to panel 2 and panel 3 and the mobile title. Make Move select the destination and keep the note open. Show a "Saved to Wed 28 Oct · Show" toast for modal and timer saves.
