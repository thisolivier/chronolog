# Source map 02 · Shell, sidebar, navigation, timer visibility, history

**Stage 1 (IN-02) source inspection.** Branch `design-r1` at `bf67812`. Read-only: no code changed.
Specs: [02 shell](../specs/02-shell-and-navigation.md), [01 DS-04/DS-05](../specs/01-design-system.md), [open items](../open-items.md).
Paths below are relative to the repo root; `layout/` = `src/lib/components/layout/`, `timer/` = `src/lib/components/timer/`.

## (a) What exists today

### 1. Layout and breakpoints

- **Breakpoints are JS media queries, not Tailwind classes.** `layout/AppShell.svelte:68-92`: `(max-width: 767px)` → `mobile`; `(min-width: 768px) and (max-width: 1023px)` → `tablet`; else `desktop`. The mode is written to the store (`setLayoutMode`, `src/lib/stores/navigation.svelte.ts:480`). Tablet and desktop share one DOM branch (`AppShell.svelte:208-284`) so crossing 1024 px never remounts the editor; crossing 768 px swaps branches (`{#if isMobile}` at `:139`) and remounts every panel.
- CSS also uses 767 px: `src/app.css:10` (16 px inputs on phone width or coarse pointer). Settings stack-table uses 639 px (`app.css:41`). Tailwind `md:`/`lg:`/`sm:` appear only for small tweaks (search field width `w-60 lg:w-72` `AppShell.svelte:223`; indicator text `sm:inline`/`md:inline` `weekly/TimerIndicator.svelte:51-55`).
- **Desktop (≥1024)**: sidebar (fixed 240 px, `AppShell.svelte:252`) + list panel (notes mode only, `:261`) + content panel (`:280`). In time mode there is no list panel: sidebar + timesheet.
- **List panel is resizable today**: mouse drag handle, 200–500 px, default 280, not persisted (`AppShell.svelte:25-66`, `:270-275`); tablet caps it at 260 (`:264`).
- **Hamburger** `≡` (`AppShell.svelte:214-219`, `aria-label="Toggle sidebar"`, `aria-expanded`). Desktop: flips `panel1Collapsed` (persisted in localStorage `chronolog:sidebar-collapsed`, `navigation.svelte.ts:36,200,475-478`). Hiding animates width to 0 with `overflow:hidden` (`AppShell.svelte:246-258`); the sidebar, **including its TimerWidget, stays mounted** (no `inert`/`hidden`, so its controls remain in the DOM).
- **Tablet (768–1023)**: notes mode → sidebar becomes an absolute overlay (`z-30`, shadow) with a `bg-black/20` scrim button (`AppShell.svelte:94-105,238-251`); its open state is local (`overlaySidebarOpen`), closes on contract or mode change. Time mode on tablet → inline sidebar, same as desktop collapse rule.
- **Phone (<768)**: single panel by `mobileNavigationLevel` (`AppShell.svelte:198-206`): 0 = sidebar (`panel1`), 1 = note list (notes) or timesheet (time), 2 = editor. Level is derived from the URL (`mobileLevelFor`, `src/lib/stores/navigation-routes.ts:133-137`): `home` → 0, list/timesheet → 1, note/draft → 2. Drill-down = normal pushes; "← Back" = `goBackMobile` (history if an in-app entry exists, else `parentRoute` with replace, `navigation.svelte.ts:498-506`).

### 2. Sidebar structure

`layout/ContractsSidebar.svelte` (199 lines). Order, top to bottom, inside one scrolling `div` (`:128`, `data-testid="sidebar-scroll"`, `p-3`):
1. **Time Entries** button (`:130-138`), selected = `bg-blue-50 text-blue-700` + `aria-current="page"`; not highlighted on the phone home (`:105-108`).
2. **"Notes" heading** button (`:142-153`): uppercase `text-xs text-stone-400`, opens `/notes/all` (051), same blue selection.
3. Active client groups (`:169-180`) → `SidebarClientGroup`.
4. **Archived** (`layout/SidebarArchivedSection.svelte`): top border, uppercase toggle with count pill and right-column chevron (`:50-81`), collapsed by default (localStorage), auto-expands when the selection is archived (`:38-44`); renders groups with `muted`.
5. **Trash** and **Settings** rows (`layout/SidebarUtilityLinks.svelte:16-30`), same uppercase muted style; divider only when there is no Archived section (`ContractsSidebar.svelte:190`).
6. Outside the scroll area: **TimerWidget** footer (`ContractsSidebar.svelte:195-198`, `border-t p-3`).

`layout/SidebarClientGroup.svelte`:
- **Single-contract flattening** (`:108-128`): one button row `px-3`, dot + contract name + client name beneath in `text-[11px]` + count at right.
- **Multi-contract** (`:129-197`): client heading (`text-xs font-semibold`, button opens client view `/notes/client/<id>`, `:139-153`), right-edge collapse chevron (`:158-179`, collapse state in localStorage via `client-collapse-state.ts`; a collapsed client still shows the selected contract, `:52-55`). Contracts indented `pl-7` (`:186`).
- **Client colour dot**: `h-2 w-2 rounded-full` + `getClientDotClass` (`src/lib/utils/client-colors.ts:68`) beside the client heading (`:151`, `:155`) and on flattened rows (`:122`). Dot-to-text gap is `gap-2` (8 px).
- **Note counts**: `text-[11px] tabular-nums text-stone-400`, hidden when 0 (`:78-88`), right-aligned via `flex-1` on the name.
- **Selection**: `bg-blue-50 text-blue-700` + `aria-current="page"` on the contract row (`:113-119`, `:186-191`); the client heading turns `text-blue-700` when it holds the selection or is the viewed client (`:131-136`), viewed client name gets `bg-blue-50` (`:142-145`).
- Muting that exists: archived groups (`muted` → dot `opacity-50`, `text-stone-500`/`400`, `:49-50`), inactive contracts `opacity-50` (`:116,189`), drag source `opacity-50` (`:99`).
- **No client tinted group background, no contract pattern mark, no pinned notes in the sidebar** (pins only float in the note list, `layout/NoteListPanel.svelte:42`). **No opacity change of any kind when Time Entries is selected.**
- Drag / Alt+Arrow client reorder (`client-reorder.svelte.ts`, `ContractsSidebar.svelte:37-51`); selected row scrolled into view once per selection (`:88-101`).

### 3. Timer visibility

- **One timer model? No.** Each `TimerWidget` instance (`timer/TimerWidget.svelte`, 518 lines) holds its own state (`:47-60`) and reloads from the server on mount (`checkExistingTimer`, `:104-131`) or from localStorage when there is no contract (`pending-timer.ts`, `:133-160`). It publishes a reflection to the shared store (`:214-233`) → `src/lib/stores/timer-state.svelte.ts` (also pushes to the Tauri menu bar, `:57-66`). Pause no longer exists (`TimerWidget.svelte:46`); the store type still lists `paused`.
- **Mounts**: sidebar footer on every layout (`ContractsSidebar.svelte:197`, `placement="sidebar"`, registers via `timer/timer-widget-registry.svelte.ts:14-20`); phone timesheet footer (`layout/TimeEntriesPanel.svelte:187,561-565`, `placement="footer"`), only while no sidebar widget is mounted, i.e. phone level 1/2 in time mode. **No timer widget exists on phone note list / editor screens.**
- **States**: idle (Start Timer / Add Entry, `TimerWidget.svelte:430-445`), running (clock, Stop, start field, contract select, description, attach note, `:446-491`), stopped (`TimerCompletionForm`, `:492-501`). No collapse state or chevron exists.
- **Top-bar indicator** `weekly/TimerIndicator.svelte`: running/paused pill = pulsing green dot (top-left of pill content), `HH:MM:SS`, description (≤30 chars, `sm+`), contract label `Client · Contract` (`md+`), client-colour left border (`:33-57`). Identity comes from the timer's own `draftContractId` (`TimerWidget.svelte:216-223`), not the browsed contract.
  - **Rule today**: running → always shown (`:24`), regardless of whether the sidebar timer is visible. Not running → a second pill (`Timer` or `Timer stopped: save entry`) only when `panel1Collapsed && sidebar widget mounted` (`:28-30,58-72`).
  - Desktop: in top bar right side (`AppShell.svelte:225-232`); click → `openSidebar` (`:131-134`).
  - Phone: right of search, only at level > 0 (`AppShell.svelte:183-192`); click → `navigateMobile(0)` (push `home`). On a phone the stopped pill never shows (`panel1Collapsed` is a desktop preference and no sidebar is mounted at level > 0).
  - Tablet notes overlay closed: running pill shows; stopped pill never shows (`panel1Collapsed` false).
- **Phone capture screen**: there is no dedicated one. Capture lives at the phone home (level 0 = sidebar with timer footer) or the timesheet footer. Reached by the indicator (push `/`) or Back; returned from by "← Back" (history).
- **Off-shell routes** `/search` (`src/routes/search/+page.svelte:67-104`), `/settings/*`, `/notes/trash` render without `AppShell`: no sidebar, no TimerWidget, no indicator. The widget unmounts and remounts on return.

### 4. Header / app bar

- **Desktop/tablet** (`AppShell.svelte:212-233`, `data-testid="app-top-bar"`, `h-12`): left group `≡` · "Chronolog" · `HistoryButtons` ‹ › (`layout/HistoryButtons.svelte`, 32×32, disabled when unavailable) · `GlobalSearchField` (left-aligned, `w-60 lg:w-72`); right: TimerIndicator. No page title in the bar (title is `<title>` only, `src/routes/(workspace)/+layout.svelte:27-43`). `ConnectionStatus` banner below (`:234`).
- **Phone** (`AppShell.svelte:143-193`): level 0 "Chronolog" + ›; deeper "← {backLabel}" (max 65 %, `:146-153`), › when forward exists, context title (`mobile-context-title`, `:157`), Find button on content screens (`:163-173`), search icon link to `/search` (`:175-182`), indicator.
- **`/search`** (`src/routes/search/+page.svelte:67-84`): own header, "Chronolog" link (`sm+`), ‹ › (`md+`), the same `GlobalSearchField` as the query input (`flex-1`, autofocus when empty), "Back to app". Results below; loading "Searching…", short-query hint. The header input *is* the results input; there is no separate large input. `GlobalSearchField` submits with `goto('/search?q=…')` (`search/GlobalSearchField.svelte:35-36`), Cmd/Ctrl+K focuses it.

### 5. History and scroll restoration

- URL is the state (027-CL): store parses the URL in `syncFromUrl` from root `afterNavigate` (`src/routes/+layout.svelte:34-41`); writes via `goto(path, { replaceState, noScroll: true, keepFocus: true })` (`:26`).
- `InAppHistory` (`src/lib/stores/navigation-history.ts`, 144 lines) mirrors this tab's entries in sessionStorage; supports forward, pending moves, popstate by delta (050). Store: `goBack`/`goForward` (`navigation.svelte.ts:508-523`), `backTarget` (`:368-373`). Keyboard ⌘[ ⌘] / Alt+←→ ignored in inputs/contenteditable (`layout/history-shortcuts.ts:13-17`). Labels: `layout/navigation-labels.ts`.
- Steps vs replace: documented at `navigation.svelte.ts:9-13` and `docs/ux/09-navigation-state.md`.
- **Scroll restoration exists only for the timesheet**: per-week top day + offset in sessionStorage (`navigation.svelte.ts:37,218-219,468-473`; `TimeEntriesPanel.svelte:80,101`). **There is no per-note scroll save/restore.** The editor re-mounts per note session (`layout/NoteEditorPanel.svelte:120-133`, `{#key session.key}`); on desktop the shared panel-3 scroller (`AppShell.svelte:280`) is not reset or restored per note; on phone the panel unmounts.
- **Timer across navigation**: within the workspace layout the sidebar never remounts on desktop/tablet (`(workspace)/+layout.svelte:2-9`), so state is kept. Running timer and stopped `endTime`, contract and description are server-held (or pending in localStorage) and survive remounts. **`TimerCompletionForm` edits (contract change, deliverable, work type, duration text, description) are local component state** (`timer/TimerCompletionForm.svelte:36-42`) and are lost whenever the widget unmounts: phone level change, `/search`, `/settings`, `/notes/trash`, crossing 768 px.

### 6. Existing context labels (client/contract repetition)

- Sidebar: client heading + contract row; flattened row repeats client name under contract (`SidebarClientGroup.svelte:123-126`).
- Note list header `note-list-context` (`NoteListPanel.svelte:246-267`): client (small) + contract (h2); client view "All contracts" + client; all notes "Every contract, newest first" + "All notes". Rows add contract name in client view, `Client · Contract` in all-notes (`:321-325`, `NoteListRow.svelte:45-50`).
- Editor header `note-editor-context` (`notes/NoteEditorHeader.svelte:79-83`): `Client / Contract` before the note code. Shown in every view.
- Phone context title (`navigation-labels.ts:47+`), `<title>` (`(workspace)/+layout.svelte:27-40`), timer indicator `Client · Contract`.
- So in a single-contract list on desktop the client/contract appears three times (sidebar selection, list header, editor header).

## (b) Gaps against the spec

| ID | Today | Gap |
| --- | --- | --- |
| SH-01 | 3/2/1 layouts, hamburger, drill-down, ‹ › all exist | **List panel is resizable** (`AppShell.svelte:25-66,270`); spec says columns are not resizable in this scope. Decide: leave as is (pre-existing) or remove. Hidden sidebar is width-0 but not `inert` (keyboard can reach hidden controls). |
| SH-02 | Client heading + indented contracts, dot, counts, flattening | Add pale tinted client section; paper punch-out selection replacing `bg-blue-50`; **remove dot** (`:122,151,155`) and introduce contract mark (needs DS identity renderer); looser alignment (children `pl-7` vs flattened `px-3` already differ: keep that difference). Archived muted variant needs a rule. |
| SH-03 | No muting | New: ~50 % opacity on one wrapper around Notes heading → utility links when `isTimeEntriesHighlighted`; Time Entries row and timer outside it. Requires restructuring: today Time Entries sits inside the same scroll `div` as Notes (`ContractsSidebar.svelte:128-191`); wrap from `:140` to `:190`. Must not stack with existing `opacity-50` (archived/inactive) → would read 25 %. |
| SH-04 | Running pill always visible (duplicate with sidebar) | Replace rule with "sidebar timer actually presented": desktop expanded/collapsed sidebar visible → hide; sidebar hidden, tablet overlay closed, phone non-capture screen, off-shell routes → show. Stopped state must show **Finish entry** with frozen duration and no dot (today: phone/tablet show nothing, desktop shows "Timer stopped: save entry"). Remove `paused` branch. Pulse dot must move to top-right (O03). |
| SH-05 | Search left-aligned after ‹ ›; `/search` reuses the header field | Move header search to far right (and indicator placement must coexist); on `/search` hide header search and render one large input above results. Today `/search` has no timer access at all; spec says keep eligible timer access. 050 placed ‹ › "immediately left of" search: reconcile (‹ › stays left, search moves right). |
| SH-06 | No collapse | New collapse/expand chevron in sidebar widget (running + stopped); compact form: clock, contract graphic, client/contract subtitle. Collapse must be presentation only: today the completion form state is local, so collapse must not unmount `TimerCompletionForm` (use CSS hide) or the form state must be lifted. |
| SH-07 | Back/Forward + timesheet scroll restore | **Note scroll restore does not exist**: must be built (per history entry or per note id). Mobile "return from capture" restores note/timesheet only via history; completion-form details are lost on remount → acceptance "Stop on mobile, enter details, go Back, reopen Finish entry" fails today. |
| SH-08 | Timer identity from `draftContractId`; Start uses browsed contract only at start (`TimerWidget.svelte:95-100`) | Largely met. Verify no new code ties header reflection to `selectedContractId`. |
| DS-04 | Selected row has no mark or repeat | Add primary mark + repeat filling row space before right-aligned count. |
| DS-05 | Dot-to-label `gap-2` (8 px) | Reduce mark-to-name gap ~40 % from the earlier study once a spacing token exists; counts already right-aligned. |
| IN-03 | Two widget instances (sidebar/footer) + reflection store | Spec wants one capture state across expanded/compact/header/mobile. Today state lives in each widget instance; this is the main structural risk. |

## (c) Open items informed (recommendations)

- **O03 — Relative sizing. Recommendation:** define the timer mark and the sidebar mark-to-label gap as CSS custom properties (one token each) in `src/app.css` `@theme`, size the timer mark in rem relative to the sidebar's 240 px width, and review at actual size in the 1280 desktop screenshot. Start the selected-contract gap at `gap-1.5` → `gap-1` range (8 px today ×0.6 ≈ 5 px) and confirm by eye. Pulse: reuse `pulse-dot` 2 s (`TimerIndicator.svelte:84-87`), add `prefers-reduced-motion` fallback (static dot).
- **O06 — Responsive/capture UI. Recommendation:** keep the existing 768 / 1024 px breakpoints (`AppShell.svelte:78-79`) as the "small layout" boundary; they are tested and documented (026-CL). Do not invent new values. For the compact widget, keep the same `TimerWidget` instance and toggle a `compact` presentation flag (persist in localStorage like `chronolog:sidebar-collapsed`) so collapse never unmounts the form. Treat phone level 0's timer as the "focused capture" for now, or add a dedicated `/capture`-style route only after lifting completion-form state into a shared store (needed anyway for SH-07 acceptance). Contract change stays the existing `ContractSelect`, separate from the chevron.
- **O07 — Header patterns. Recommendation:** for client view and All notes (multi-contract lists) show no repeat in the list header (keep text only) until a client-level pattern is defined; never fall back to the timer's pattern. In narrow headers (<768 and tablet's 260 px list) omit the repeat before truncating text: repeat region should be `flex-1 min-w-0` with overflow hidden and removed below a minimum width.

## (d) Risks and things that must not break

- **Single live timer widget.** The registry (`timer-widget-registry.svelte.ts`) guarantees one widget across breakpoints; any new header/compact/capture presentation must not create a second instance (risk of double draft creation, `createServerDraft`).
- **Hidden-sidebar widget stays mounted**: the new SH-04 rule cannot use "mounted" as "visible" (`isSidebarTimerWidgetMounted` is true while width is 0). Visibility needs layout mode + `panel1Collapsed` + overlay-open + mobile level.
- **Tablet ↔ desktop must not remount the editor** (`AppShell.svelte:73`); keep one DOM branch.
- **History invariants** (050): Back never leaves the app; typing adds no steps; quick-press pending-move matching. Collapse/expand and scroll restore must use `replace` or no navigation.
- **Muting must not disable**: SH-03 opacity only; keep `aria-current`, clickability, focus rings.
- **Selection hooks used by tests**: `aria-current="page"` on contract rows and Time Entries, `data-contract-id`, `sidebar-notes-heading`, `sidebar-client-chevron`, `sidebar-archived-toggle`, `sidebar-single-contract-row`, `sidebar-row-client-name`, `sidebar-note-count`, `note-list-context`, `note-editor-context`, `mobile-back`, `mobile-context-title`, `timer-widget-sidebar`/`-footer`, `global-search-input`, `search-back-to-app`, button name "Toggle sidebar".
- **Existing tests in this area** (`e2e-playwright/`): `navigation-journeys.spec.ts` (J1–J10; sidebar collapse preference survives reload `:341-347`; J8 phone Back), `history-buttons.spec.ts` (‹ › placement left of search on /search: will change with SH-05), `sidebar-notes-header.spec.ts`, `sidebar-archive-collapse.spec.ts`, `sidebar-client-view.spec.ts`, `attach-note-sidebar.spec.ts` (`:157` chevrons at right edge; timer widget), `iphone-journeys.spec.ts` (timer start/stop/discard `:89`, search from title bar `:214`), `timer-start-today.spec.ts`, `timesheet-polish.spec.ts`, `search.spec.ts`, `search-results-layout.spec.ts`, `smoke.spec.ts`, `offline-behavior.spec.ts`. Unit: `src/lib/stores/navigation*.test.ts`, `layout/history-shortcuts.test.ts`, `layout/client-sidebar-state.test.ts`, `layout/archived-section-state.test.ts`, `timer/*.test.ts`. API: `src/e2e/timer.e2e.test.ts`.
- **Coverage hole**: no test asserts `timer-indicator` / `timer-indicator-collapsed` visibility; SH-04's state matrix needs new Playwright coverage (desktop expanded/collapsed/hidden, tablet overlay, phone, stopped).
