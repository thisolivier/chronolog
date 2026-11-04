# Sprint 046 — CL: Search results interleaved, with type icons

**Status:** in progress
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

(pending)
