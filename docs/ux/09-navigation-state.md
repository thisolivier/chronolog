# Navigation State

Sprint 027-CL made the URL the navigation state. The rules below are the target rules of the
journey review (`docs/review/2026-11-03-ux-journeys.md`, "What the sidebar means"), adopted as the
spec, with how each one is enforced and tested.

## URL scheme

| URL | Screen | Phone level |
|-----|--------|-------------|
| `/` | Phone: the sidebar (home). Tablet and desktop: this week's timesheet | 0 |
| `/time/2026-W45` | Timesheet for ISO week 45 of 2026 (`/time` alone = this week) | 1 |
| `/notes/<contractId>` | A contract's note list | 1 |
| `/notes/<contractId>/<noteId>` | A note, open under its contract | 2 |
| `/notes/<contractId>/new` | An unsaved new-note draft for that contract | 2 |
| `/settings/...`, `/admin/...` | Settings and admin (unchanged) | — |

A week that does not exist (`2026-W60`, `W53` of a 52-week year), a malformed contract ID and bare
`/notes` are 404s. The login, register, unlock and device-gate routes are untouched.

The workspace URLs share `src/routes/(workspace)/+layout.svelte`, which hosts the panels, so moving
between them never remounts the sidebar, list, timesheet or editor. The pages themselves are empty.

## How the store works

`src/lib/stores/navigation.svelte.ts`, created once in the root layout:

- **Reads the URL**: on creation (SSR and hydration start from the same URL) and after every
  navigation, through `afterNavigate` → `syncFromUrl()`. Browser Back/Forward, links, typed URLs and
  reloads all go through this.
- **Writes the URL** on every user action with SvelteKit `goto` (`noScroll`, `keepFocus`). The state
  changes at once, so a component reading the store right after calling it sees the new value.
  Actions in the same tick become one navigation (e.g. `selectTimeEntries()` then `selectWeek()`).
- **History entries** (sprint 050-UI: every navigation is a step, typing is not): mode, contract,
  client and note changes push, and so does each week paged or picked (week arrows, Today, a
  search hit). Closing or deleting a note, a draft turning into its saved note, a note made offline
  getting its real ID, moving a note to another contract, and a wrong contract being corrected
  replace the current entry. Autosave, title and description edits, timer fields and typing in the
  search field never touch the history; submitting a search pushes `/search?q=…`.
- **Not in the URL**: the collapsed sidebar is a per-device preference (localStorage); the
  timesheet's scroll position per week and the in-app history mirror live in sessionStorage.

The component API is unchanged (`mode`, `selectedContractId`, `selectedClientId`, `selectedWeek`,
`selectedNoteId`, `mobileNavigationLevel`, `selectTimeEntries`, `selectContract`, `selectWeek`,
`selectNote`, `openNote`, `clearSelectedNote`, `toggleSidebar`, `navigateMobile`, `goBackMobile`).
Added: `openDraft`, `showTimeEntryDay`, `isHome`, `isDraftOpen`, `route`, `workspaceHref`,
`backTarget`, `layoutMode`, scroll-memory helpers, and optional `{ replace }` on `openNote` and
`selectTimeEntries`.

## Rules

1. **One invariant.** If a note is open, the selected contract is the note's contract and the
   selected client is that contract's client. Every way of opening a note (sidebar list, card
   wiki-link, editor wiki-link, "Linked from", search, linked entries) goes through `openNote`. The
   client is derived from the contract (`contractDirectory`), never stored separately. A URL that
   names the wrong contract for a note is corrected in place once the note loads.
2. **The URL is the state.** Reload, bookmarks and shared links restore the screen. Browser,
   Android and the app's own Back all walk the real history. The phone level is derived from the
   route (table above). A page opened straight on a deep link gets `/` put under it, so Back goes
   up into the app instead of out of it. The top bar's ‹ › (050-UI; Cmd/Ctrl+[ ], Alt+←/→) walk
   this tab's in-app history and are disabled at its ends, so they never leave the app.
3. **The sidebar shows hierarchy.** Contracts sit under client headings (sprint 026). The selected
   contract and its client heading are highlighted. "Time Entries" is highlighted while the
   timesheet is on screen; on the phone's home nothing is.
4. **Every panel names its context.** The note list header shows client and contract; the editor
   header shows "Client / Contract" before the note ID; the phone top bar shows "← <where Back
   goes>" ("← Week 44", "← Rocket Build", "← Chronolog") and the current place.
5. **Create from context.** New Note uses the selected contract. New Contract preselects the
   viewed client. Add Entry preselects the viewed contract (notes) and the viewed week (timesheet:
   today if in that week, else its Monday). Start Timer uses the viewed contract or none (025); it
   never picks one the user did not see.
6. **The view follows the object.** Moving a note keeps it open under its new contract. Saving an
   entry from the timer or the Add Entry modal opens that entry's week, scrolled to the day, with
   the day highlighted; Back returns to where you were. A linked entry's date does the same.
7. **Returning restores.** Each week remembers the day at the top of the list and the offset into
   it; coming back to that week (Back, Time Entries, reload) puts the list there. A week with no
   memory opens on today, or at the top.
8. **Mutations update the sidebar.** Note create, move and delete refresh counts (sprint 026's
   `notes-changed`); contract create selects the new contract.
9. **Destructive actions only act on what is visible.** Delete lives in the editor header
   (sprint 024), so it only exists for the open note. Closing or deleting a note replaces its
   history entry, so Back never reopens it, and the list never keeps a hidden note selected.

`/` versus `/time/<week>`: on tablet and desktop both show a timesheet; `/` always means "this
week", so a bookmark of `/` stays current.

## Tests

- `src/lib/stores/navigation.test.ts`: one group per rule (fake adapter records the URLs written).
- `src/lib/stores/navigation-routes.test.ts`, `navigation-history.test.ts`: URL tables and the
  history mirror.
- `e2e-playwright/navigation-journeys.spec.ts`: journeys 1, 2, 7, 8 and 10 of the journey review,
  Chromium and WebKit.

## Files

| File | Purpose |
|------|---------|
| `src/lib/stores/navigation.svelte.ts` | The store: URL in, URL out, derived state, actions |
| `src/lib/stores/navigation-routes.ts` | URL ↔ route parsing and building, phone levels, parents |
| `src/lib/stores/navigation-history.ts` | In-app history mirror for Back labels and up-navigation |
| `src/lib/stores/contract-directory.svelte.ts` | Contract → name, client name, client ID |
| `src/params/isoweek.ts` | `[week=isoweek]` route matcher |
| `src/routes/(workspace)/+layout.svelte` | Hosts the panels for every workspace URL |
| `src/lib/components/layout/navigation-labels.ts` | Back label and phone title text |
