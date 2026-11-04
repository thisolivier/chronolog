# Sprint 031 — CL: Admin objects through the API and CLI

**Status:** merged
**Branch:** `sprint-031-CL/cli-admin-objects` · **Worktree:** `.claude/worktrees/sprint-031-CL` · **Port:** 5209
**Sources:** owner request 2026-11-04 ("allow the CLI to create clients, contracts, deliverables, tags, the whole shebang"); `docs/sprints/sprint-028-CL.md` and `sprint-029-CL.md` (API shape, CLI, skill); the admin form actions under `src/routes/admin/**/+page.server.ts` (the rules the UI already enforces).

## Objective

Everything the Settings → Clients pages can do to clients, contracts, deliverables and work types can be done through `/api/*` with a personal token, and through the `chronolog` CLI, so the laptop secretary can set up a new client end to end. The API and the CLI enforce exactly the rules the admin pages enforce, by calling the same query modules (including `safe-deletion.ts`); no new business rules.

## Tasks

1. **Inventory.** Read every admin form action (`create`, `update`, `archive`, `unarchive`, `delete`, `createContract`, `updateContract`, `archiveContract`, `unarchiveContract`, `deleteContract`, `createDeliverable`, `updateDeliverable`, `deleteDeliverable`, `createWorkType`, `updateWorkType`, `deleteWorkType`, `reorderWorkTypes`, contract reorder) and list in the sign-off which query function and validation each one uses. The API must reuse those functions. If an action holds logic inline, move it into the query module first so both paths share it.
2. **REST.** Add or complete, all behind the existing auth and the standard error shape, with ownership checks on every id (404 for another user's object, never 403 leaks):
   - `POST /api/clients` (name, shortCode, emoji?, colorIndex? defaulting to the next free colour as the admin page does), `PATCH /api/clients/[id]` (name, shortCode, emoji, colorIndex, `archived: true|false`), `DELETE /api/clients/[id]` with the same safe-deletion behaviour as the admin page (reassign to the system client, return what was moved).
   - `PATCH /api/contracts/[id]` (name, description, isActive, `archived`), `DELETE /api/contracts/[id]` (safe deletion). `POST /api/contracts` exists; keep it.
   - `POST /api/deliverables` (contractId, name), `PATCH /api/deliverables/[id]` (name, sortOrder), `DELETE /api/deliverables/[id]` (safe deletion).
   - `POST /api/work-types` (deliverableId, name), `PATCH /api/work-types/[id]` (name, sortOrder), `DELETE /api/work-types/[id]` (safe deletion).
   - `GET` lists for deliverables and work types accept `?contractId=` / `?deliverableId=` and include `archived` objects only with `?includeArchived=true`.
   - Unique-violation (duplicate short code) returns 409 `duplicate` with the message the admin page shows.
3. **CLI.** In `cli/chronolog.mjs` (keep it dependency-free; split into `cli/lib/*.mjs` modules if the file passes about 600 lines):
   - `client add <name> --code <SHORT> [--emoji X]`, `client edit <ref> [--name] [--code] [--emoji]`, `client archive <ref>`, `client unarchive <ref>`, `client remove <ref>` (asks for confirmation unless `--yes`; prints what was reassigned).
   - `contract add <client> <name> [--description]`, `contract edit <ref> [...]`, `contract archive|unarchive|remove <ref>`.
   - `deliverable add <contract> <name>`, `deliverable edit <ref> --name`, `deliverable remove <ref>`, `deliverables <contract>`.
   - `work-type add <deliverable> <name>`, `work-type edit|remove <ref>`, `work-types <deliverable>`. Check what the UI calls work types in its labels and use that noun as the primary command, with `tag` accepted as an alias either way (the owner calls them tags).
   - `<ref>` resolution follows the existing contract rule: id, or `SHORTCODE`, `SHORTCODE/Contract`, `SHORTCODE/Contract/Deliverable`, `SHORTCODE/Contract/Deliverable/WorkType`; ambiguous or unknown exits 3 with candidates. `--json` everywhere.
4. **Skill.** Add a "Setting up a client" section to `.claude/skills/chronolog-secretary/SKILL.md` (stay under 180 lines): the hierarchy, the order to create things, that short codes are the owner's choice and never invented, that `remove` is confirmed with the owner every time, and that archive is preferred over remove. Update `allowed-tools` if needed. Update the CLI readme and `docs/LAPTOP-SETUP.md` quick reference.
5. **Tests.** Unit tests for every new route (ownership, validation, duplicate, safe deletion through the API); API e2e in `src/e2e/` that builds a client → contract → deliverable → work type through the CLI, logs an entry against the work type, archives and unarchives, then removes the client and checks the entry was reassigned; one Playwright check that an object created by the CLI appears in the admin page and the sidebar without a reload being needed beyond navigation.

## Boundaries

Owns `src/routes/api/**` (except notes, time-entries, timer, tokens, me which only get touched if a shared helper moves), `src/lib/server/db/queries/{clients,contracts,deliverables,work-types,safe-deletion}.ts`, `cli/`, the skill, the two docs. Do not change the admin pages' behaviour; if you move logic out of a form action into a query module, the page must behave identically (its Playwright suite proves it).

## Working rules

- Work only in the worktree. Dev server on port 5209 with `BETTER_AUTH_URL=http://localhost:5209` and `ALLOW_REGISTRATION=true` exported; shared dev Postgres on 127.0.0.1:5432 (name QA users `qa-031-*`; do not reset the database; do not run `db:seed`).
- `npm run check` 0 errors, `npm test` green, `npm run lint` clean, Playwright green, before sign-off. Rebase onto `main` before sign-off.

## Verification

A transcript in `docs/review/screenshots/sprint-031/transcript.md` of the CLI building a client end to end and the admin page screenshot showing it. Sign-off at the bottom of this file with the inventory from task 1, what was done, what was left, and test counts. Do not merge.

## Sign-off

**2026-11-04, implemented on `sprint-031-CL/cli-admin-objects` (not merged), rebased on `main` (`bbd2328`).**

### Task 1: inventory

Every admin form action already called a query module; the logic held inline was the colour default
(computed in `admin/clients/+page.svelte`, and copied in `POST /api/contracts`), the client usage sum
for the delete message (in the `delete` action) and the "entries keep Formerly" message (in the
contract page). Those moved to `suggestClientColorIndex` (`$lib/utils/client-colors.ts`, used by the
page, `nextClientColorIndex` in `clients.ts`, `POST /api/clients` and `POST /api/contracts`),
`getClientUsage` (`safe-deletion.ts`) and `entriesKeptMessage` (`admin-actions.ts`). The pages behave
identically (Playwright and the 65-step checklist driver green).

| Action | Query functions | Validation and message | API |
|---|---|---|---|
| `create` | `createClient` | name + short code required; colour 0-7; unique violation → `duplicateShortCodeMessage` | `POST /api/clients` (409 `duplicate`) |
| `update` (list) / `updateClient` (client page) | `updateClient` | name + short code required; emoji blank → null; colour 0-7; duplicate as above | `PATCH /api/clients/:id` |
| `archive` / `unarchive` | `setClientArchived` | `archiveMessage` | `PATCH /api/clients/:id {archived}` |
| `delete` | `getClientUsage`, `deleteClientWithReassignment` | `deletionMessage` | `DELETE /api/clients/:id` |
| `createContract` | `createContract` (appends to the order) | name required; description trimmed, blank → null | `POST /api/contracts` (kept) |
| `updateContract` (both pages) | `updateContract` | name required | `PATCH /api/contracts/:id` |
| `archiveContract` / `unarchiveContract` | `setContractArchived` | `archiveMessage` | `PATCH /api/contracts/:id {archived}` |
| `deleteContract` | `getContractUsage`, `deleteContractWithReassignment` | `deletionMessage` | `DELETE /api/contracts/:id` |
| contract reorder | `reorderContractsForUser` | every id the user's, once | `PATCH /api/contracts/reorder` (existing) |
| `createDeliverable` / `updateDeliverable` | `createDeliverable` / `updateDeliverable` | name required; sort order defaults to 0 | `POST /api/deliverables`, `PATCH /api/deliverables/:id` |
| `deleteDeliverable` | `deleteDeliverableWithNote` | `entriesKeptMessage` | `DELETE /api/deliverables/:id` |
| `createWorkType` / `updateWorkType` | `createWorkType` / `updateWorkType` | name required; deliverable must be on the contract | `POST /api/work-types`, `PATCH /api/work-types/:id` |
| `deleteWorkType` | `deleteWorkTypeWithNote` | `entriesKeptMessage` | `DELETE /api/work-types/:id` |
| `reorderWorkTypes` | `reorderWorkTypes` | | no bulk route; `PATCH /api/work-types/:id {sortOrder}` |

The same map is in `src/routes/admin/README.md`.

### What was done

- **REST (task 2).** New `GET`/`PATCH`/`DELETE` on `/api/{clients,contracts,deliverables,work-types}/[id]`,
  `POST /api/clients`, `/api/deliverables`, `/api/work-types`. Shared readers and response shapes are in
  `src/routes/api/admin-input.ts`. Ownership comes from new lookups (`getContractForUser`,
  `getDeliverableForUser`, `getWorkTypeForUser`, plus the existing `getClientForUser`) that join up to the
  client's `user_id`, so another user's id gets the same 404 as a missing one. `POST /api/contracts` now
  answers 404, not 403, for a client that is not the caller's, and 409 `duplicate` for an inline new
  client's taken code. Deletes return `{ deleted, reassignedTimeEntryCount, movedNoteCount,
  deletedContractCount, minutesMoved, message }`, or `annotatedTimeEntryCount` for deliverables and work
  types. The single-object `GET`s include `usage`, which the CLI's remove confirmation prints.
  `GET /api/clients` and `/api/contracts-by-client` accept `?includeArchived=true` and carry
  `archived` / `clientArchived`.
- **Archived deliverables and work types.** These have no archive column. They count as archived when
  their contract or client is archived: the lists return `[]` for such a parent unless
  `includeArchived=true`, and each row carries `archived`. So that an old entry on an archived contract
  still shows its deliverable in the timesheet, `FetchDataService.getDeliverables/getWorkTypes` now asks
  with `includeArchived=true`. That is a one-line change outside the boundary, made to keep the UI as it
  was. The lists also now check ownership. The old behaviour (any contract id answered, an unknown
  deliverable gave `200 []`) is gone, and `reference-data.e2e` was updated to expect 404.
- **CLI (task 3).** `cli/commands/manage-clients.mjs` and `manage-structure.mjs` add `client
  add|edit|archive|unarchive|remove`, `contract add|edit|archive|unarchive|remove`, `deliverables`,
  `deliverable add|edit|remove`, `work-types` and `work-type add|edit|remove`. The UI says "Work type",
  so that is the primary noun; `tag` and `tags` are aliases. `cli/lib/object-refs.mjs` resolves `SHORT`,
  `SHORT/Contract`, `…/Deliverable` and `…/WorkType` paths, or an id, one segment at a time with the
  existing never-guess rule, archived objects included. `remove` prints what would move. On a terminal
  it asks `[y/N]`. Without a terminal it refuses with exit 2 unless `--yes`/`-y` is given. Also added:
  `log --work-type` (or `--tag`), `clients --all` and `contracts --all`. Any 404 now exits 3, which used
  to apply to `note_not_found` only. `chronolog.mjs` is 145 lines.
- **Skill (task 4).** "Setting up a client" section covering the hierarchy, top-down order, short codes
  that are the owner's to choose, archive preferred over remove, and remove confirmed every time. The
  failure table has rows for `duplicate` and remove without `--yes`. The skill is 158 lines;
  `allowed-tools` is unchanged. The CLI readme and `docs/LAPTOP-SETUP.md` quick reference are updated.
- **Tests (task 5).** `src/routes/api/admin-objects.test.ts` (13 tests: ownership on every verb,
  validation, 409 duplicate on create and edit, archive and includeArchived, safe deletion of client,
  contract, deliverable and work type with the Formerly lines checked in the database).
  `cli/commands/manage.test.mjs` (11 tests). `suggestClientColorIndex` tests.
  `src/e2e/admin-objects-cli.e2e.test.ts` (5 tests: the CLI builds client → contract → deliverable →
  work type, logs against the work type, gets duplicate exit 5 and unknown path exit 3, archives and
  unarchives, is refused remove without `--yes`, then removes and checks the entry moved to Deleted
  Contract with `Formerly: Rocket Works / Launch site / Phase 1 / Visual design`).
  `e2e-playwright/cli-admin-objects.spec.ts`: the CLI creates the objects, then clicking Settings →
  Clients → client → contract shows them and Back to app shows the contract in the sidebar, with a
  window marker proving there was no reload (chromium and webkit).
- **Verification.** `docs/review/screenshots/sprint-031/transcript.md` plus `01-sidebar.png`,
  `02-admin-clients.png`, `03-admin-client.png` and `04-admin-contract.png`.

### Results

`npm run check` 0 errors (3 existing warnings in `+layout.svelte`). `npm test` 705/705 (66 files). `npm run
lint` clean. API e2e 80/80 (11 files) against `http://localhost:5209`. Playwright 70 passed, 5 skipped
(the existing chromium-only offline skips on webkit). `qa-driver.mjs` 65/65 PASS (its console errors are
the deliberate offline simulations). Users created: `qa-031-*`.

### Outside the listed boundaries (small)

- `src/lib/utils/client-colors.ts` (+ test) and `src/routes/admin/clients/+page.svelte`: the shared
  colour default, one line in the page.
- The two admin `+page.server.ts` files: they import the moved helpers, with the same behaviour.
- `src/lib/server/admin-actions.ts`: `entriesKeptMessage`.
- `src/lib/services/fetch-data-service.ts` (+ test): `includeArchived=true`.
- `src/e2e/reference-data.e2e.test.ts`: 404 for a deliverable that is not the caller's.
- `src/routes/admin/README.md`, `src/e2e/readme.md`, `e2e-playwright/readme.md`.

### Left, and follow-ups

- There is no bulk work-type reorder route. `PATCH /api/work-types/:id {sortOrder}` covers it one item at
  a time, and the CLI has `--order`.
- `POST`/`PATCH /api/time-entries` still do not check that `workTypeId` belongs to the deliverable
  (`entry-input.ts` is outside this sprint's boundary). The CLI only sends work types it resolved under
  the deliverable.
- `chronolog edit` cannot change an entry's work type yet; only `log --work-type` can set one.
- A name containing `/` can only be referenced by id in the path syntax.
- The human output does not show a client's emoji; `--json` does.
