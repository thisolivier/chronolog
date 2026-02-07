# Admin Components

CRUD components for managing the client/contract/deliverable/work-type hierarchy. Used by the `/admin` routes.

## Components

- **AdminBreadcrumb.svelte** — Breadcrumb navigation for admin pages.
- **ClientRow.svelte** — Inline-editable client row with name, short code, and delete confirmation.
- **ContractRow.svelte** — Inline-editable contract row with name, description, active toggle, and link to contract detail.
- **ContractCreateModal.svelte** — Modal for creating new contracts under a client.
- **DeliverableCard.svelte** — Card displaying a deliverable with inline editing, nested work type list, and add-work-type form.
- **WorkTypeRow.svelte** — Inline-editable work type row within a deliverable card.

## Patterns

All edit components use SvelteKit `use:enhance` for progressive form submissions. Edit state is managed locally with `$state` and reset on cancel. Delete uses a two-step confirmation (click Delete, then Confirm).
