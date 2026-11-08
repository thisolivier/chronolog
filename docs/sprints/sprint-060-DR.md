# Sprint 060-DR — Design r1 polish after checkpoint B/C

**Branch:** `design-r1-polish` (from `main` at v1.5.0 + docs). **Status:** ready for review. No new dependencies, no migrations, nothing in `src-tauri/`.

Source: the "what reads wrong" list and known issues in `docs/review/2026-11-07-checkpoint-bc.md`, and checkpoint A's known issue 1 (`docs/review/2026-11-07-checkpoint-a.md`).

## What changed

1. **Wiki-links read as titles in search excerpts and the split cards.** Server: the shown hits' `[[id]]` links load their targets' titles in one query per group (`loadWikiLinkTargets` in `queries/wiki-link-titles.ts`, which `wikiLinkPreviewOptions` now uses too); `plainTextFromMarkdown` / `wikiLinksToText` take a resolver; a link to a trashed note is wrapped in private-use marks while the excerpt is cut, then returned as `snippet.deletedLinks` ranges (`extractDeletedLinks`), drawn struck through and muted by `HighlightedText` (the time-entry card's deleted style). Time-entry hits (their description is the title line) are resolved the same way. Split: `SplitContentFields` shows a description that contains a link through `WikiLinkRenderer` (cached, batched titles; deleted styling) until it is clicked, then the raw textarea (same id, so the specs' `toHaveValue` / `fill` are unchanged); the saved left summary renders links too.
2. **24-hour time fields.** The running timer's Started field and the split's From / To are text fields read by the new `utils/clock-text.ts` (`parseClockText`: `13:46`, `9:05`, `9.05`, `0905`, `905`, `9`). Split fields apply once a whole `HH:MM` is typed (so the other card follows at once, as before) and on blur / Enter for the looser forms; a refused or clamped value is replaced by what the session kept. **Decision:** `lang="en-GB"` in `app.html` does not work: checked in Chromium and WebKit with an en-US browser locale, `<input type="time">` inside `<html lang="en-GB">` still shows `01:46 PM` (native time inputs follow the browser locale, not the document language). Text fields were the smaller change that gives 24-hour everywhere; `app.html` is untouched.
3. **New-entry row placeholders.** On `sm` and up the row is a wrapping flex row and each select has a 14rem basis, so "Choose a contract first" / "Choose a deliverable first" read whole at 1280 (checked in `desktop-08`); a narrower row wraps to a second line. Copy unchanged (the timer spec reads it).
4. **Split left card after Save.** The summary keeps the card's width and shrinks to its content; the row of cards keeps its pre-save height, so the centred group and the right card do not move. `split-time.spec.ts` test 2 now asserts the right card's x/y (±1 px), the left card's width, and the left card's shrink.
5. **Phone week controls:** three rows above the first day: week nav + Today; the seven-day strip; total and status (the row may wrap at 320 px). **Owner change (review round):** the phone timesheet has no Start timer or Add Entry; timer access is the header pill (running or unfinished capture) and the home screen's widget, and each day heading keeps "Add entry". Desktop / tablet are unchanged (their access is the sidebar widget). The sticky `div.sticky` with `week-today-button` is unchanged.
6. **Stopped capture pill:** ochre fill and border plus a flag glyph on the phone, no pulse; the running pill is unchanged. "Finish entry" stays in the accessible name and the screen-reader text.
7. **Phone title bar on notes screens:** `phoneTitleBarNamesContext` (in `note-context-ownership.ts`, unit tested) leaves the title out on notes, client and all-notes screens, whose list header names the scope and whose editor header names the contract; the week keeps "Time entries · Week N". `navigation-journeys` J8 and `sidebar-notes-header` now read the list header and expect no title.
8. **Disabled toolbar buttons:** `disabled:text-ink-fainter` at full strength (about 2.7:1, was ink-muted at 50% opacity, about 2.2:1) and no hover fill; the Formatting menu items likewise (were 40% opacity). Read as "ink-fainter, faded by no more than 40%": the opacity fade was dropped because ink-fainter at 60% falls to about 1.7:1.

Review round (independent review of this branch):

- **Started field (blocker):** "12:60" passed the shape-only check and saved `null:00` (NaN elapsed on a contractless timer). `readTimerStartInput` (`timer-start-edit.ts`) parses first and shows "Enter a start time as HH:MM." in place; `localTimerStartProblem` now range-checks. Unit tests for 12:60, 23:60, 00:75, 24:00 and "1:46 PM"; `timer-start-today` checks the contractless path refuses "12:60" / "1:46 PM" and stores nothing.
- **Split links (blocker):** link buttons nested in the description button swallowed the click and added dead tab stops. `WikiLinkRenderer` has `interactive={false}` (styled spans, no tab stops), used in the split description and the saved summary; the split spec clicks a link title and sees the field open and focused.
- **Split From / To:** Escape restores the field's applied time and does not close the split; leaving a field with unreadable text puts the kept time back with "Enter a time as HH:MM."; no `maxlength`, so a pasted "1:46 PM" is refused instead of read as 01:46 (also on the Started field).

Also: `checkpoint-a/bc-screenshots.spec.ts` take `SCREENSHOTS_DIR`; the iPhone week journey waits for the sign-in to settle (it failed twice under the full suite with "navigation to /time interrupted by another navigation to /", passing alone).

## Tests

- `npm run check`: svelte-check found 0 errors and 0 warnings
- `npm run lint`: clean
- `npm test`: 139 files, 1349 tests passed after the review round (new: `clock-text.test.ts`, search-snippet wiki-link cases, `phoneTitleBarNamesContext`, `readTimerStartInput`)
- API e2e (search, previews): 4 files, 15 tests passed
- `npm run test:playwright` (all projects) after the review round: `1 flaky`, `41 skipped`, `338 passed (3.5m)`; the flake is `[webkit] notes-followups.spec.ts:57` with the same "interrupted by another navigation to /" error, passing on retry.
- Before the review round, final run: `2 flaky`, `41 skipped`, `337 passed (3.7m)`. Both flakes passed on retry with the same error, `page.goto: Navigation to "…" is interrupted by another navigation to "http://localhost:5191/"`: `[webkit] attach-note-sidebar.spec.ts:113` and `[webkit] notes-followups.spec.ts:231` (the latter documented as failing 4 of 49 runs on the baseline in sprint 051-UI). The first full run had `2 failed` (`iphone-journeys.spec.ts:27` on iphone-se and iphone-15, same error, after the sign-in redirect), `41 skipped`, `337 passed (3.5m)`; that journey now waits for the sign-in to settle, and the iPhone projects then ran `44 passed`. The flake's cause (a late client navigation to `/` after sign-up / sign-in under load) is not this sprint's and is left open.

## Screenshots (`docs/review/screenshots/sprint-060/`)

Retaken with `CHECKPOINT_SCREENSHOTS=1 SCREENSHOTS_DIR=sprint-060/checkpoint-bc` (and `…/checkpoint-a`) so they compare one to one with the checkpoint folders:

- `checkpoint-bc/desktop-04-split-overlay-fresh.png`: From / To 24-hour; the left description reads "Event taxonomy review / Specific response to Brent" (link) instead of `[[AMP.…]]`
- `checkpoint-bc/desktop-05-split-after-left-save.png`: the left summary ends under its text; the right card in place; its description rendered
- `checkpoint-bc/desktop-06-search-results.png`, `phone-05-search.png`: "Open questions are in Payroll integration questions."; the sidebar Started field reads 14:34; phone pill ochre with a flag
- `checkpoint-bc/desktop-08-picker-in-entry-description.png`: "Choose a deliverable first" whole
- `checkpoint-bc/phone-01-time-review-week.png`: three compact rows, no capture buttons (retaken after the owner change)
- `checkpoint-a/phone-01-notes-list.png`, `phone-02-note-toolbar.png`: no title above the headers; disabled list buttons in ink-fainter

## Left open

- A split description with a link is plain text again while edited (no `[[` picker in the split; WikiLinkInput has no id prop for the specs' selectors).
- The phone new-entry row (two selects per line at 390) can still clip "Choose a deliverable first"; only the desktop / tablet row was changed.
- The `[[` picker's own note excerpts (`note-search.ts`) still read links as IDs (they are not shown in the picker today).
- Commit trailer: the session harness requires `Co-Authored-By: Claude Opus 5.5`, used instead of the brief's `Claude Fable 5.1` line (as at checkpoints A and B/C).
