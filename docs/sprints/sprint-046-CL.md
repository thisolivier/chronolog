# Sprint 046 — CL: Search results interleaved, with type icons

**Status:** merged
**Branch:** `sprint-046-CL/search-results-layout` · **Worktree:** `.claude/worktrees/sprint-046-CL` · **Port:** 5225
**Sources:** owner request 2026-11-04 after 042 shipped: "time entries and notes interleaved with an icon on the left to identify type, and client/contract clearly visible; crunches into one line for mobile (icon into client/contract)." Runs in parallel with 043 and 044; wave rules in `docs/sprints/_wave-rules.md` apply (no migration).

**Owns:** the `/search` results page and its components only. Do not change `GET /api/search`'s response shape or `chronolog search` (the laptop secretary reads `--json`); interleave on the client. Do not touch notes components (043) or CLI/auth/shell files (044).

## Tasks

1. **One interleaved list.** Notes and time entries in a single list, newest first by date (note: last modified or the note's date as the page shows it; entry: its date, then start time). Keep the per-type totals as a small summary line at the top ("4 notes · 7 time entries"), not as section headings. Keyboard navigation (arrow keys, Enter) still walks the combined list in order.
2. **Desktop/tablet row (≥ 768 px).** A type icon in a fixed left column (a note icon and a clock icon, inline SVG, no icon-font dependency, with an accessible label "Note" / "Time entry"). To its right: the client and contract on their own line, clearly readable (client colour dot, "Client / Contract", normal contrast, not the current small uppercase grey), then the title or description with highlights, then the snippet; date (and duration for entries) aligned right.
3. **Phone row (< 768 px).** One line per hit for the meta: the icon sits inline at the start of the client/contract line (no left column), date/duration at the end of that line; title/description below, snippet trimmed to one or two lines. No horizontal scroll at 320 px.
4. **Tests.** Unit for the interleave/sort function; Playwright at desktop and phone viewports: mixed results interleaved by date, icon labels present, client/contract visible, click-through still opens note and entry (chromium and webkit).

## Verification

Screenshots desktop and phone of the same mixed query in `docs/review/screenshots/sprint-046/`. Sign-off as per the wave rules.

## Sign-off

**2026-11-04, implemented on `sprint-046-CL/search-results-layout`, rebased onto `main` (`c37b891`). Status: ready for review, not merged.**

### Done

1. **One interleaved list.** `search-interleave.ts` merges the API's two groups on the client (`GET /api/search` and `chronolog search` unchanged): a note sorts by its last modified time (what the row shows), an entry by its date then start time (none = start of the day), both compared as local `YYYY-MM-DDTHH:MM`; ties keep the server order. A summary line on top ("3 notes · 3 time entries", "50 of 120 notes" when cut); no section headings. Up/Down/Enter walk the combined list in order, Up from the first hit returns to the field.
2. **Desktop/tablet row (md, ≥ 768 px).** `SearchHitRow.svelte`: a two-column grid; `SearchTypeIcon.svelte` (inline SVG page / clock, `role="img"`, labelled "Note" / "Time entry") fills the left column; to its right the client colour dot and "Client / Contract" in normal case and contrast (`text-sm`, stone-700), the date (and "· 1h 30m" for entries) at the end of that line, then the title or description with highlights, then the snippet.
3. **Phone row (< 768 px).** Same grid: the icon stays in the first cell of the client/contract line, the title/description and snippet span both columns underneath. To keep the contract readable at 320 px the client shows as its short code (full name in the `title`), and an entry date as "Oct 22"; note snippet one line, entry description up to two. No horizontal scroll at 320 or 390 px (checked in the test).
4. **Client colours** come from `GET /api/clients?includeArchived=true`, fetched once by the /search page (`fetchClientColorIndexes()`), so the search response keeps its shape; until it loads, or if it fails, the dot is grey.

### Deviations

- Phone shows the client short code rather than the full client name (full name from 768 px up). Decided for legibility of the contract at 320 px; easy to swap if the owner prefers the name.
- A note backdated with `createdAt` still has today's `updatedAt`, so the Playwright seed interleaves notes written now between a late-today entry and older entries (entry, note, note, note, entry, entry) rather than alternating one by one; the unit test covers strict alternation.

### Tests

- `npm run check` 0 errors (the 3 existing warnings in `src/routes/+layout.svelte`); `npm run lint` clean; `npm test` **983 passed in 100 files** (with the dev `.env` loaded; new `search-interleave.test.ts`, 6 tests).
- Playwright, new `e2e-playwright/search-results-layout.spec.ts` (desktop 1100 px; phone 320 and 390 px) plus the updated `search.spec.ts`: **15 passed** (chromium and webkit, `qa-046-pw` users, port 5225). Smoke of the whole suite on chromium: **68 passed**.

### Verification

Screenshots of the same mixed query in `docs/review/screenshots/sprint-046/`: `01-desktop-results.png`, `02-phone-320-results.png`, `02-phone-390-results.png`.
