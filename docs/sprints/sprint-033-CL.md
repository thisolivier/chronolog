# Sprint 033 — CL: Archived clients in the sidebar; single-contract clients collapse

**Status:** ready for review
**Branch:** `sprint-033-CL/sidebar-archive-and-collapse` · **Worktree:** `.claude/worktrees/sprint-033-CL` · **Port:** 5211
**Sources:** owner request 2026-11-04; `docs/review/2026-11-03-ux-journeys.md` (sidebar hierarchy rules); sprint 026 (archive), 027 (navigation state and context labels), 031 (archive through the API).

## Objective

Archiving a client in Settings keeps it reachable: archived clients (and archived contracts of active clients) are folded under one collapsed **Archived** item at the bottom of the sidebar instead of vanishing. A client with exactly one active contract takes one sidebar row showing the contract, not a client heading plus a child.

## Tasks

1. **Archived group in the sidebar.** `ContractsSidebar.svelte` (and the contract directory store feeding it) gets an **Archived** item after the last active client, collapsed by default, with a count badge. Expanding it lists archived clients with their contracts, and archived contracts of active clients under their client name, in the same visual grammar as active entries but muted. Collapsed state persists per browser in `localStorage` (wrapped in try/catch; default collapsed). Selecting an archived contract navigates exactly as an active one does; the week view and notes list work read-only in the sense that the entry forms still refuse archived contracts as they do today (check what they do and keep it). The data must arrive from the existing list endpoints with `includeArchived=true` (sprint 031), not a new endpoint; the directory store decides what is active.
2. **Archiving from Settings is reflected live.** Archive or unarchive a client or contract in Settings → Clients, then navigate back: the sidebar shows it moved. No page reload needed beyond navigation (the directory store refreshes the way sprint 031's Playwright test proved for creates).
3. **Single-contract collapse.** A client with exactly one active contract renders as one row: the client's colour dot, the contract name, and the client name as muted secondary text on the same row or beneath it in a smaller size, at the client's indent level. Clients with two or more active contracts keep the heading plus children. The row is selectable like any contract and shows the same selected state. The context labels on the panels (sprint 027) still read "Client / Contract". Archived contracts do not count towards the one. When a second contract is added, the client expands back to heading plus children on the next directory refresh.
4. **Hierarchy expectations.** Opening a note or an entry under a collapsed single-contract client, or an archived one, highlights the right sidebar row and, for archived, expands the Archived group so the selection is visible. Cover the journey "open a note from an entry's wiki-link on an archived contract" and "land on `/notes/<contractId>/<noteId>` for a single-contract client by URL".
5. **Keyboard and phone.** The Archived toggle is a button with `aria-expanded`; rows stay reachable by Tab. At 390 px the sidebar drawer shows the same structure.

## Boundaries

Owns `src/lib/components/layout/ContractsSidebar.svelte`, `src/lib/stores/contract-directory.svelte.ts`, the sidebar's styles and tests, `src/lib/components/layout/README.md`, and the settings pages only if a redirect or refresh after archive is needed. Do not change the API or the CLI. Do not change entry forms.

## Working rules

Worktree only. Dev server port 5211 with `BETTER_AUTH_URL=http://localhost:5211` and `ALLOW_REGISTRATION=true`; shared dev Postgres 127.0.0.1:5432, users `qa-033-*`, no reset, no seed. `npm run check` 0 errors, `npm test`, `npm run lint`, Playwright green; rebase onto `main` before sign-off. Do not merge.

## Verification

Playwright screenshots in `docs/review/screenshots/sprint-033/` at 1280 px and 390 px: sidebar with a mix of multi-contract, single-contract and archived clients, the Archived group collapsed and expanded, and the selected state on a collapsed single-contract row and on an archived contract. Playwright assertions for tasks 2, 3 and 4. Sign-off at the bottom with what was done, what was left, test counts.

## Sign-off

**2026-11-04, ready for review on `sprint-033-CL/sidebar-archive-and-collapse` (not merged), rebased on `main` (`f337309`).** Dev server was on port 5211.

### What was done

| # | Task | Result | What changed |
|---|------|--------|--------------|
| 1 | Archived group | **Done** | `FetchDataService.getContractsByClient` now asks `/api/contracts-by-client?includeArchived=true` (sprint 031's flags `archived` / `clientArchived`; no new endpoint). `contract-directory.svelte.ts` keeps the whole list and decides what is active: `sections` (pure `src/lib/utils/sidebar-sections.ts`) gives the active client groups and the Archived groups; `isArchived(id)`. `SidebarArchivedSection.svelte`: after the last active client, a top rule and an **Archived** toggle (chevron, uppercase label like "Contracts", count badge = archived contracts), only shown when something is archived. Expanded, it lists archived clients with their contracts and archived contracts of active clients under their client name, same grammar, muted (grey text, dots at 50%). Collapsed by default; remembered in `localStorage` `chronolog:sidebar-archived-expanded` behind try/catch (`archived-section-state.ts`). Selecting an archived contract navigates like any other. Entry forms are unchanged and still refuse archived contracts as before: Add Entry on an archived contract opens with the contract select empty, because its options come from `/api/contracts`, which leaves archived contracts out. |
| 2 | Live after Settings | **Done** | No settings change needed: the sidebar remounts when you come back from Settings and reloads the directory. Playwright archives a client (Delete → Archive) and a contract in Settings, goes Back to app, sees both under Archived, restores both, and sees them active again, all with a window marker proving no full reload. The Archive explanation in `DeleteImpactDialog` now says it moves the item to Archived at the bottom of the sidebar (it used to say it hides it). |
| 3 | Single-contract collapse | **Done** | `SidebarClientGroup.svelte` draws a group with exactly one contract as one row at the client's indent: colour dot, contract name (14 px) and the client name beneath it (11 px, stone-400; blue-600 when selected). The contract name sits at the same x as child rows under a heading, so the dots and names stay in one column. Same selected style (`bg-blue-50`, `aria-current`). Two or more keep heading plus children. Archived contracts sit in the other section, so they never count. A second contract brings the heading back on the next directory refresh (asserted with a `notes-changed` refresh). Context labels unchanged ("Client / Contract"). The group wrapper keeps `data-testid="sidebar-client-group"` and `aria-label` = client name, so the checklist driver's grouping reads still work. |
| 4 | Hierarchy expectations | **Done** | A group's heading turns blue when it holds the selected contract (it used to compare client IDs, which would light both of a client's groups when it also has an archived contract). When the selected contract is archived, Archived expands without changing the remembered choice, and a newly selected row is scrolled into view, once per selection, so count refreshes never move the list. **Bug fixed:** a timesheet card's `[[note]]` link to a note on an archived contract did nothing, because `TimeEntriesPanel.handleNoteLinkClick` looked the contract up in `/api/contracts`. It now takes the client from the directory and opens the note under `note.contractId` (`TimeEntriesPanel.svelte`, outside the listed boundary but needed for the journey). Both journeys are covered in Playwright. |
| 5 | Keyboard and phone | **Done** | The toggle is a `<button>` with `aria-expanded` and `aria-controls="sidebar-archived-list"`. The list stays in the DOM with `hidden` when collapsed. Rows are buttons and reachable by Tab (Option+Tab in WebKit, as in Safari). At 390 px the phone home (sidebar) shows the same rows and the Archived item (screenshots 05–06). |

### Decisions and interpretation

- "Active contract" means not archived (and the client is not archived). Contracts marked *inactive* (`isActive = false`) are still listed with "(inactive)" as before, so they count towards the one.
- The count badge counts archived contracts, which are the selectable rows inside the item.
- Inside Archived the same collapse applies: a client with one archived contract is one muted row.
- New Note still works on an archived contract (the API has never refused it), and archived contracts can now be reached from the sidebar. If notes there should be read-only, that is a follow-up for the API and the list. This sprint left it alone, as its boundaries require.

### Files

New: `src/lib/utils/sidebar-sections.ts` (+ test), `src/lib/components/layout/SidebarClientGroup.svelte`, `SidebarArchivedSection.svelte`, `archived-section-state.ts` (+ test), `e2e-playwright/sidebar-archive-collapse.spec.ts`, `docs/review/screenshots/sprint-033/shots.mjs`.
Changed: `ContractsSidebar.svelte` (now draws sections; 190 lines), `contract-directory.svelte.ts`, `services/types.ts` (optional `archived` / `clientArchived`), `fetch-data-service.ts` (+ test URL), `TimeEntriesPanel.svelte` (card link fix), `admin/DeleteImpactDialog.svelte` (copy). READMEs: layout, stores, utils, `e2e-playwright/readme.md`.

### Existing tests changed

- `src/lib/services/fetch-data-service.test.ts`: the expected URL is now `/api/contracts-by-client?includeArchived=true`.
- No existing Playwright test needed changing. Single-contract rows keep the group wrapper and `data-contract-id`, and their accessible name still starts with the contract name, so `sidebarContract(page, name)` and the `[data-contract-id]` selectors still match. `e2e-playwright/manual-checklist/README.md` still describes the 026 grouping: a single-contract client's dot is now inside its row rather than in a heading. The driver reads it unchanged (65/65), and the README was left to its owner.

### Results

- `npm run check`: 0 errors (the 3 existing `data.user` warnings in `src/routes/+layout.svelte`). `npm run lint`: clean.
- `npm test`: 70 files, **744 passed** (9 new: `sidebar-sections` 6, `archived-section-state` 3).
- API e2e (`E2E_BASE_URL`/`BETTER_AUTH_URL` = `http://localhost:5211`): 12 files, **86 passed**.
- Playwright (`PLAYWRIGHT_BASE_URL=http://localhost:5211`, chromium + webkit): **86 passed, 5 skipped** (the existing chromium-only offline skips on webkit), 0 failed, no flaky. 10 of the 86 are new: 5 tests × 2 engines in `sidebar-archive-collapse.spec.ts`.
- Checklist driver (`qa-driver.mjs`): **65 pass / 0 fail**.
- Users left in the dev DB: `qa-033-pw-*`, `qa-033-shots-*`, `qa-033-driver-*` and `qa-033-api-*` (API e2e).

### Screenshots (`docs/review/screenshots/sprint-033/`, made by `shots.mjs`)

Fixture: Acme Corp (Rocket Build, Launch Ops; Test Stand archived), Borealis Labs (Data Platform), Cobalt & Sons (Brand Refresh), Internal (General), and Northwind Traders archived (Warehouse Audit, Supply Review).

- `01-desktop-archived-collapsed.png`, `02-desktop-archived-expanded.png`: 1280 px, a mix of multi-contract, single-contract and archived clients.
- `03-desktop-single-contract-selected.png`: `/notes/<Data Platform>/<note>` by URL, with the single row selected.
- `04-desktop-archived-contract-selected.png`: after a timesheet card's wiki-link to a note on archived Northwind / Warehouse Audit. Archived is expanded, the row selected and its heading blue.
- `05-phone-archived-collapsed.png`, `06-phone-archived-expanded.png`, `07-phone-single-contract-list.png`: 390 px.

### Left / follow-ups

- Nothing in the task list was left undone.
- The Internal client and Acme Corp share the rose dot in the fixture. This comes from the palette and existing colour choices, not from this sprint. It is more visible now because single rows put the dot next to a client name.
- Possible: read-only notes on archived contracts (see above), and a "Restore" shortcut in the Archived item (it would need a settings action or the API, out of scope).
