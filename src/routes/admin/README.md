# Admin Module

CRUD interface for managing the client hierarchy: clients, contracts, deliverables, and work types. Reached from the Settings page (`/settings`).

## Architecture

All admin routes use SvelteKit **form actions** for mutations (progressive enhancement) and **+page.server.ts load functions** for data fetching. Every query is filtered by `user_id` from the session for data isolation.

Database queries are centralized in `src/lib/server/db/queries/` to keep route files focused on request handling.

## Route Structure

```
/admin                          — Redirects (307) to /settings
/admin/clients                  — Client list with create/edit/archive/delete
/admin/clients/[clientId=uuid]  — Client detail with contracts list
/admin/clients/[clientId=uuid]/contracts/[contractId=uuid]
                                — Contract detail with deliverables and work types
/settings                       — Settings hub: links to Clients and contracts and Two-factor
/settings/two-factor            — Two-factor authentication
```

`[clientId=uuid]` and `[contractId=uuid]` use the matcher in `src/params/uuid.ts` (`isUuid` from `$lib/utils/uuid`). A malformed ID returns 404 before it reaches the database.

Actions: `archive` / `unarchive` hide or restore a client or contract without touching its work. `delete` goes through `src/lib/server/db/queries/safe-deletion.ts`, which reassigns entries and notes to the system "Deleted Client / Deleted Contract" in one transaction (see `src/lib/server/db/README.md`).

Breadcrumbs start at Settings. `src/routes/settings/+layout.svelte` wraps the pages in `SettingsShell`.

## Components

Reusable UI components live in `src/lib/components/admin/` (see that module's README for the full list), including `DeleteImpactDialog`, `FormFeedback` and `SettingsShell`.

## Database Queries

Query helpers in `src/lib/server/db/queries/`:

- **clients.ts** — List, get, create, update, archive, delete clients (scoped by user_id); `colorIndex` (0-7, palette in `src/lib/utils/client-colors.ts`) is set from the client row or via `PATCH /api/clients/:id`
- **contracts.ts** — List, get, create, update, archive (`setContractArchived`), delete, reorder contracts (scoped by client_id); `POST /api/contracts` accepts a `newClient` to create the client in the same request
- **deliverables.ts** — List, get, create, update, delete deliverables (scoped by contract_id)
- **work-types.ts** — List, create, update, delete, reorder work types (scoped by deliverable_id)
- **safe-deletion.ts** — Reassigning deletes for contracts and clients, and annotated deletes for deliverables and work types; usage counts for the confirm dialogs

## Authorization

All routes verify the current user owns the requested resources by checking `user_id` through the client ownership chain. The auth guard in `hooks.server.ts` ensures only authenticated users reach `/admin` and `/settings` routes.
