# Sprint 033 — CL: Archived clients in the sidebar; single-contract clients collapse

**Status:** in progress
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
