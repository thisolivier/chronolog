# Admin Module

CRUD interface for managing the client hierarchy: clients, contracts, deliverables, and work types.

## Architecture

All admin routes use SvelteKit **form actions** for mutations (progressive enhancement) and **+page.server.ts load functions** for data fetching. Every query is filtered by `user_id` from the session for data isolation.

Database queries are centralized in `src/lib/server/db/queries/` to keep route files focused on request handling.

## Route Structure

```
/admin                          — Admin dashboard with links to management sections
/admin/clients                  — Client list with create/edit/delete
/admin/clients/[clientId]       — Client detail with contracts list
/admin/clients/[clientId]/contracts/[contractId]
                                — Contract detail with deliverables and work types
```

## Components

Reusable UI components live in `src/lib/components/admin/`:

- **AdminBreadcrumb** — Navigation breadcrumb trail
- **ClientRow** — Table row for a client with inline edit/delete
- **ContractRow** — Card for a contract with inline edit/delete
- **DeliverableCard** — Card for a deliverable with nested work types
- **WorkTypeRow** — Inline row for a work type with edit/delete

## Database Queries

Query helpers in `src/lib/server/db/queries/`:

- **clients.ts** — List, get, create, update, delete clients (scoped by user_id)
- **contracts.ts** — List, get, create, update, delete contracts (scoped by client_id)
- **deliverables.ts** — List, get, create, update, delete deliverables (scoped by contract_id)
- **work-types.ts** — List, create, update, delete, reorder work types (scoped by deliverable_id)

## Authorization

All routes verify the current user owns the requested resources by checking `user_id` through the client ownership chain. The auth guard in `hooks.server.ts` ensures only authenticated users reach `/admin` routes.
