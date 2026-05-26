# Styling Patterns

## CSS Framework

The application uses **Tailwind CSS v4** via a single import in `src/app.css`:

```css
@import "tailwindcss";
```

All styling is done through Tailwind utility classes in component templates. There are no separate CSS files for components (except scoped `<style>` blocks in `NoteEditor.svelte` for TipTap-specific styles).

## Color Palette

The app uses a minimal, functional color scheme with Tailwind's default gray/blue palette:

| Use | Colors |
|-----|--------|
| Backgrounds | `bg-white`, `bg-gray-50` |
| Borders | `border-gray-200`, `border-gray-100`, `border-gray-300` |
| Text primary | `text-gray-900` |
| Text secondary | `text-gray-600`, `text-gray-500` |
| Text muted | `text-gray-400` |
| Selected/active | `bg-blue-50`, `text-blue-700`, `border-blue-600` |
| Primary actions | `bg-blue-600`, `hover:bg-blue-700` |
| Danger actions | `bg-red-600`, `text-red-600`, `hover:bg-red-50` |
| Success states | `bg-green-50`, `text-green-700`, `bg-green-100`, `text-green-800` |
| Warning states | `bg-yellow-50`, `bg-yellow-500` |
| Wiki links | `text-indigo-700`, `bg-indigo-50` |

## Typography

| Element | Classes |
|---------|---------|
| Page headings | `text-2xl font-semibold text-gray-900` |
| Section headings | `text-lg font-medium text-gray-900` or `text-lg font-bold` |
| Note titles | `text-sm font-semibold text-gray-900` |
| Body text | `text-sm text-gray-700` or `text-sm text-gray-600` |
| Labels | `text-xs font-medium text-gray-600` or `text-sm font-medium text-gray-700` |
| Metadata | `text-xs text-gray-400` or `text-xs text-gray-500` |
| Timer display | `font-mono text-2xl font-bold tabular-nums` |
| Monospace IDs | `font-mono text-xs` |

## Component Patterns

### Buttons

| Type | Classes |
|------|---------|
| Primary | `bg-blue-600 text-white hover:bg-blue-700 rounded-md px-4 py-2 text-sm font-medium` |
| Secondary | `border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 rounded-md px-3 py-1.5 text-sm` |
| Danger | `bg-red-600 text-white hover:bg-red-700` or `text-red-600 hover:bg-red-50` |
| Disabled | `disabled:opacity-50 disabled:cursor-not-allowed` |
| Ghost (small) | `text-xs text-gray-500 hover:text-blue-600` |

### Form Inputs

Standard input pattern:
```
rounded-md border border-gray-300 px-3 py-2 shadow-sm
focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none
```

Compact input (timer/inline):
```
rounded border border-gray-300 px-1.5 py-1 text-xs shadow-sm
```

### Cards

```
rounded-lg border border-gray-200 bg-white p-6 shadow-sm
```

### Modals

```
fixed inset-0 z-50 flex items-center justify-center bg-black/40  (backdrop)
w-full max-w-md rounded-lg bg-white p-6 shadow-xl                (content)
```

### Selection Indicators

- List items: `border-l-2 border-blue-600 bg-blue-50` (selected) vs `border-l-2 border-transparent` (unselected)
- Sidebar items: `bg-blue-50 text-blue-700` (selected) vs `text-gray-700 hover:bg-gray-100` (unselected)

### Status Badges

- Active: `bg-green-100 text-green-800 rounded-full px-2.5 py-0.5 text-xs font-medium`
- Inactive: `bg-gray-100 text-gray-800 rounded-full px-2.5 py-0.5 text-xs font-medium`

### Error Messages

```
rounded-md bg-red-50 p-4 text-sm text-red-700
```

### Success Messages

```
rounded-md bg-green-50 p-4 text-sm text-green-700
```

## TipTap Editor Styles

The `NoteEditor.svelte` includes scoped global styles for TipTap content:

| Element | Style |
|---------|-------|
| Headings | H1: 2em/700, H2: 1.5em/600, H3: 1.25em/600 |
| Paragraphs | 0.5em vertical margin |
| Lists | 1.5em left padding |
| Links | Blue (`#3b82f6`), underlined |
| Code (inline) | Gray background, monospace, 0.9em |
| Code blocks | Dark background (`#1f2937`), light text |
| Blockquotes | Left gray border, italic, gray text |
| Wiki links | Indigo text, light indigo background, 3px radius |
| Images | Max 100% width, rounded corners, outline when selected |
| Horizontal rules | 2px gray-200 top border |
| Placeholder | Gray `#adb5bd`, floated left |

## Responsive Breakpoints

| Breakpoint | Usage |
|------------|-------|
| `max-width: 1023px` | Mobile layout (single panel) via JS media query in AppShell |
| `md:hidden` | Mobile-only header elements |
| `sm:grid-cols-2` / `sm:grid-cols-3` | Responsive form grids |
| `lg:grid-cols-3` | Admin dashboard grid |
