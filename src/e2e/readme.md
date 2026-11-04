# E2E Test Harness

End-to-end tests that verify the full API surface against the live Docker stack. These tests exercise every REST API endpoint through authenticated HTTP calls, without requiring a browser or Tauri shell.

## Prerequisites

1. **Docker stack running** (app + Postgres) and healthy:
   ```bash
   docker compose up -d
   ```
2. **Migrations applied**:
   ```bash
   npm run db:migrate
   ```
3. **App server reachable** at `http://127.0.0.1:5173`

## Running

```bash
npm run test:e2e
```

To override the base URL:
```bash
E2E_BASE_URL=http://127.0.0.1:3000 npm run test:e2e
```

Against a sprint worktree's dev server (Vite listens on `localhost`), with the test user named
after the sprint (`E2E_USER_PREFIX`, default `e2e`):
```bash
E2E_USER_PREFIX=qa-029-e2e E2E_BASE_URL=http://localhost:5207 BETTER_AUTH_URL=http://localhost:5207 npm run test:e2e
```

## Architecture

### Setup Flow

1. `setup.ts` (vitest globalSetup) registers a unique test user via Better Auth
2. The first authenticated request triggers `ensureAppUser()`, which seeds an "Internal" client and "General" contract
3. Session cookies are written to a temp file (`.e2e-session.json`)
4. Each test file imports `test-init.ts` which reads the cookies and configures the auth helpers

### Shared Utilities

- **`helpers.ts`** -- base URL config, authenticated fetch wrappers (`authGet`, `authPost`, `authPut`, `authDelete`), test user management
- **`test-init.ts`** -- vitest `beforeAll` hook that restores session cookies for each test file
- **`setup.ts`** -- global setup/teardown (user registration, session file lifecycle)

### Test Files

| File | Endpoints Covered |
|------|------------------|
| `clients.e2e.test.ts` | GET /api/clients, PATCH /api/clients/:id (colour index validation) |
| `contracts.e2e.test.ts` | GET/POST /api/contracts, GET /api/contracts-by-client |
| `notes.e2e.test.ts` | POST/GET/PUT/DELETE /api/notes, backlinks, attachments, time-entries sub-resources |
| `time-entries.e2e.test.ts` | POST/PUT/DELETE /api/time-entries, weekly, weekly-statuses, weeks |
| `timer.e2e.test.ts` | GET/POST timer status, start, stop, save, discard |
| `timer-cli.e2e.test.ts` | Sprint 041-CL: `chronolog timer start --at` (an overlap warns and needs `--yes`), `timer adjust` (future refused, overlap needs `--yes`), `timer`, `timer stop` saving from the adjusted start. Clears its user's entries for yesterday and today first (other files log at fixed times). |
| `reference-data.e2e.test.ts` | GET /api/deliverables, GET /api/work-types (a deliverable that is not the caller's is 404) |
| `search.e2e.test.ts` | GET /api/notes/search |
| `search-cli.e2e.test.ts` | Sprint 042-CL: `chronolog search` (grouped notes and entries, marked snippets, `--json`, a trashed note drops out, short query exit 2) over GET /api/search |
| `attachments-offline.e2e.test.ts` | Attachment upload, metadata listing, download and delete |
| `api-tokens-cli.e2e.test.ts` | /api/tokens, bearer auth, /api/me, error shape, GET /api/time-entries range, the `chronolog` CLI as a child process, revoked token 403 |
| `admin-objects-cli.e2e.test.ts` | Sprint 031-CL: the CLI builds client → contract → deliverable → work type, logs against the work type, archives and unarchives, refuses `remove` without `--yes`, then removes the client and checks the entry was reassigned |
| `note-changes-cli.e2e.test.ts` | Sprint 034-CL: CLI `note new` → `append` → `show` → browser `PUT` → stale `note edit` exits 7 → fresh edit → `note delete --yes` (server trash since 037, no local copy) → `note restore` with the same ID; `note new --date yesterday` and 400 `invalid_date` |
| `entry-references-cli.e2e.test.ts` | Sprint 032-CL: `chronolog edit --work-type` under the entry's deliverable succeeds, one from another deliverable exits 3 with candidates (also `log`), `--deliverable none` clears both; the API answers 400 `work_type_mismatch` to a stale pair |
| `import-cli.e2e.test.ts` | Sprint 038-CL: `chronolog import` from `fixtures/` (placeholders filled at run time): a dry run sends nothing, 30 notes (12 backdated, one append by id) and 60 entries (a JSON array) are imported and shown by `week`, a file with an unknown reference exits 3 with nothing sent, `undo --last-import --yes` deletes the entries |
| `todos-cli.e2e.test.ts` | Sprint 040-CL: a CLI note with `- [ ]` items (nested, one in a code block) keeps them through `note show` and `note append`; `GET /api/notes/todos` lists open items (all=1 adds done; code and trashed notes never count; 400 on a bad contract id, 401 without a session); `chronolog todos` prints one line per item grouped by note, `--all`, across contracts, `--json` |
| `note-previews.e2e.test.ts` | Sprint 043-CL: `GET /api/notes` reads wiki-links as the target's title (or label, or the ID when unknown) in `displayTitle` and previews and attachment links as their filename; `GET /api/notes/titles` names markdown-only notes; the trash list titles a trashed note with its link text |
| `note-trash-cli.e2e.test.ts` | Sprint 037-CL: CLI `note new` stores a word count; B links to A and an entry links to A; `note delete` hides A from the note, list, search and titles while `titles?includeDeleted=1` marks it deleted; `note restore` lists it; restore keeps the ID, the backlink and the entry link; a second restore exits 3 |
| `pins-client-order-cli.e2e.test.ts` | Sprint 039-CL: `note pin` puts an older note first in `notes` with 📌 and keeps its `updatedAt`, `note unpin` puts it back; an unknown or trashed note exits 3; `GET /api/notes?clientId=` lists both contracts of a client, pinned first; `client edit --order 1` / `--order 999` move the client to the top and bottom of `/api/clients` |
| `api-hardening-cli.e2e.test.ts` | Malformed JSON bodies are 400 `invalid_json`, eight parallel note creates, note ID date in `X-Timezone`, `chronolog edit` and `chronolog undo` |

## Configuration

- **Vitest config**: `vitest.config.e2e.ts` (separate from the unit test config in `vite.config.ts`)
- **File parallelism disabled**: test files run sequentially to avoid note ID collisions
- **Test timeout**: 30 seconds per test
- **IPv4 required**: uses `127.0.0.1` instead of `localhost` due to Docker IPv6 routing issues

## Isolation from Unit Tests

- E2E tests use the `.e2e.test.ts` suffix
- Unit tests (`npm run test`) exclude `src/e2e/**` via the `exclude` option in `vite.config.ts`
- E2E tests use their own vitest config (`vitest.config.e2e.ts`) with a dedicated globalSetup
