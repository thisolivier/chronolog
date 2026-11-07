# 01 Styling inventory

Read-only inventory of how styling is done today, taken before any design tokens are introduced.

- Worktree: `/Users/olivier/sites/chronolog/.claude/worktrees/design-r1` (branch `design-r1`, base `bf67812`)
- Date: 2026-11-07
- Stack (package.json): svelte `^5.49.2`, @sveltejs/kit `^2.50.2`, tailwindcss `^4.0.0` via `@tailwindcss/vite` (vite.config.ts:9). No `tailwind.config.*` and no `postcss.config.*`, so Tailwind 4 CSS-first setup with the default theme.
- Scope: `src/` only for source searches. Counts marked "token scan" include `.test.ts` and `src/e2e/*.ts` files because the scan does not exclude them.

## 1. Global CSS and HTML shell

### src/app.css (68 lines)

Command: `grep -nE '^[@.]|^\s*/\*|^\s*\*/' src/app.css`

```
1:@import "tailwindcss";
3:/*  (comment: iPhone 047-QA, 16px input font rule)
9: */
10:@media (max-width: 767px), (pointer: coarse) {     (input/select/textarea font-size: max(16px, 1em), unlayered)
18:/*  (comment: safe areas)
22: */
23:/* Do not combine with Tailwind padding utilities ... */
24:.safe-area-shell {                                   (padding-* from env(safe-area-inset-*))
31:/* A fixed toast or prompt ... */
32:.safe-area-bottom-offset {                           (bottom: calc(1rem + env(safe-area-inset-bottom)))
36:/*  (comment: stacked table)
40: */
41:@media (max-width: 639px) {                          (.stack-table, tbody, thead, tr, td, td[data-stack-full])
```

- `@theme` blocks: 0. `@layer`, `@utility`, `@plugin`, `@source`: 0. The only at-rule import is `@import "tailwindcss";`.
- Custom properties: 0 `:root` rules, 0 `--name:` definitions anywhere in `src/`, 0 `var(--` usages anywhere in `src/`.
- Hard-coded colours in app.css: none.

### src/app.html (19 lines)

- `<html lang="en">` (line 2)
- `<meta charset="utf-8">` (line 4)
- viewport (line 5): `width=device-width, initial-scale=1, viewport-fit=cover`
- `<meta name="theme-color" content="#2563eb" />` (line 6)
- manifest link (line 7): `/manifest.webmanifest`; favicon (line 8): `/favicon.png`; apple-touch-icon (line 9): `/apple-touch-icon.png`
- apple-mobile-web-app-capable, mobile-web-app-capable, apple-mobile-web-app-title "Chronolog", apple-mobile-web-app-status-bar-style `default` (lines 10-13)
- No font `<link>`, no Google Fonts, no `<style>` in app.html.
- `<body data-sveltekit-preload-data="hover">` (line 15)

Related colour values outside `src/**/*.svelte|ts|css`:
- `static/manifest.webmanifest` line 9 `"background_color": "#ffffff"`, line 10 `"theme_color": "#2563eb"`.
- `src/error.html` line 9 (`background: #fafaf9`, `color: #1c1917`), line 10 (`#e7e5e4` border, `#fff` background), line 12 (`#57534e`), line 13 (`#2563eb` background, `#fff` text). Inline `<style>` in error.html, not a Tailwind page.

## 2. Fonts

- `@font-face`: 0. Google Fonts links (`fonts.googleapis` / `fonts.gstatic`): 0 in src and app.html.
- Font files: none. Command: `find static src/lib/assets -type f | grep -iE '\.(woff2?|ttf|otf|eot)$'` returned nothing. `static/` contains only PNG icons, `manifest.webmanifest`, `robots.txt`. `src/lib/assets/` contains only `favicon.svg`.
- No font override in the Tailwind theme (no `@theme`), so `font-sans` is Tailwind 4's default stack.

`font-family` declarations (grep `font-family` in src, all file types):

| File:line | Declaration |
|---|---|
| src/error.html:9 | `font-family: system-ui, sans-serif` (inline style) |
| src/lib/components/notes/note-print.ts:26 | body `Georgia, 'Times New Roman', serif` (print HTML) |
| src/lib/components/notes/note-print.ts:27 | print header `system-ui, sans-serif` |
| src/lib/components/notes/note-print.ts:39 | code `'SFMono-Regular', Consolas, Menlo, monospace` |
| src/lib/components/notes/note-print.ts:55 | `.task-box` `'Segoe UI Symbol', 'Apple Symbols', system-ui, sans-serif` |
| src/lib/components/notes/NoteEditor.svelte:573 | `font-family: monospace` (inside `<style>`) |
| src/lib/components/notes/print-styles.css:92 | `Georgia, 'Times New Roman', serif !important` |
| src/lib/components/notes/print-styles.css:137 | `'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace !important` |

Tailwind font utilities (`font-sans|font-serif|font-mono`), token scan over `src/**/*.svelte` gives 12 `font-mono` occurrences and 0 `font-sans` / `font-serif`:

Command: `grep -rnoE 'font-(sans|serif|mono)' --include='*.svelte' src`
- `font-mono`: 11 occurrences in 10 `.svelte` files: ClientRow.svelte:87, TrashList.svelte:45, NoteEditorHeader.svelte:88, TimerDisplay.svelte:10, WikiLinkInput.svelte:182, NoteCodeCopyButton.svelte:36 and :39, two-factor/+page.svelte:334, api-tokens/+page.svelte:116, admin/clients/[clientId=uuid]/+page.svelte:112, NoteEditor.svelte:399. Plus 1 `.ts` occurrence at SuggestionDropdown.ts:116 (className string). Total 12 occurrences in 11 files.

## 3. Tailwind colour utilities

### Method

Token scan. Each `.svelte` and `.ts` file under `src/` is split on any character that is not `A-Za-z0-9_:/!-` (one token per line), then tokens are matched exactly against:

```
^([a-z-]+:)*!?((PFX)-(COL)-(SHADE)|(PFX)-(white|black))(/[0-9]+)?$
PFX  = bg | text | border(-[xytrbls])? | ring | ring-offset | fill | stroke | from | to | via | divide | placeholder | outline | decoration | shadow | accent | caret
COL  = slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose
SHADE= 50|100|200|300|400|500|600|700|800|900|950
```

Script: `/private/tmp/claude-501/-Users-olivier-sites-chronolog/1eef79ac-6655-48c1-ba11-cd89faf4609b/scratchpad/colour-tokens.sh` (scratchpad), output `/private/tmp/claude-501/-Users-olivier-sites-chronolog/1eef79ac-6655-48c1-ba11-cd89faf4609b/scratchpad/colour-tokens.tsv`. Variant prefixes (`hover:`, `focus:`, `class:`) are stripped for the family table and kept for the exact-class table.

Why token scan and not `grep -o`: a plain `grep -oE` with a leading boundary group loses a class when two match back to back, because the separating space is consumed by the first match. The earlier `grep -o` pass gave 1,143 matches. The token scan gives 1,293.

Total tokens: **1,293**, across **17 colour families**, of which 322 carry a variant prefix.

Prefix breakdown: `text` 570, `bg` 425, `border` 225 (includes `border-l-*`), `ring` 63, `divide` 6, `decoration` 3, `outline` 1. Prefixes `from`, `to`, `via`, `placeholder`, `fill`, `stroke`: 0.

### Table A. Colour family, occurrences, top 5 files (token scan)

| Family | Occurrences | Top 5 files (occurrences) |
|---|---:|---|
| stone | 660 | admin/clients/[clientId]/contracts/[contractId]/+page.svelte (30); admin/clients/[clientId]/+page.svelte (30); notes/EditorToolbar.svelte (29); settings/two-factor/+page.svelte (28); admin/clients/+page.svelte (26) |
| blue | 265 | notes/EditorToolbar.svelte (20); settings/two-factor/+page.svelte (16); admin/clients/[clientId]/contracts/[contractId]/+page.svelte (16); admin/clients/[clientId]/+page.svelte (16); register/+page.svelte (15) |
| white | 141 | admin/clients/[clientId]/contracts/[contractId]/+page.svelte (9); admin/clients/[clientId]/+page.svelte (9); settings/two-factor/+page.svelte (8); settings/api-tokens/+page.svelte (8); admin/clients/+page.svelte (7) |
| red | 88 | notes/NoteEditorHeader.svelte (8); settings/two-factor/+page.svelte (5); settings/api-tokens/+page.svelte (5); weekly/TimeEntryCard.svelte (5); admin/DeleteImpactDialog.svelte (5) |
| amber | 48 | settings/api-tokens/+page.svelte (10); timer/TimerStartField.svelte (5); notes/SaveStatusIndicator.svelte (4); layout/ConnectionStatus.svelte (4); admin/clients/+page.svelte (3) |
| green | 28 | settings/two-factor/+page.svelte (6); notes/SaveStatusIndicator.svelte (4); layout/ConnectionStatus.svelte (4); layout/NoteListPanel.svelte (3); admin/clients/[clientId]/contracts/[contractId]/+page.svelte (2) |
| indigo | 13 | weekly/WikiLinkRenderer.svelte (4); notes/NoteBacklinks.svelte (3); notes/TrashList.svelte (2); notes/NoteTrashToastHost.svelte (2); notes/note-trash.ts (2) |
| rose | 12 | utils/client-colors.ts (7); utils/client-colors.test.ts (3); weekly/week-strip-segments.test.ts (2) |
| sky | 11 | layout/ConnectionStatus.svelte (4); utils/client-colors.ts (3); search/SearchTypeIcon.svelte (2); utils/client-colors.test.ts (1); weekly/week-strip-segments.test.ts (1) |
| violet | 4 | utils/client-colors.ts (3); weekly/week-strip-segments.test.ts (1) |
| teal | 4 | utils/client-colors.ts (3); utils/client-colors.test.ts (1) |
| emerald | 4 | weekly/WeekStatusMenu.svelte (2); search/SearchTypeIcon.svelte (2) |
| black | 4 | offline/OutboxHeldPanel.svelte (1); timer/AddTimeEntryModal.svelte (1); layout/AppShell.svelte (1); admin/DeleteImpactDialog.svelte (1) |
| orange | 3 | utils/client-colors.ts (3) |
| lime | 3 | utils/client-colors.ts (3) |
| fuchsia | 3 | utils/client-colors.ts (3) |
| yellow | 2 | settings/two-factor/+page.svelte (2) |

Sum: 660+265+141+88+48+28+13+12+11+4+4+4+4+3+3+3+2 = 1,293 (matches total).

Command: `awk -F'\t' '...family...' /private/tmp/claude-501/-Users-olivier-sites-chronolog/1eef79ac-6655-48c1-ba11-cd89faf4609b/scratchpad/colour-tokens.tsv | sort | uniq -c | sort -rn`, then per-family `uniq -c | head -5` on file column. Full script: `/private/tmp/claude-501/-Users-olivier-sites-chronolog/1eef79ac-6655-48c1-ba11-cd89faf4609b/scratchpad/colour-tokens.sh`.

### Table B. 30 most frequent exact class tokens (variants kept)

| Count | Class |
|---:|---|
| 92 | bg-white |
| 84 | text-stone-500 |
| 80 | text-stone-700 |
| 77 | border-stone-300 |
| 69 | text-stone-400 |
| 62 | text-stone-600 |
| 54 | focus:ring-blue-500 |
| 54 | border-stone-200 |
| 45 | text-stone-900 |
| 45 | hover:bg-stone-100 |
| 45 | focus:border-blue-500 |
| 43 | text-white |
| 34 | hover:bg-stone-50 |
| 31 | bg-blue-600 |
| 30 | hover:bg-blue-700 |
| 20 | text-red-600 |
| 19 | text-blue-700 |
| 19 | bg-stone-50 |
| 18 | text-blue-600 |
| 15 | hover:text-stone-700 |
| 13 | hover:text-blue-600 |
| 13 | bg-stone-100 |
| 13 | bg-red-50 |
| 12 | text-red-700 |
| 11 | text-stone-800 |
| 11 | bg-blue-100 |
| 10 | bg-blue-50 |
| 8 | hover:text-blue-800 |
| 8 | bg-amber-50 |
| 7 | bg-stone-300 |

Distinct exact tokens: 163. Command: `awk -F'\t' '{print $2}' /private/tmp/claude-501/-Users-olivier-sites-chronolog/1eef79ac-6655-48c1-ba11-cd89faf4609b/scratchpad/colour-tokens.tsv | sort | uniq -c | sort -rn | head -30`.

## 4. Hard-coded hex and rgb colours

Method: `grep -rnE --include='*.svelte' --include='*.ts' --include='*.css' '(^|[^&A-Za-z0-9_])#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})([^A-Za-z0-9_-]|$)' src static` (3- or 6-digit hex; excludes HTML entities like `&#9664;` and Svelte `{#each}` blocks, which a looser pattern matched as hex).

- `rgb(` / `rgba(` / `hsl(` / `hsla(`: 0 occurrences in `src/` and `static/`.
- Matched lines: **70**.

| File | Lines with hex |
|---|---:|
| src/lib/components/notes/NoteEditor.svelte | 45 |
| src/lib/components/notes/note-print.ts | 11 |
| src/lib/components/notes/print-styles.css | 7 |
| src/lib/components/find/dom-find.ts | 4 |
| src/lib/components/weekly/TimerIndicator.svelte | 2 |
| src/lib/components/search/entry-reveal.ts | 1 |

Line-by-line listing (line: hex values, grouped by file):

- `src/lib/components/search/entry-reveal.ts`: 49 #f59e0b
- `src/lib/components/notes/NoteEditor.svelte`: 420 #adb5bd; 495 #78716c; 529 #2563eb; 549 #a8a29e; 555 #e5e7eb; 560 #3b82f6; 566 #2563eb; 570 #f3f4f6; 579 #f6f8fa; 580 #24292e; 584 #e1e4e8; 597 #d73a49; 598 #032f62; 599 #6a737d; 600 #6f42c1; 601 #005cc5; 602 #6f42c1; 603 #e36209; 604 #005cc5; 605 #22863a; 606 #6f42c1; 607 #005cc5; 608 #005cc5; 609 #d73a49; 610 #24292e; 611 #005cc5; 612 #005cc5; 613 #e36209; 614 #005cc5; 615 #22863a #f0fff4; 616 #b31d28 #ffeef0; 619 #e5e7eb; 623 #6b7280; 627 #6366f1; 628 #eef2ff; 637 #e0e7ff; 638 #4f46e5; 643 #a8a29e; 644 #f5f5f4; 670 #d6d3d1; 671 #fafaf9; 691 #a8a29e; 692 #d6d3d1; 693 #fafaf9; 708 #3b82f6
- `src/lib/components/find/dom-find.ts`: 78 #fde68a; 79 #f59e0b #1c1917; 80 #fde68a; 81 #f59e0b #1c1917
- `src/lib/components/notes/note-print.ts`: 27 #666 #ccc; 38 #f6f8fa #e1e4e8; 41 #ccc #333; 45 #666; 48 #666; 56 #ccc; 57 #6a737d; 58 #d73a49; 59 #032f62; 60 #005cc5; 61 #6f42c1
- `src/lib/components/notes/print-styles.css`: 126 #f6f8fa; 127 #e1e4e8; 142 #f3f4f6; 160 #666; 177 #ccc; 178 #333; 196 #ccc
- `src/lib/components/weekly/TimerIndicator.svelte`: 80 #22c55e; 93 #a8a29e

Hex colours in other files (outside the scan): app.html:6 `#2563eb`; manifest.webmanifest:9-10 `#ffffff`, `#2563eb`; error.html lines 9, 10, 12, 13 (listed in section 1).

Note: `NoteEditor.svelte` holds the ProseMirror/TipTap editor theme and the highlight.js token palette (lines 597-616, GitHub-style colours), and `note-print.ts` duplicates those colours inside a print stylesheet string.

## 5. Client colour system

Palette and assignment live in `src/lib/utils/client-colors.ts`. Colours are Tailwind class names, not hex values, and they are stored as an index.

### Palette (CLIENT_COLORS, lines 20-59, 8 entries, index 0-7)

| Index | Name | borderClass (left border) | dotClass | bgClass |
|---:|---|---|---|---|
| 0 | Rose | border-l-rose-400 | bg-rose-400 | bg-rose-50 |
| 1 | Sky | border-l-sky-400 | bg-sky-400 | bg-sky-50 |
| 2 | Violet | border-l-violet-400 | bg-violet-400 | bg-violet-50 |
| 3 | Amber | border-l-amber-500 | bg-amber-500 | bg-amber-50 |
| 4 | Teal | border-l-teal-400 | bg-teal-400 | bg-teal-50 |
| 5 | Fuchsia | border-l-fuchsia-400 | bg-fuchsia-400 | bg-fuchsia-50 |
| 6 | Lime | border-l-lime-500 | bg-lime-500 | bg-lime-50 |
| 7 | Orange | border-l-orange-400 | bg-orange-400 | bg-orange-50 |

The file header (lines 7-10) says the class strings must stay as literals so Tailwind v4's source scanner emits them. `border-l-*` is used because an all-sides `border-rose-400` loses to `border-stone-200` in output order.

### Storage

- `src/lib/server/db/schema/clients.ts:24`: `colorIndex: integer('color_index').notNull().default(0)`
- Migration `drizzle/0006_yielding_supreme_intelligence.sql:1`: `ALTER TABLE "clients" ADD COLUMN "color_index" integer DEFAULT 0 NOT NULL;`
- No hex or colour name is stored. Only the 0-7 index.
- Server validation: `isValidClientColorIndex` (client-colors.ts:83), used in `src/routes/api/clients/[id]/+server.ts` and `src/routes/admin/clients/+page.server.ts`.

### Assignment rule

1. Default for a new client: `suggestClientColorIndex(activeColorIndexes)` (client-colors.ts:93-98). It counts only ACTIVE clients (archived clients free their colour, sprint 044-CL). It returns the first index with the lowest usage count. With all eight in use, that is the least-used index, lowest index on a tie.
2. Server wrapper: `nextClientColorIndex(userId)` in `src/lib/server/db/queries/clients.ts:111`. Callers: `src/routes/api/clients/+server.ts:54` (and import at `src/routes/api/contracts/+server.ts:8`).
3. Existing clients keep their colour. Nothing re-assigns on rename or archive.
4. Wrap: every lookup uses `colorIndex % CLIENT_COLORS.length` (getters at client-colors.ts:63, 69, 75; findSharedClientColors at 116).
5. Settings hint: `findSharedClientColors` (client-colors.ts:110-123) lists palette colours used by two or more active clients. It feeds `src/routes/admin/clients/+page.svelte:58` (`sharedColors`).

Sprint reference: `docs/sprints/sprint-044-CL.md` item 4 "Distinct client colours" (lines 14 and 34).

### Consumers

- Helper importers (non-test .svelte and .ts): 12 files.
- `getClientBorderClass`: TimeEntryCard.svelte (2 occurrences), TimerIndicator.svelte (2), NewEntryRow.svelte (2).
- `getClientDotClass`: TimeEntryCard.svelte (2), SidebarClientGroup.svelte (2), SearchHitRow.svelte (2), week-strip-segments.ts (2), ClientRow.svelte (4 occurrences, admin).
- `getClientBgClass`: no non-test caller. Only client-colors.ts and its test.
- `CLIENT_COLORS` iterated directly in ClientRow.svelte (colour picker, line 61) and admin/clients/+page.svelte (line 127).
- Client colours are not used by the `SearchTypeIcon` (which uses fixed sky and emerald) or by the status colours.

## 6. Shared UI primitives

Method: for every file in `src/lib/components/` (55 `.svelte` files), count (a) files with an explicit `import X from '...X.svelte'` and (b) lines in `src/**/*.svelte` with a `<X` tag (`grep -rE "<X([[:space:]/>]|$)"`). Script: `/private/tmp/claude-501/-Users-olivier-sites-chronolog/1eef79ac-6655-48c1-ba11-cd89faf4609b/scratchpad/component-usage.sh`, output `/private/tmp/claude-501/-Users-olivier-sites-chronolog/1eef79ac-6655-48c1-ba11-cd89faf4609b/scratchpad/component-usage.txt`.

No shared `Button`, `Input`, `Modal`, `Dropdown`, `Toast` or `Tooltip` component exists. There is no `src/lib/ui/` directory.

Components that act as reusable primitives (by name and role), with importer files and tag lines:

| Role | Component | Importer files | Tag lines |
|---|---|---:|---:|
| Select | timer/ContractSelect.svelte | 5 | 5 |
| Select | timer/DeliverableSelect.svelte | 4 | 4 |
| Select | timer/WorkTypeSelect.svelte | 4 | 4 |
| Input | timer/DurationField.svelte | 4 | 4 |
| Input | timer/TimerStartField.svelte | 1 | 1 |
| Input | search/GlobalSearchField.svelte | 2 | 2 |
| Input | weekly/WikiLinkInput.svelte | 2 | 2 |
| Button | layout/HistoryButtons.svelte | 4 | 6 |
| Button | weekly/AttachNoteButton.svelte | 2 | 2 |
| Button | notes/NoteCodeCopyButton.svelte | 1 | 1 |
| Button | layout/NoteListNewNoteButton.svelte (role=menu trigger) | 1 | 1 |
| Menu | weekly/WeekStatusMenu.svelte (role=menu) | 1 | 1 |
| Dialog / modal | admin/DeleteImpactDialog.svelte | 4 | 4 |
| Dialog / modal | timer/AddTimeEntryModal.svelte (role=dialog) | 1 | 1 |
| Dialog / modal | offline/OutboxHeldPanel.svelte (role=dialog, not in components/) | n/a | n/a |
| Feedback | admin/FormFeedback.svelte | 3 | 3 |
| Feedback | layout/ConnectionStatus.svelte | 4 | 5 |
| Toast | notes/NoteTrashToastHost.svelte | 1 | 1 |
| Shell | admin/SettingsShell.svelte | 2 | 2 |
| Shell | admin/AdminBreadcrumb.svelte | 3 | 3 |
| Find bar | find/FindBar.svelte | 2 | 2 |

Command: `grep -rlE "^[[:space:]]*import +X +from +'[^']*X\.svelte'" --include='*.svelte' --include='*.ts' src`, then `grep -rE "<X([[:space:]/>]|$)" --include='*.svelte' src | wc -l`.

Inline raw markup (files that style their own controls with no shared component):

- `<button` appears on **160 lines in 52 files**. Top files by line count: notes/EditorToolbar.svelte (12), weekly/TimeEntryCard.svelte (10), notes/NoteEditorHeader.svelte (9), offline/OutboxHeldPanel.svelte (7), admin/DeliverableCard.svelte (7), admin/ContractRow.svelte (7), admin/clients/[clientId]/contracts/[contractId]/+page.svelte (6), admin/clients/[clientId]/+page.svelte (6), settings/two-factor/+page.svelte (5), layout/AppShell.svelte (5), admin/ClientRow.svelte (5).
- `<input` on 54 lines in 20 files. `<select` on 6 lines in 5 files. `<textarea` in 5 files.
- Every button's look (`bg-*`, `border-*`, `hover:*`, `focus:ring-*`) is set inline in its own class string. No shared class constant exists.

## 7. Dark mode

- `dark:` variant: 0 occurrences (`grep -rnoE 'dark:' --include='*.svelte' --include='*.ts' --include='*.css' src`).
- `prefers-color-scheme`: 0. `color-scheme`: 0. `data-theme`: 0. `.dark` class toggling: 0.
- `theme-color` in app.html is a single fixed value (`#2563eb`). `manifest.webmanifest` has a fixed light background `#ffffff`.
- Hard-coded light-theme colours: 70 hex lines (section 4), and every Tailwind class in section 3 is a light-theme shade.

## 8. Animation

### Keyframes and animate classes

- `@keyframes`: 1. `src/lib/components/weekly/TimerIndicator.svelte:84` `pulse-dot`, used on line 81 as `animation: pulse-dot 2s ease-in-out infinite` (`<style>` block, lines 80-88).
- `animate-*` Tailwind class tokens: 2, both `animate-pulse`:
  - `src/lib/components/notes/SaveStatusIndicator.svelte:25` (`saving` state `animate-pulse`)
  - `src/lib/components/weekly/AttachNoteButton.svelte:54` (`animate-pulse` while attaching)
- `duration-300`: 1 (`src/lib/components/layout/AppShell.svelte:247`, with `transition-all`).

### Transition classes (token scan, variants kept)

| Token | Count |
|---|---:|
| transition-colors | 27 |
| transition-opacity | 4 |
| transition-transform | 2 |
| transition-shadow | 1 |
| transition-all | 1 |
| transition (bare) | 1 |
| **Total** | **36 in 17 files** |

Files with the most: notes/EditorToolbar.svelte (12), layout/SidebarClientGroup.svelte (3), weekly/TimerIndicator.svelte (2), weekly/TimeEntryCard.svelte (2), notes/NoteEditorHeader.svelte (2), layout/SidebarArchivedSection.svelte (2), layout/NoteListRow.svelte (2), layout/ContractsSidebar.svelte (2). Other files with one each: settings/+page.svelte, weekly/WikiLinkInput.svelte, weekly/WeekStrip.svelte, weekly/AttachNoteButton.svelte, notes/NoteEditor.svelte, notes/LinkedTimeEntries.svelte, layout/TimeEntriesPanel.svelte, layout/SidebarUtilityLinks.svelte, layout/AppShell.svelte.

Command: `tr -c 'A-Za-z0-9_:/!-' '\n' < file | grep -E '^([a-z-]+:)*!?(transition|transition-(all|colors|opacity|transform|shadow|none|[a-z]+)|animate-[a-z-]+|duration-[0-9]+|ease-[a-z-]+)$'`. Output: `/private/tmp/claude-501/-Users-olivier-sites-chronolog/1eef79ac-6655-48c1-ba11-cd89faf4609b/scratchpad/motion-tokens.tsv`.

### Svelte-side motion

- Svelte transition / animate directives (`transition:`, `in:`, `out:`, `animate:`): 0.
- `svelte/transition`, `svelte/animate`, `svelte/motion` imports: 0 files.
- `view-transition` / `startViewTransition`: 0. `scroll-behavior`: 0.

### prefers-reduced-motion

- `prefers-reduced-motion`: 0. `motion-reduce:` / `motion-safe:`: 0.
- `matchMedia` is used for layout, not motion, in 3 files: `layout/AppShell.svelte:78-79` (mobile and tablet width queries), `notes/NoteLinkedPanels.svelte:18,21-22` (short-screen query), `notes/note-panel-state.svelte.ts:68` (`pointer: coarse`).

## 9. Icons

- No icon library. `package.json` lists none (no lucide, heroicons, phosphor, tabler, fontawesome). `grep` of source imports from icon-like paths: only `./SearchTypeIcon.svelte`.
- Method: inline `<svg>` markup, hand-written paths, `stroke="currentColor"`, Tailwind size classes (`h-3 w-3`, `h-4 w-4`, `h-3.5 w-3.5`).
- Inline `<svg>` opening tags: **12 in 9 files** (`grep -rcE '<svg' --include='*.svelte' src`).
- One icon component exists: `src/lib/components/search/SearchTypeIcon.svelte` (note page or clock, by `kind`).
- Text glyphs used instead of SVG: `&#9664;` ◀ and `&#9654;` ▶ (weekly/WeekStrip.svelte:77 and :96), `&#9662;` ▾ (weekly/WeekStatusMenu.svelte:90), `&#9654;` ▶ (weekly/TimerIndicator.svelte:69).
- Static icon assets: `src/lib/assets/favicon.svg`; `static/favicon.png`, `static/apple-touch-icon.png`, `static/pwa-192x192.png`, `static/pwa-512x512.png`.

### Distinct SVG icon instances (12)

| # | File:line | Icon (from path or context) | Used for |
|---:|---|---|---|
| 1 | layout/SidebarClientGroup.svelte:168 | disclosure chevron (class `rotate-90` when expanded; path not captured) | collapse client group |
| 2 | layout/SidebarArchivedSection.svelte:70 | disclosure chevron (class `rotate-90`; path not captured) | expand archived section |
| 3 | layout/AppShell.svelte:171 | three-line list (`M4 4h12M4 8h7M4 12h5`) | mobile "Find in page" button |
| 4 | layout/AppShell.svelte:181 | magnifier (circle + handle) | mobile search link |
| 5 | layout/SidebarUtilityLinks.svelte:18 | trash can (`M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6`) | Trash link |
| 6 | layout/SidebarUtilityLinks.svelte:24 | cog (circle r=3 + gear path) | Settings link |
| 7 | layout/HistoryButtons.svelte:54-55 | chevron left/right, chosen by `direction` prop (`M12.5 4.5 7 10l5.5 5.5` / `M7.5 4.5 13 10l-5.5 5.5`) | back / forward navigation |
| 8 | layout/NoteListRow.svelte:71-72 | pin (fill `currentColor` when `note.isPinned`) | pinned note marker |
| 9 | notes/AttachmentList.svelte:78-79 | image frame (rect + circle + mountain path) | image attachment |
| 10 | notes/AttachmentList.svelte:82-83 | document with lines (page + folded corner) | file attachment |
| 11 | weekly/AttachNoteButton.svelte:54-55 | paperclip (`M9.5 1.75H4.25...`), `animate-pulse` while attaching | attach note |
| 12 | search/SearchTypeIcon.svelte:18-25 | note page (`M14 3H7...`) or clock (circle + hands), by `kind` | search hit type |

Unique drawings: the two disclosure chevrons (1, 2) and the back/forward chevrons (7) are chevron shapes, but their paths were not compared, so the count of distinct drawings is not stated here.

