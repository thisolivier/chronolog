# Sprint 039 — CL: Pinned notes, client view, sidebar collapse and client reorder

**Status:** in progress
**Branch:** `sprint-039-CL/sidebar-client-view` · **Worktree:** `.claude/worktrees/sprint-039-CL` · **Port:** 5217
**Sources:** owner requests 2026-11-04 in `docs/backlog.md` ("Owner-requested, back of the queue"): pin a note, client view, drag to reorder clients, click a client heading to collapse. Wave rules: `docs/sprints/_wave-rules.md`.

**Owns:** `ContractsSidebar.svelte`, `SidebarClientGroup.svelte`, `SidebarArchivedSection.svelte`, `NoteListPanel.svelte`, the notes list queries and routes, client queries/routes, migration `0010`, CLI `note pin|unpin` and `client edit --order`. Do not touch the editor, the timer, the timesheet page, `AppShell.svelte` beyond one line, or `ClientRow.svelte`/`ContractRow.svelte` (041 owns them).

## Tasks

1. **Pin a note.** Migration `0010`: `notes.pinned_at timestamptz null` and `clients.sort_order integer` (backfilled in the current display order). A pinned note sits at the top of its contract's list (pinned first by `pinned_at` desc, then the usual order), with a pin marker on the row. Pin/unpin from the note list row menu or the editor header (one small control). API: `PATCH /api/notes/[noteId]` accepts `pinned: boolean` (or a dedicated route if PATCH semantics make that awkward; say which). CLI `chronolog note pin <id>` / `note unpin <id>`; `note list` shows a pin marker.
2. **Client view.** Clicking a client name in the sidebar opens `/notes/client/<clientId>`: one note list across all that client's contracts, pinned first, each row showing its contract. The URL is the state (027 rules: back/forward, reload, scroll restore); the sidebar highlights the client. Opening a note from it keeps the client view as the list. New Note from the client view asks for the contract (or uses the only one).
3. **Collapse a client.** A chevron at the left of the client row (the Archived group's chevron, in the slot where the colour dot sits; dot moves next to the name) collapses its contracts. Remembered per browser like the Archived group. Never collapsed by default. Single-contract clients (033: one row) get no chevron. Click on the name opens the client view; click on the chevron only toggles.
4. **Reorder clients.** Drag a client row to reorder in the sidebar, persisted per user via `clients.sort_order`; a keyboard alternative (e.g. Alt+ArrowUp/Down on a focused client row, announced to screen readers). API: a reorder route (bulk order list) or `PATCH` per client; CLI `chronolog client edit <client> --order <n>`. No new drag-and-drop dependency unless the native HTML5 approach proves unworkable on WebKit (say why if so).
5. **Tests.** Unit for the migration backfill order, pin ordering, reorder route, client view query; Playwright: pin a note and see it on top, open the client view and back, collapse survives reload, reorder by keyboard survives reload (chromium and webkit); API e2e for the CLI pin and order commands.

## Verification

Screenshots: pinned note on top; client view with contract labels; collapsed client; sidebar after a reorder. Sign-off as per the wave rules.

## Sign-off

(pending)
