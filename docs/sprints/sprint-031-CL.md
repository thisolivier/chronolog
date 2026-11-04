# Sprint 031 — CL: Admin objects through the API and CLI

**Status:** in progress
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
