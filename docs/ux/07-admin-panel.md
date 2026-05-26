# Admin Panel

## Overview

The admin panel (`/admin`) provides CRUD management for the client hierarchy: Clients > Contracts > Deliverables > Work Types. It uses a dedicated layout with a fixed header and centered content area, separate from the main three-panel app shell.

## Admin Layout

```
+----------------------------------------------------------+
|  Chronolog / Admin                [Back to Dashboard]     |
+----------------------------------------------------------+
|                                                           |
|  (page content rendered here)                             |
|                                                           |
+----------------------------------------------------------+
```

- Header: "Chronolog" brand link (to `/`), "Admin" breadcrumb link (to `/admin`), "Back to Dashboard" button (to `/`)
- Content: Centered, max-width 1280px (`max-w-5xl`)

## Admin Home (`/admin`)

```
+----------------------------------------------------------+
|  Admin                          [user name]  [Sign out]   |
|  Manage your client hierarchy and settings.               |
|                                                           |
|  +-------------------+                                    |
|  | Clients           |   <-- card link                    |
|  | Manage clients,   |                                    |
|  | contracts, etc.   |                                    |
|  +-------------------+                                    |
+----------------------------------------------------------+
```

- Shows logged-in user's name or email
- **Sign out button**: POSTs to `/api/auth/sign-out`, then redirects to `/login`
- **Clients card**: Links to `/admin/clients`

## Clients List (`/admin/clients`)

```
+----------------------------------------------------------+
|  Clients                                  [Add Client]    |
|  Manage your consulting clients.                          |
|                                                           |
|  (New Client form - shown when "Add Client" clicked)      |
|  +------------------------------------------------------+|
|  | Name: [__________]  Short Code: [____]  Emoji: [__]  ||
|  |                                  [Create Client]      ||
|  +------------------------------------------------------+|
|                                                           |
|  +------------------------------------------------------+|
|  | Name          | Short Code | Emoji | Actions          ||
|  |---------------|------------|-------|------------------||
|  | Acme Corp     | ACME       |       | Edit  Delete     ||
|  | Big Cheese    | BIGCH      |       | Edit  Delete     ||
|  +------------------------------------------------------+|
+----------------------------------------------------------+
```

### Client Row (`ClientRow.svelte`)

Two modes:

**Display mode**: Table row with client name (linked to detail page), short code badge, emoji, Edit/Delete buttons.

**Edit mode**: Inline form replacing the row. Fields for name, short code, emoji. Save/Cancel buttons. Uses SvelteKit form actions (`?/update`).

**Delete**: Two-step confirmation. First click shows "Confirm/Cancel" buttons, confirm submits `?/delete` form action.

### Create Client Form

Toggled by "Add Client" button. Fields: Name (required), Short Code (required), Emoji (optional). Server-side form action `?/create`.

## Client Detail (`/admin/clients/[clientId]`)

```
+----------------------------------------------------------+
|  Admin / Clients / Acme Corp                              |
|                                                           |
|  +------------------------------------------------------+|
|  | Acme Corp                              [Edit Client]  ||
|  | Code: ACME                                            ||
|  +------------------------------------------------------+|
|                                                           |
|  Contracts                             [Add Contract]     |
|                                                           |
|  (New Contract form - conditional)                        |
|  +------------------------------------------------------+|
|  | Name: [__________]                                    ||
|  | Description: [__________]                             ||
|  | [x] Active                                            ||
|  |                                  [Create Contract]    ||
|  +------------------------------------------------------+|
|                                                           |
|  +------------------------------------------------------+|
|  | Q1 Consulting                     Active  Edit Delete ||
|  | Description text here                                 ||
|  +------------------------------------------------------+|
|  +------------------------------------------------------+|
|  | Q2 Development                   Inactive  Edit Delete||
|  +------------------------------------------------------+|
+----------------------------------------------------------+
```

### Breadcrumb

`AdminBreadcrumb.svelte`: "Admin / Clients / [Client Name]" -- each segment is a link except the last.

### Client Header

Shows client name and short code. "Edit Client" button toggles inline editing with name + short code fields.

### Contract Row (`ContractRow.svelte`)

Two modes:

**Display mode**: Card with contract name (linked to contract detail), optional description, Active/Inactive badge, Edit/Delete buttons.

**Edit mode**: Inline form with name, description, active checkbox. Save/Cancel buttons.

## Contract Detail (`/admin/clients/[clientId]/contracts/[contractId]`)

```
+----------------------------------------------------------+
|  Admin / Clients / Acme Corp / Q1 Consulting              |
|                                                           |
|  +------------------------------------------------------+|
|  | Q1 Consulting  [Active]            [Edit Contract]    ||
|  | Optional description                                  ||
|  +------------------------------------------------------+|
|                                                           |
|  Deliverables                        [Add Deliverable]    |
|                                                           |
|  (New Deliverable form - conditional)                     |
|  +------------------------------------------------------+|
|  | Name: [__________]   Sort Order: [0]                  ||
|  |                              [Create Deliverable]     ||
|  +------------------------------------------------------+|
|                                                           |
|  +------------------------------------------------------+|
|  | Development            order: 0   [+WT] [Edit] [Del] ||
|  |------------------------------------------------------||
|  | (Add Work Type form - conditional)                    ||
|  | Name: [__________]  Order: [0]     [Add]              ||
|  |------------------------------------------------------||
|  |   * Code Review (0)              [Edit] [Delete]      ||
|  |   * Development (1)              [Edit] [Delete]      ||
|  |   * Documentation (2)            [Edit] [Delete]      ||
|  +------------------------------------------------------+|
+----------------------------------------------------------+
```

### Deliverable Card (`DeliverableCard.svelte`)

Each deliverable is a bordered card with:

**Header**: Name, sort order, action buttons (+Work Type, Edit, Delete)

**Edit mode**: Inline form for name + sort order

**Work Type list**: Nested below the header. Each work type shown as a row with a small gray dot, name, sort order, Edit/Delete buttons.

### Work Type Row (`WorkTypeRow.svelte`)

Two modes:

**Display**: Small dot + name + sort order + Edit/Delete buttons

**Edit**: Inline form with name + sort order inputs

### Server Actions

All CRUD operations use SvelteKit form actions:

| Action | Route |
|--------|-------|
| `?/updateClient` | Client detail page |
| `?/createContract` | Client detail page |
| `?/updateContract` | Client detail OR contract detail page |
| `?/deleteContract` | Client detail page |
| `?/createDeliverable` | Contract detail page |
| `?/updateDeliverable` | Contract detail page |
| `?/deleteDeliverable` | Contract detail page |
| `?/createWorkType` | Contract detail page |
| `?/updateWorkType` | Contract detail page |
| `?/deleteWorkType` | Contract detail page |
| `?/reorderWorkTypes` | Contract detail page |

## Files

| File | Purpose |
|------|---------|
| `src/routes/admin/+layout.svelte` | Admin layout with header |
| `src/routes/admin/+page.svelte` | Admin home with sign out + cards |
| `src/routes/admin/clients/+page.svelte` | Clients list |
| `src/routes/admin/clients/+page.server.ts` | Clients CRUD actions |
| `src/routes/admin/clients/[clientId]/+page.svelte` | Client detail + contracts |
| `src/routes/admin/clients/[clientId]/+page.server.ts` | Client/contract actions |
| `src/routes/admin/clients/[clientId]/contracts/[contractId]/+page.svelte` | Contract detail + deliverables/work types |
| `src/routes/admin/clients/[clientId]/contracts/[contractId]/+page.server.ts` | Full CRUD for deliverables + work types |
| `src/lib/components/admin/AdminBreadcrumb.svelte` | Breadcrumb navigation |
| `src/lib/components/admin/ClientRow.svelte` | Inline-editable client table row |
| `src/lib/components/admin/ContractRow.svelte` | Inline-editable contract card |
| `src/lib/components/admin/DeliverableCard.svelte` | Deliverable card with nested work types |
| `src/lib/components/admin/WorkTypeRow.svelte` | Inline-editable work type row |
