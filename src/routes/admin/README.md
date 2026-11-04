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

Actions: `archive` / `unarchive` hide or restore a client or contract without touching its work (the rows' Archive and Activate buttons post them directly; the Delete dialog still offers Archive). `delete` goes through `src/lib/server/db/queries/safe-deletion.ts`, which reassigns entries and notes to the system "Deleted Client / Deleted Contract" in one transaction (see `src/lib/server/db/README.md`).

Breadcrumbs start at Settings. `src/routes/settings/+layout.svelte` wraps the pages in `SettingsShell`.

## Components

Reusable UI components live in `src/lib/components/admin/` (see that module's README for the full list), including `DeleteImpactDialog`, `FormFeedback` and `SettingsShell`.

## Database Queries

Query helpers in `src/lib/server/db/queries/`, shared with the `/api/*` routes (sprint 031-CL: the API and the `chronolog` CLI do everything these pages do, through the same functions):

- **clients.ts** — List, get, create, update, archive clients (scoped by user_id); `nextClientColorIndex` gives the default colour (`suggestClientColorIndex` in `src/lib/utils/client-colors.ts`, also used by the "New client" form)
- **contracts.ts** — List, get, create, update, archive (`setContractArchived`), reorder contracts (scoped by client_id); `getContractForUser` checks ownership through the client for the API
- **deliverables.ts** — List, get, create, update deliverables (scoped by contract_id); `getDeliverableForUser` for the API
- **work-types.ts** — List, create, update, reorder work types (scoped by deliverable_id); `getWorkTypeForUser` for the API
- **safe-deletion.ts** — Reassigning deletes for contracts and clients, and annotated deletes for deliverables and work types; usage counts for the confirm dialogs (`getClientUsage`, `getContractUsage`, `getEntryCountsBy`)

Messages shared by the actions and the API (`deletionMessage`, `archiveMessage`, `entriesKeptMessage`, `duplicateShortCodeMessage`) live in `src/lib/server/admin-actions.ts`.

| Form action | Query functions | Same rule in the API |
|---|---|---|
| `create` (client) | `createClient`; name + short code required, colour index 0-7, duplicate → “Short code … already used” | `POST /api/clients` (409 `duplicate`) |
| `update` / `updateClient` | `updateClient` | `PATCH /api/clients/:id` |
| `archive` / `unarchive` | `setClientArchived` | `PATCH /api/clients/:id {archived}` |
| `delete` | `getClientUsage`, `deleteClientWithReassignment` | `DELETE /api/clients/:id` |
| `createContract` | `createContract` (to the end of the order) | `POST /api/contracts` |
| `updateContract` | `updateContract` | `PATCH /api/contracts/:id` |
| `archiveContract` / `unarchiveContract` | `setContractArchived` | `PATCH /api/contracts/:id {archived}` |
| `deleteContract` | `getContractUsage`, `deleteContractWithReassignment` | `DELETE /api/contracts/:id` |
| contract reorder (drag) | `reorderContractsForUser` | `PATCH /api/contracts/reorder` |
| `createDeliverable` / `updateDeliverable` | `createDeliverable` / `updateDeliverable` (sort order defaults to 0) | `POST /api/deliverables`, `PATCH /api/deliverables/:id` |
| `deleteDeliverable` | `deleteDeliverableWithNote` | `DELETE /api/deliverables/:id` |
| `createWorkType` / `updateWorkType` | `createWorkType` / `updateWorkType` | `POST /api/work-types`, `PATCH /api/work-types/:id` |
| `deleteWorkType` | `deleteWorkTypeWithNote` | `DELETE /api/work-types/:id` |
| `reorderWorkTypes` | `reorderWorkTypes` | (PATCH `sortOrder` per work type) |

## Authorization

All routes verify the current user owns the requested resources by checking `user_id` through the client ownership chain. The auth guard in `hooks.server.ts` ensures only authenticated users reach `/admin` and `/settings` routes.
