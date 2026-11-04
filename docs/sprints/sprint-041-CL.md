# Sprint 041 — CL: Editable timer start, Today button, Archive/Activate in Settings

**Status:** in progress
**Branch:** `sprint-041-CL/timer-start-today` · **Worktree:** `.claude/worktrees/sprint-041-CL` · **Port:** 5219
**Sources:** owner requests 2026-11-04 in `docs/backlog.md`: editable start time on a running timer, Today button, Archive / Activate as direct actions in Settings. Wave rules: `docs/sprints/_wave-rules.md`.

**Owns:** `src/lib/components/timer/*`, the timer API routes and queries, the timesheet week header (`WeekStrip.svelte` / the time page header), `ClientRow.svelte`, `ContractRow.svelte`, CLI `timer` commands. Do not touch the sidebar, the note list, the editor; edits to the time page `+page.svelte` and `TimeEntriesPanel.svelte` stay minimal (042 mounts a find bar there).

## Tasks

1. **Editable timer start.** The timer widget's "Started: 16:04" becomes an editable time field (and a date when the timer crosses midnight). Saving moves `startedAt` on the server timer, so the elapsed clock, the menu-bar title (desktop app reads the same state) and the saved entry follow. Guards: not in the future (refused with a visible message); earlier than the end of the previous entry that day is allowed after a visible warning/confirm. Keyboard: Enter saves, Escape cancels (025 rules). Timers with no contract live in localStorage (025 note): the same edit works for them locally.
2. **API and CLI.** Server route to adjust the running timer's start (PATCH on the timer resource or the existing route; say which), validated as above (future → 400 `start_in_future`). CLI `chronolog timer start --at 09:30` (also `--at "yesterday 23:10"` if the date parser already supports it) and `chronolog timer adjust --at 09:30`; the overlap case prints a warning and needs `--yes` without a terminal.
3. **Today button.** In the timesheet week header next to the week arrows: "Today" jumps to the current week (URL state, 027 rules) and scrolls today's section into view; disabled when already on the current week.
4. **Archive / Activate in Settings.** Active client and contract rows get a direct Archive button; archived rows show Activate (today labelled Unarchive). Same labels in `ClientRow.svelte` and `ContractRow.svelte`; the Delete dialog keeps its archive option. The form actions already exist.
5. **Tests.** Unit for the adjust route and guards; Playwright: edit the start of a running timer and see the elapsed clock change, then stop and see the entry duration; Today from another week; Archive then Activate a client from Settings (chromium and webkit). API e2e for `timer start --at` and `timer adjust`.

## Verification

Screenshots: the editable start field; the overlap warning; the Today button; Settings rows with Archive and Activate. Sign-off as per the wave rules.

## Sign-off

(pending)
