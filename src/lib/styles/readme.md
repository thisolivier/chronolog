# styles

Global design tokens and control recipes (design r1, sprint 052-DR). Both files are imported by
`src/app.css` right after Tailwind, so they generate utilities like any Tailwind theme.

| File | Purpose |
| --- | --- |
| `tokens.css` | `@theme static` block: system font stacks (`--font-sans`, `--font-mono`); palette scales `chalk` (neutrals), `pine`, `moss`, `bark`, `rust`, `ochre`, `leaf` (50–900); semantic roles (`canvas`, `surface`, `sunken`, `line`, `divider`, `ink`, `ink-soft`, `ink-muted`, `ink-faint`, `on-accent`, `primary`, `danger`, `warning`, `today`, `success`, `running`, `selection`, `selection-edge`, `focus`); client identity colours (`id-<name>`, `-wash`, `-ink`); radius, shadow, contract-mark sizes and the mark gap; pattern tiles (063-DR): `--size-mark-timer-tile` (the large mark rounded to whole px), `--size-mark-timer-wide` (1.5 × that), `--size-tile-repeat` (the small mark rounded to whole px: WebKit seams), `--opacity-tile-repeat` (0.18); time review rows: `--size-entry-identity`, `--spacing-entry-rule-start`, and (064-DR) `--size-entry-action` (a row action button, 1.5rem, 2rem under `pointer: coarse` in an unlayered override after the theme) and `--spacing-entry-column-gap` (the wide row's column gap), which the day heading's right padding uses to put the day total over the entries' durations. |
| `recipes.css` | `@utility` control recipes: `btn-primary`, `btn-secondary`, `btn-danger`, `btn-quiet`, `input-base`, `menu-panel`, `menu-item`. Colour, border and focus only; the call site keeps padding, size and radius. |

## Working patterns

- Prefer semantic roles (`text-ink-muted`, `bg-surface`, `border-line`, `bg-primary`) over scale steps in new code; reach for a scale (`bg-pine-50`) only for a tint the roles do not name.
- Do not use Tailwind's default colour families (`blue-`, `stone-`, `gray-`...): they still exist in Tailwind but are off-palette. `grep -rnE '(bg|text|border|ring)-(stone|blue|gray|slate|zinc|indigo|emerald|red|amber|green|yellow|sky)-[0-9]' src` should stay empty.
- Component `<style>` blocks read tokens with `var(--color-…)`; `@theme static` makes sure every variable is on `:root`.
- Text pairings were checked for WCAG AA (4.5:1); the table is in `docs/sprints/sprint-052-DR.md`. Re-check when changing a value.
- Reduced motion lives in `src/app.css`: animations run once and transitions are instant (the timer's running dot was removed in 064-DR).
