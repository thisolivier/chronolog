# Sprint 059-DR — Global search route and the `[[` link picker (design r1 stage 7)

**Status:** ready for review
**Branch:** `design-r1-stage7` (from `design-r1` at v1.4.0) · **Worktree:** `.claude/worktrees/design-r1-stage7`
**Sources:** spec `docs/design/r1/specs/07-search-and-linking.md` (SR-01..SR-07), SH-05 in
`02-shell-and-navigation.md`, source map `06-07-notes-search-picker.md` §§5–6, sprint 058-DR (API).
No schema change, no migration, no new dependency, `/api/search` and `/api/notes/search` response
shapes unchanged (the CLI reads `/api/search`). Not touched: `src-tauri/`, `timer/*`, `weekly/*`,
`TimeEntriesPanel.svelte`, `CLAUDE.md`.

## What changed

### A. /search inside the app shell (SR-01, SH-05)

- **Approach:** the route moved to `src/routes/(workspace)/search/+page.svelte`. The workspace
  layout passes the page to `AppShell` as a new optional `searchPage` snippet (and renders its own
  `children` only for the other, empty workspace pages). With `searchPage` set, AppShell renders it
  in place of panels 2 and 3 (desktop/tablet) or of the whole panel (phone); the sidebar stays. The
  navigation store already ignores non-workspace paths (it keeps the last workspace place), so no
  store change was needed; opening a hit navigates as before.
- **AppShell diff kept small** (one prop, one `leaveSearch()` helper, `{#if}` guards): the header
  `GlobalSearchField` is not rendered on /search (no reserved space); the phone bar shows
  "← Back to app" (`search-back-to-app`; Back when the previous step is a workspace place, else the
  last workspace place) plus the timer pill, without Find or the search icon.
- Navigation, ‹ › and the timer are now available on /search; the shell's one-visible-timer rule
  applies unchanged (widget in the sidebar, pill when the sidebar is hidden, pill on a phone).
- `ContractsSidebar` highlights nothing on /search (otherwise "Time Entries" looked selected while
  the search results were on screen).
- **One large query field** (`GlobalSearchField size="large"`, same test id and accessible name)
  above the results for prompt, loading, no matches, failure and results. Header → route hand-off:
  Enter in the header field (or Cmd+K, type, Enter) goes to `/search?q=`, the large field mounts
  focused with the caret after the query. On a phone the field takes focus only with no query.
- States are distinct (`search-status` with `data-state` `prompt` / `loading` / `empty` /
  `error`); failure keeps the query and offers Try again. Each search has a sequence number as well
  as an AbortController, so an older reply cannot replace a newer one.
- The page title moved to the workspace layout (`Chronolog · Search · <q>`).

### B. Results (SR-02)

- Order: the server's rank, then recency (`interleaveSearchHits`, unchanged since 058-DR); no other
  re-sort.
- Row: type icon and title (an entry's description, with highlights) first; then `ContractMark`
  (sm, from the hit's `clientColorIndex`; the `/api/clients` fetch is gone) and "Client /
  Contract"; then the excerpt with the server's ranges in ochre. Metadata-only hits show
  "Matches client Amplitude" (`search-hit-reason`, from `matchedContext`) and no excerpt.
- Desktop: quiet date at the right, an entry's duration under it. Phone: wraps, date and duration
  beneath the excerpt. Entry dates are "Nov 5" (year added when not this year). Hairline separators.
- Active (focused) row: sage fill (`bg-moss-100`) and pine edge (`border-selection-edge`), as in the
  note list. Keyboard walk and opening behaviour unchanged.

### C. The `[[` picker (SR-04..SR-07)

- **Linkable targets are notes only** (confirmed in source: every parser, both pickers and both link
  tables target `notes.id`; entries are UUIDs with no link-target support). Canonical insertion
  stays `[[NOTE_ID]]` (a `wikiLink` node whose label is the ID, plus a space).
- Shared pieces in `src/lib/components/search/` (see its README): `LinkPicker.svelte`
  (presentational listbox), `link-picker-search.svelte.ts` (debounce 150 ms, numbered and aborted
  requests, `loading` / `ready` / `error`), `link-targets.ts` (`fetchLinkTargets`,
  `LinkPickerItem`), `link-picker-placement.ts` (pure placement against the visual viewport).
- Editor glue: `notes/extensions/wiki-link-picker.svelte.ts` replaces `SuggestionDropdown.ts`. The
  TipTap plugin's `items` now returns `[]` at once, so its awaited-items race (older reply shown
  last) cannot happen; the renderer queries through the composable instead.
- No header, no scope tabs, no close control, no second input, no contract/client/timer filter.
  `[[` alone lists recent notes of every contract; typing continues the query in the editor.
- Rows: contract mark, title, "Client / Contract"; desktop date and code at the right, phone code
  stacked and no date. Active row sage fill + pine edge. `role="listbox"`, `aria-label="Link a
  note"`, rows `role="option"` with `aria-selected`; no visible heading.
- Keys: ArrowUp/Down (stop at the ends, as before), Enter inserts; click/tap inserts. The panel
  prevents `mousedown`, so the editor keeps focus, the caret follows the link and a phone keeps
  its keyboard. One transaction, so one undo restores the typed `[[query`.
- Dismissal: Escape, a press outside editor and list, or editor blur end the suggestion and
  unmount the popup (fixes the hidden popup that kept updating). The token start is remembered
  (`storage.wikiLink.dismissedFrom`, checked by the suggestion's `allow`), so typing on does not
  reopen it; it is forgotten once that `[[` is deleted. Leaving the token or the note closes it
  (plugin behaviour, now with full disposal).
- Placement: `position: fixed` layer on `<body>` (`[data-link-picker-layer]`). Desktop anchored to
  the token, 460 px wide, flips above near the bottom, clamped sideways, max 320 px with internal
  scroll, no dimming or reflow. Phone: full width, under the query when the room above the keyboard
  holds the list, else above the query, so the query stays visible; uses `visualViewport` (resize
  and scroll listeners), so with no keyboard the whole screen is available (max 360 px).
- States: "Searching…" while nothing is shown yet (older rows dim while a newer query loads),
  "No matching notes", and a distinct failure line.

### WikiLinkInput adoption (for the stage 6 branch; `weekly/WikiLinkInput.svelte` not edited here)

`WikiLinkInput` keeps its own token detection (last unclosed `[[` before the caret) and plain-text
insertion (`[[ID]]`, caret after). Replace its fetching and list with the shared pieces:

```svelte
<script lang="ts">
  import LinkPicker from '$lib/components/search/LinkPicker.svelte';
  import { createLinkPickerSearch } from '$lib/components/search/link-picker-search.svelte';
  import { placeLinkPicker } from '$lib/components/search/link-picker-placement';
  const search = createLinkPickerSearch({ onChange: () => (activeIndex = 0) });
  // on input: token = activeToken(value, caret); token === null ? close() : (open = true, search.setQuery(token.query))
  //   (an empty query now fetches recent notes: SR-04 gap closed)
  // keys while open: ArrowUp/Down move activeIndex (today it wraps: keep or align, owner's call),
  //   Enter inserts search.items[activeIndex], Escape closes and keeps the text
  // insert(index): replace token.start..caret with `[[${item.noteId}]]`, caret after (unchanged)
  // on destroy / close: search.dispose()
</script>
<LinkPicker items={search.items} status={search.status} {activeIndex} variant={isPhone ? 'phone' : 'desktop'}
  idPrefix="entry-link" maxHeight={placement.maxHeight} onChoose={insert} onActivate={(i) => (activeIndex = i)} />
```

- Place the list with `placeLinkPicker({ anchor: input.getBoundingClientRect(), viewport:
  visualViewport, contentHeight, isPhone })` in a `fixed` wrapper (or keep it under the input on
  desktop if that reads better in the card; the phone should use the placement so it stays above
  the keyboard).
- The panel already prevents `mousedown`, so the 150 ms blur-close workaround can go (close on
  blur straight away, unless `relatedTarget` is inside the panel).
- Set `aria-controls`/`aria-activedescendant` on the input to `${idPrefix}-list` /
  `${idPrefix}-option-${activeIndex}`, `aria-expanded` while open.
- Its tests then need the `link-picker-option` rows / the "Link a note" listbox instead of the old
  `id · title` rows.

## Decisions (conservative readings)

- **Enter still submits on /search** (typing is not a history step, submitting is; 050-UI). No
  search-as-you-type on the route. Recorded as a follow-up.
- **No desktop shortcut footer** in the picker ("↑↓ Choose · ↵ Insert · Esc Close" in the crop):
  the override removes header and close controls, and "Esc Close" reads as one; left out.
- **Phone Forward (›)** stays in the /search bar when a step is ahead (history, not search).
- **Metadata-only hits** show only the reason line, not the unhighlighted body start.
- **While a newer picker query loads**, the previous rows stay (dimmed, `aria-busy`) rather than
  flashing empty on every key; Enter inserts the row that is shown.
- **Picker fetch stays direct** (`/api/notes/search`), as before; offline use of the picker
  (DataService `searchNotes`) is a follow-up.

## Tests (2026-11-07, dev server from this worktree on :5188, `--retries=0`)

- `npm run check`: `svelte-check found 0 errors and 0 warnings`
- `npm run lint`: `> eslint .` with no output (clean)
- `npm test`: `Test Files  128 passed (128)` / `Tests  1219 passed (1219)`
- `npx playwright test --project=chromium`: `8 skipped` / `118 passed (1.2m)`
- `npx playwright test --project=iphone-se --project=iphone-15 --project=iphone-15-pro-max`:
  `5 skipped` / `26 passed (27.3s)`
- `npx playwright test --project=chromium search-and-picker --repeat-each=3`: `19 passed` (with the
  auth setup), no flake.
- API e2e (`npm run test:e2e`) not run: no server code changed.
- New: `e2e-playwright/search-and-picker.spec.ts` (6 tests, 2 tagged `@iphone`),
  `search/link-picker-placement.test.ts` (7), `search/search-match-reason.test.ts` (3), a year case
  in `search-interleave.test.ts`.
- Updated: `notes-navigation.spec.ts:34` finds the picker by role (`listbox` "Link a note") instead
  of `body > div.absolute.z-50`; `search-results-layout.spec.ts` (title-first rows, date right on
  desktop and beneath on a phone, contract mark); `history-buttons.spec.ts` (‹ › of the shell above
  the one large field, no header field on /search). `search.spec.ts`, `iphone-journeys.spec.ts`,
  sidebar and timer specs pass unchanged.
- Note for test authors: pressing Enter immediately after clicking into the editor and pressing End
  can act on ProseMirror's stale selection (the document start); the new spec waits 150 ms. This is
  a Playwright timing effect, seen on the base branch too.

## Screenshots (`docs/review/screenshots/sprint-059/`)

- `desktop-01-results-mixed.png` — mixed notes and an entry, first row active (sage, pine edge).
- `desktop-02a-loading.png`, `desktop-02b-no-matches.png` — loading and no matches, one large field.
- `desktop-03-picker-in-editor.png` — the picker under `[[Roles and Perm` in the editor.
- `iphone-04-search-results.png` — iPhone 15: Back to app, timer pill, field, wrapped results.
- `iphone-05-picker-above-keyboard.png` — iPhone 15 with the viewport cut to 400 px (keyboard):
  the list sits above the query, inside the visible area.

## Follow-ups

- WikiLinkInput adoption (above), on or after the stage 6 merge.
- Search-as-you-type on /search (debounced, `replaceState`), if the owner wants it.
- `aria-activedescendant` / `aria-expanded` on the ProseMirror editor while the picker is open
  (ProseMirror owns the element's attributes; needs an `editorProps.attributes` hook).
- Picker offline: route `fetchLinkTargets` through the DataService (`searchNotes`, cache + outbox).
- Desktop shortcut footer in the picker, if wanted (left out, see Decisions).
- On iOS hardware: confirm the tap keeps the keyboard up and the `visualViewport` placement
  (verified here in WebKit emulation with a reduced viewport only).
- The /search page on tablet in notes mode keeps the sidebar as an overlay (≡); acceptable, but a
  docked sidebar may read better there.
