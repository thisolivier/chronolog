# Admin Components

CRUD components for managing the client/contract/deliverable/work-type hierarchy. Used by the `/admin` and `/settings` routes.

## Components

- **AdminBreadcrumb.svelte** — Breadcrumb navigation for admin pages (starts at Settings).
- **ClientRow.svelte** — Inline-editable client row with name, short code, emoji, colour (palette select from `$lib/utils/client-colors`, persisted as `color_index`), a direct Archive button (Activate once archived; sprint 041-CL), and delete via `DeleteImpactDialog`. Shows the client's colour dot in read mode.
- **ContractRow.svelte** — Inline-editable contract row with name, description, active toggle, link to contract detail, a direct Archive / Activate button (same labels as ClientRow; the buttons' accessible names include the row's name), and up/down buttons to reorder within its client.
- **DeliverableCard.svelte** — Card displaying a deliverable with inline editing, nested work type list, and add-work-type form.
- **WorkTypeRow.svelte** — Inline-editable work type row within a deliverable card.
- **DeleteImpactDialog.svelte** — Confirm dialog stating the real entry/note/contract counts. When there is recorded work, Archive is the focused default; deleting is the explicitly named secondary action ("Delete and reassign" for clients and contracts, "Delete, keep a note on entries" for deliverables and work types).
- **FormFeedback.svelte** — Success/error banner that shows the specific message returned by the server.
- **SettingsShell.svelte** — Page frame for `/settings` and `/admin`: app header, offline banner, centred column.

## Patterns

All edit components use SvelteKit `use:enhance` for progressive form submissions. Edit state is managed locally with `$state` and reset on cancel. Every delete opens `DeleteImpactDialog`, which states what the delete touches; nothing cascades silently.

`form-enhancers.ts` holds the shared `use:enhance` helpers: `closeOnSuccess()` closes add and edit forms only when the server accepts the change (a rejected form keeps what was typed), and the `escapeCancels` action maps Escape to cancel instead of save.
