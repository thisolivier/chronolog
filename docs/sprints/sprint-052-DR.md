# Sprint 052 — DR: Design r1 stage 2, tokens, system font, earth-tone palette, contract mark

**Status:** ready for review
**Branch:** `design-r1-stage2` (from the integration branch `design-r1`) · **Worktree:** `.claude/worktrees/design-r1-stage2` · **Port:** 5181 (5173 was held by the `design-r1-search-api` worktree's server)
**Sources:** `docs/design/r1/specs/01-design-system.md` (DS-01, DS-02, DS-05, DS-06; DS-03, DS-04 pattern repeats and DS-07 deferred), owner decisions of 2026-11-07 in `docs/decisions.md` (solid colour marks, system sans stack, no bundled font), inventory `docs/design/r1/source-map/01-styling-inventory.md`, mood board `docs/design/r1/images/raw/03-field-notes.png`.

**Goal:** a palette and typography pass with no layout or behaviour change: design tokens in Tailwind 4 `@theme`, the system font, reduced motion, eight earth-tone client colours, a shared `ContractMark`, minimal control recipes, and the whole app moved off Tailwind's blue / stone palette.

## Decisions taken

### Tokens (`src/lib/styles/tokens.css`, `@theme static`)

`@theme static` (not `inline`): the semantic roles reference palette variables that all live on `:root`, so plain `@theme` resolves them correctly, and `static` puts every variable on `:root` even when no utility uses it, which the component `<style>` blocks (`var(--color-…)`) need. Checked against the Tailwind 4 docs (context7: `@theme`, `@theme inline`, `@theme static`, namespaces, `@utility`).

| Scale | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 |
|---|---|---|---|---|---|---|---|---|---|---|
| chalk (neutrals; 950 `#1a1713`) | `#f8f6f0` | `#f0ece3` | `#e3ddd0` | `#d0c7b6` | `#a89d89` | `#746957` | `#655b4b` | `#4e463a` | `#3a342b` | `#27231d` |
| pine | `#eef3ec` | `#dde8d9` | `#bcd2b8` | `#8fb08f` | `#5c8a6a` | `#3d6b51` | **`#294c3b`** | `#1f3b2e` | `#182e24` | `#11211a` |
| moss | `#f2f4ec` | `#e4e9da` | `#ccd4bc` | `#adb996` | **`#879473`** | `#6b785a` | `#556046` | `#434c38` | `#33392a` | `#23281d` |
| bark | `#f6f1ec` | `#ebe1d6` | `#d8c5b3` | `#bda289` | `#977860` | `#7a5c46` | **`#624735`** | `#4e3829` | `#3b2a1f` | `#2a1e16` |
| rust | `#fbf0ec` | `#f5ddd5` | `#ebbdb0` | `#db9482` | `#c76d58` | **`#ad4c3b`** | `#963f30` | `#7c3327` | `#62281f` | `#4a1e17` |
| ochre | `#fbf5e7` | `#f5e8c7` | `#ecd59f` | `#dabb78` | **`#bc9859`** | `#9c7a3c` | `#7e612c` | `#654d23` | `#503d1c` | `#3c2d15` |
| leaf (running / success) | `#edf5ec` | `#d7ead5` | `#b1d5ae` | `#83ba80` | `#4f9a55` | `#367f42` | `#2a6835` | `#22552b` | `#1b4322` | `#14321a` |

Bold = the mood-board swatch. Chalk 50 is the mood-board chalk.

| Role | Value | Role | Value |
|---|---|---|---|
| `canvas` (page) | chalk-50 | `primary` / `-hover` / `-wash` | pine-600 / pine-700 / pine-50 |
| `surface` (panels) | `#fffefa` | `danger` / `-hover` / `-wash` | rust-600 / rust-700 / rust-50 |
| `sunken` (tinted group) | chalk-100 | `warning` / `-wash`; `today` | ochre-700 / ochre-50; ochre-100 |
| `line` (border) | chalk-300 | `success` / `-wash`; `running` | leaf-700 / leaf-50; leaf-500 |
| `divider` | chalk-200 | `selection` / `selection-edge` | pine-100 / pine-600 |
| `ink` / `ink-soft` / `ink-muted` / `ink-faint` | chalk-900 / 700 / 600 / 500 | `focus` | pine-500 |
| `on-accent` | `#fffefa` | `ink-fainter` (muted / inactive only, 2.65:1, below AA) | chalk-400 |

Fonts: `--font-sans` = `-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif` (set on `html` in `app.css`); `--font-mono` = `ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace` (`font-mono` codes and durations, the editor's code blocks). Radius: `--radius-control` 0.375rem, `--radius-panel` 0.5rem, `--radius-mark` 0.25rem. Shadows: `--shadow-panel`, `--shadow-menu` (warm ink-tinted). Identity sizing: `--size-mark-sm` 1rem, `--size-mark-md` 1.25rem, `--size-mark-lg` 1.75rem, **`--spacing-mark-gap` 5px** (the sidebar's 8px less about 40%, DS-05; an actual-size review is still owed).

Reduced motion (`app.css`): under `prefers-reduced-motion: reduce` every animation runs once in 0.01 ms and transitions are instant, so the `pulse-dot` running indicator and `animate-pulse` become static (DS-01 verification).

### WCAG AA pairings verified (4.5:1 text, 3:1 non-text)

Computed with the WCAG 2.x relative-luminance formula (scratch script). Every text/background pair that appears in one class string in `src/` was also extracted and checked: the lowest is `ink-faint` on chalk-100 at 4.57.

| Pair | Ratio | Pair | Ratio |
|---|---:|---|---:|
| ink on surface / canvas / chalk-100 / chalk-200 | 15.48 / 14.45 / 13.25 / 11.54 | on-accent on primary (pine-600) / pine-700 | 9.50 / 12.08 |
| ink-soft on surface / chalk-100 / chalk-200 | 9.20 / 7.88 / 6.86 | on-accent on rust-600 / rust-700 / rust-500 | 6.82 / 8.82 / 5.37 |
| ink-muted on surface / canvas / chalk-100 / chalk-200 | 6.60 / 6.17 / 5.65 / 4.92 | on-accent on ochre-600 / leaf-600 | 5.73 / 6.65 |
| ink-faint on surface / canvas / chalk-100 | 5.33 / 4.98 / 4.57 | pine-600 / pine-500 text on surface | 9.50 / 6.08 |
| pine-700 on pine-50 / pine-100 | 10.83 / 9.64 | rust-600 / rust-700 on rust-50 | 6.16 / 7.96 |
| ochre-700 on ochre-50 / ochre-100 | 7.32 / 6.54 | ochre-900 on ochre-50 / ochre-100 | 12.24 / 10.93 |
| leaf-700 / leaf-800 on leaf-50 | 7.86 / 10.08 | running dot leaf-500 on canvas (non-text) | 4.55 |
| focus pine-500 on surface (non-text) | 6.08 | ochre-500 as text | 3.95, so `text-amber-500` maps to ochre-600 |

Slot 4 was Pine `#294c3b`, identical to primary and selection-edge; review fix: now Lake, a dusk blue distinct in hue from Juniper (teal) and Heather (plum). `ink-fainter` (chalk-400) is 2.65:1 on surface and used only for the muted sidebar state.

Client marks, initials on the strong colour / wash text on the wash: Rust 5.37 / 8.63, Juniper 5.99 / 8.54, Heather 6.68 / 8.82, Ochre (ink initials) 5.78 / 7.52, Lake 7.01 / 9.45, Bark 8.42 / 8.86, Moss (ink initials) 4.84 / 7.74, Clay 5.17 / 7.90.

### Client colours (`src/lib/utils/client-colors.ts`)

Same index semantics, so no migration; each slot keeps its old hue family where one exists. Each entry has `borderClass` (`border-l-id-*`), `dotClass` (strong, `bg-id-*`), new `markTextClass`, `bgClass` (wash, `bg-id-*-wash`) and new `washTextClass` (`text-id-*-ink`); new getter `getClientMarkTextClass`. The least-used-index rule is unchanged.

| Index | Was | Now | Strong / wash / ink |
|---:|---|---|---|
| 0 | Rose | Rust | `#ad4c3b` / `#f8e7e2` / `#6e2b20` |
| 1 | Sky | Juniper | `#3b6a6e` / `#e3eeee` / `#24474a` |
| 2 | Violet | Heather | `#7a4e68` / `#f1e6ec` / `#55334a` |
| 3 | Amber | Ochre | `#bc9859` / `#f6edd9` / `#5e4720` |
| 4 | Teal | Lake | `#46597a` / `#e6eaf2` / `#2c3a55` |
| 5 | Fuchsia | Bark | `#624735` / `#efe6dd` / `#4e3829` |
| 6 | Lime | Moss | `#879473` / `#ecefe4` / `#434c38` |
| 7 | Orange | Clay | `#a15a33` / `#f7e9df` / `#6a3a1f` |

### ContractMark (`src/lib/components/identity/`)

Contracts have no short code (only clients have `short_code`), so initials come from the contract name: first letter of up to three meaningful words, a single word gives its first two letters, a short upper-case code (`CCX`, `Q4`) stays whole, filler words skipped (`contract-initials.ts`, 6 unit tests). Props `contractName`, `colorIndex`, `size` (sm / md / lg from the tokens), `label` (with it the mark is `role="img"` with that name; without it, `aria-hidden`), `selected` (pine ring), `muted` (60% opacity). Placed in the note editor header before the client / contract context, `size="sm"`, with `gap-mark-gap`. For that, `contractDirectory.labels` gained `clientColorIndex` (additive).

## Mapping table (old → new)

Applied by a scratch script (not in the repo) to every `.svelte` and `.ts` under `src/`, variant prefixes (`hover:`, `focus:`, `class:`, `disabled:`, `placeholder:`) and opacity suffixes (`/70`) kept. 884 replacements, 109 distinct old→new pairs, 72 files. Stone is not aliased: no `stone-` utility remains.

| Old | New |
|---|---|
| `text-stone-900` / `-800` / `-950` | `text-ink` |
| `text-stone-700` | `text-ink-soft` |
| `text-stone-600` | `text-ink-muted` |
| `text-stone-500`, `text-stone-400` | `text-ink-faint` (stone-400 text was 2.5:1; now AA). Exception: the sidebar client heading's muted branch uses `text-ink-fainter` so muted stays quieter than resting (the only ternary the merge had collapsed) |
| `text-stone-300` | `text-chalk-300` (disabled / decorative only) |
| `border-stone-200`, `divide-stone-200`, `ring-stone-200`, `border-l-stone-200` | `*-divider` |
| `border-stone-300`, `border-l-stone-300` | `*-line` |
| other `stone-N` (bg, border, decoration) | `chalk-N` |
| `bg-white` / `bg-white/70` | `bg-surface` / `bg-surface/70` |
| `text-white` | `text-on-accent` |
| `bg-black/N` | `bg-chalk-950/N` |
| `bg-blue-600` / `bg-blue-700` | `bg-primary` / `bg-primary-hover` |
| `focus:ring-blue-500`, `focus:border-blue-500`, `focus:outline-blue-500` | `focus:*-focus` |
| other `blue-N`, `indigo-N`, `sky-N` | `pine-N` |
| `red-N` | `rust-N` |
| `amber-N`, `yellow-N` | `ochre-N` (`text-amber-500` → `text-ochre-600` for AA) |
| `green-N`, `emerald-N` | `leaf-N` |
| `rose/sky/violet/amber/teal/fuchsia/lime/orange` client classes | `id-<name>` identity tokens |

Hex: `NoteEditor.svelte` editor chrome (placeholder, list markers, checkbox accent, rules, links, inline and block code, blockquote, wiki-links, missing attachments, selected image outline) now reads token variables, `font-family: monospace` → `var(--font-mono)`; the highlight.js token palette (20 lines) is unchanged. `TimerIndicator.svelte` running dot `var(--color-running)`, paused ring chalk-400. `dom-find.ts` find highlights: other matches ochre-200 (ink text, 10.85:1), the current match ochre-600 with on-accent text (5.73:1) and, in the textarea fallback, an ochre-700 outline; current vs other fill 4.01:1; `entry-reveal.ts` outline ochre-400. `theme-color` (app.html), `theme_color` / `background_color` (static/manifest.webmanifest and the PWA manifest in vite.config.ts) → `#294c3b` / `#f8f6f0`. `src/error.html` uses the palette literals (it has no Tailwind). `note-print.ts` (a separate print window without the app's CSS) and `print-styles.css` keep their neutral greys.

## Control recipes (`src/lib/styles/recipes.css`, `@utility`)

Colour, border and focus only; padding, size and radius stay at the call site, so a swap never moves layout. Applied by a second scratch script that replaced a whole matching class set and nothing else:

| Recipe | Replaced set | Call sites |
|---|---|---:|
| `btn-primary` | `bg-blue-600 text-white hover:bg-blue-700` (+ `focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none`) | 29: timer Save (TimerCompletionForm), Add entry modal, timer start Save, new-entry row, Settings client / contract / deliverable / work type forms, delete dialog, outbox panel, login, register, unlock, 2FA, API tokens, error page |
| `btn-secondary` | `border border-stone-300 bg-white text-stone-700 hover:bg-stone-50` | 24: timer Discard, Add entry Cancel, settings Cancel buttons, trash, search, Back to app |
| `btn-danger` | `bg-red-600 text-white hover:bg-red-700` | 5: timer **Stop** (text unchanged), note Delete confirm, delete dialog, 2FA disable, connection retry |
| `btn-quiet` | `text-stone-500/600 hover:bg-stone-100 (hover:text-stone-700/800)` on rounded buttons | 13: note Move / Export triggers, Delete cancel, history ‹ ›, find ↑ ↓, week strip, phone header icons |
| `input-base` | `border border-stone-300 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none` | 38 fields |
| `menu-panel` / `menu-item` | `border border-stone-200 bg-white shadow-lg` on absolute panels / `text-stone-700 hover:bg-stone-100` full-width left items | 5 / 2: Move, Export, New note, week status, wiki-link list |

Roughly 70 of the 160 `<button>` tags now use a recipe; about 90 keep inline (token) colour utilities because their class sets differ (toolbar toggles, card actions, sidebar rows, links styled as buttons).

## Tests

- `npm run check`: `svelte-check found 0 errors and 0 warnings`
- `npm run lint`: clean (no output from `eslint .`)
- `npm test`: `Test Files 117 passed (117)`, `Tests 1117 passed (1117)` (new: `contract-initials.test.ts` 9, including decomposed accents, astral letters and ß; `client-colors.test.ts` +1)
- Playwright chromium, `PLAYWRIGHT_BASE_URL=http://localhost:5181 npm run test:playwright:chromium` (server started with `ALLOW_REGISTRATION=true TRUSTED_ORIGINS=http://127.0.0.1:5181,http://localhost:5181`): **`6 skipped, 97 passed (1.2m)`**.
- After the review fixes (same command): `6 skipped, 97 passed (1.1m)`; check 0 errors / 0 warnings, lint clean, `npm test` 117 files / 1120 tests. Screenshots retaken (Amplitude now shows Lake).
- An earlier run with `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5181`: `1 failed, 1 flaky, 6 skipped, 95 passed (1.3m)`. The failure is environmental: `navigation-journeys` J8 asserts `toHaveURL(/localhost:\d+\/$/)` and the page was on `127.0.0.1`; it passes against `localhost` (7/7 in that spec, then the full run above). The flaky one (`history-buttons` desktop) passed on retry and in the full run.
- Updated class assertions: `client-colours.spec.ts` (colour names Rust / Juniper / Heather / Ochre), `notes-helpers.ts` (`/pine/` for the selected sidebar row), `sidebar-archive-collapse` (`bg-pine-50`), `task-lists` (`bg-pine-100`), `timesheet-polish` and `timer-start-today` (`bg-ochre-100`), `two-factor-login` (`.bg-rust-50`); unit `client-colors.test.ts`, `week-strip-segments.test.ts`.

## Screenshots (`docs/review/screenshots/sprint-052/`, chromium)

- `01-notes-workspace-desktop.png`: 1280×800, sidebar, list, editor with the RG contract mark, linked entries, running timer.
- `02-timesheet-desktop.png`: week strip with today in ochre, entry cards with identity left borders.
- `03-running-timer.png`: sidebar timer widget with the rust Stop.
- `04-notes-workspace-iphone.png`: 390×844, note editor header and toolbar.
- `05-settings-clients.png`: Settings → Clients with four identity colours.

Reviewed by eye: no white-on-white, borders visible, muted text readable on chalk.

## Follow-ups

- Ochre and Moss marks are below 3:1 against the surface (2.68 / 3.19). They always sit beside the client or contract name, so colour is not the only cue (DS-02), but check them at actual size.
- `--spacing-mark-gap` 5px still needs the actual-size review DS-05 asks for.
- **Browser print of a note now hides the editor toolbar, linked time entries, attachments, linked panels and backlinks.** `print-styles.css` named `bg-gray-50` / `border-gray-200`, which the app never used, so those rules matched nothing; with the new class names they match, as the stylesheet's comments intended. Every print rule except `@page` is now scoped to `body:has([data-note-print-root])` (set on `NoteEditorPanel`), so pages without the note editor (Settings, timesheet without a note) print normally even after the stylesheet has loaded; before, its `nav`/`header`/`button` hiding applied to any page. Export → PDF uses `note-print.ts` and is unaffected.
- Highlight.js colours in the editor and print are still GitHub's; theme them with the palette later.
- `src/routes/+layout.svelte`'s update toast (`bg-primary text-on-accent`) and some sidebar / card buttons still carry inline colour utilities rather than recipes (about 90 buttons).
- The commit trailer says `Claude Opus 5.5` (the attribution the session's harness requires) rather than the `Claude Fable 5.1` line in the brief.
