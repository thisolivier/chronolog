# Sprint 005 — QA: CLI Test Harness + E2E Verification

**Status:** signed-off
**Type:** QA gate
**Backlog items:** QA (Director-dispatched)
**Depends on:** Sprint 004-CL (PowerSyncDataService — merged)
**Branch:** `sprint-005-QA/cli-test-harness`
**Working tree:** `/Users/olivier/sites/chronolog/.claude/worktrees/sprint-005-QA`

## Objectives

Build a CLI test harness that verifies the full API surface end-to-end against the live Docker
stack. This covers everything except browser/Tauri UI interaction. The harness must:

1. Authenticate via Better Auth (register + sign in)
2. Exercise every REST API endpoint through authenticated HTTP calls
3. Verify PowerSync infrastructure (JWKS, token, replication status)
4. Verify data written through the API appears in Postgres
5. Run as a single `npm run test:e2e` command

After this sprint, we have confidence that the server-side business logic and API layer work
correctly with real Postgres + PowerSync, without needing manual UI testing.

## Tasks

### 1. Create the e2e test infrastructure

Create `src/e2e/` directory with:
- `helpers.ts` — shared utilities: base URL config, authenticated fetch wrapper, test user management
- `setup.ts` — vitest globalSetup that registers a test user via Better Auth's API and exports the session cookie

The test user flow:
1. POST to `/api/auth/sign-up/email` with `{ name, email, password }` to register
2. The response sets a `better-auth.session_token` cookie
3. All subsequent requests include this cookie

**Base URL**: Read from `E2E_BASE_URL` env var, default `http://127.0.0.1:5173` (use IPv4 — IPv6 has Docker routing issues on this machine).

**Important**: Use `127.0.0.1` not `localhost` for all HTTP calls — the Docker container's Vite
dev server doesn't respond correctly to IPv6 connections from the host.

### 2. Test PowerSync infrastructure endpoints

File: `src/e2e/powersync-infra.e2e.test.ts`

Tests:
- `GET /api/powersync/jwks` returns valid JWKS with RSA key (no auth required)
- `POST /api/powersync/token` returns JWT with expected claims (requires auth)
- Verify the JWT can be decoded and has `sub`, `aud`, `exp` claims
- Verify PowerSync service is healthy: `GET http://localhost:8080/probes/liveness`

### 3. Test client CRUD

File: `src/e2e/clients.e2e.test.ts`

Tests:
- `GET /api/clients` returns the seeded "Internal" client (auto-created on first login)
- Verify client has expected shape: `{ id, name, shortCode, emoji, ... }`

### 4. Test contracts CRUD

File: `src/e2e/contracts.e2e.test.ts`

Tests:
- `GET /api/contracts` returns the seeded "General" contract
- `GET /api/contracts-by-client` returns contracts grouped by client
- `POST /api/contracts` creates a new contract (need a clientId from the seeded client)
- Verify the new contract appears in subsequent GET

### 5. Test notes CRUD

File: `src/e2e/notes.e2e.test.ts`

Tests:
- `POST /api/notes` creates a note (needs contractId)
- `GET /api/notes?contractId=X` lists notes for that contract
- `GET /api/notes/:id` fetches a single note
- `PUT /api/notes/:id` updates title/content
- `GET /api/notes/:id/backlinks` returns backlinks (empty for new note)
- `GET /api/notes/:id/attachments` returns attachments (empty)
- `GET /api/notes/:id/time-entries` returns linked time entries (empty)
- `DELETE /api/notes/:id` deletes the note
- Verify deleted note is gone from the list

### 6. Test time entries CRUD

File: `src/e2e/time-entries.e2e.test.ts`

Tests:
- `POST /api/time-entries` creates a time entry (needs contractId, date, duration)
- `GET /api/time-entries/weekly?weeks=YYYY-MM-DD` returns the entry in weekly format
- `PUT /api/time-entries/:id` updates the entry
- `DELETE /api/time-entries/:id` deletes the entry
- `POST /api/time-entries/weekly-statuses` sets a week's status
- `GET /api/weeks?count=4` returns week summaries

### 7. Test timer endpoints

File: `src/e2e/timer.e2e.test.ts`

Tests:
- `GET /api/timer/status` returns current timer state
- `POST /api/timer/start` starts a timer (needs contractId)
- `GET /api/timer/status` shows running timer
- `POST /api/timer/stop` stops the timer
- `POST /api/timer/save` saves the stopped entry
- Or: `POST /api/timer/discard` discards it

### 8. Test deliverables and work types

File: `src/e2e/reference-data.e2e.test.ts`

Tests:
- `GET /api/deliverables?contractId=X` returns deliverables (may be empty for new contract)
- `GET /api/work-types?deliverableId=X` returns work types (may be empty)

### 9. Test note search

File: `src/e2e/search.e2e.test.ts`

Tests:
- Create a note with specific content, then `GET /api/notes/search?q=keyword` should find it

### 10. Add npm script and documentation

- Add `"test:e2e": "E2E_BASE_URL=http://127.0.0.1:5173 vitest run --dir src/e2e"` to package.json
- Create `src/e2e/readme.md` documenting: prerequisites (Docker stack running), how to run, what it tests

### 11. Run the full harness and verify

- Ensure Docker stack is running (`docker compose up -d`)
- Ensure migrations are applied (`npm run db:migrate`)
- Run `npm run test:e2e` — all tests should pass
- Run `npm run test` — existing unit tests still pass (e2e tests excluded from unit test run)
- Run `npm run check` — no new TypeScript errors

## Contracts

- API routes: `src/routes/api/` (25 endpoint files)
- DataService interface: `docs/contracts/data-service-interface.md`
- Docker stack: `docs/contracts/docker-stack.md`
- FetchDataService: `src/lib/services/fetch-data-service.ts` (reference for all API URL patterns)

## Verification

- `npm run test:e2e` passes with Docker stack running
- `npm run test` passes (unit tests unaffected)
- `npm run check` passes (no new errors)
- Harness covers all REST API endpoints used by FetchDataService

## Acceptance Criteria

- [x] E2e test infrastructure with authenticated HTTP client
- [x] PowerSync infrastructure tests (JWKS, token, liveness)
- [x] Client, contract, note, time entry CRUD tests
- [x] Timer endpoint tests
- [x] Search endpoint test
- [x] `npm run test:e2e` script works
- [x] All e2e tests pass against live Docker stack
- [x] Existing unit tests unaffected
- [x] `npm run check` passes (0 new errors; 3 pre-existing errors in hooks.server.ts and jose types)
- [x] `src/e2e/readme.md` documents the harness

## Notes

**Docker stack is already running.** All 4 services are healthy. Migrations are applied.

**IPv4 is required for host→container HTTP.** Use `127.0.0.1` not `localhost` — the Docker
container's Vite dev server doesn't respond to IPv6 `::1` connections from the host. We
discovered this during pre-sprint verification.

**Better Auth signup API:**
```
POST /api/auth/sign-up/email
Content-Type: application/json
{ "name": "Test User", "email": "test@example.com", "password": "testpassword123" }
```
The response sets session cookies. Extract and forward them on subsequent requests.

**Better Auth signin API:**
```
POST /api/auth/sign-in/email
Content-Type: application/json
{ "email": "test@example.com", "password": "testpassword123" }
```

**Vitest config**: The main vitest config at `vite.config.ts` includes `src/**/*.test.ts`.
The e2e tests should use `.e2e.test.ts` suffix. Either:
- Add a separate vitest config for e2e tests, or
- Use `--dir src/e2e` to run only e2e tests

**The hooks.server.ts auth flow**: On first authenticated request, `ensureAppUser()` auto-creates
a user record + seeded "Internal" client + "General" contract. So after signup, the test user
immediately has data to work with.

**PowerSync liveness**: `http://localhost:8080/probes/liveness` — the PowerSync service image
lacks curl, but the harness calls from the host so standard fetch works.

**Existing test patterns**: The project uses vitest with `fake-indexeddb` for mocking. E2e tests
don't need IndexedDB mocks — they're pure HTTP against the live server.

---

### Sign-off Notes (2026-05-26)

**Verification results:**
- `npm run test:e2e`: 8 files, 32 tests, all passed (~1.3s)
- `npm run test`: 15 files, 257 tests, all passed (e2e excluded)
- `npm run check`: 3 pre-existing errors (hooks.server.ts type issue, jose KeyLike export), 0 new errors

**Key implementation decisions:**
- **File-based session sharing**: globalSetup writes cookies to `.e2e-session.json`, test-init reads them. Env var approach doesn't work because vitest globalSetup runs in main process, not test workers.
- **Sequential file execution**: `fileParallelism: false` prevents note ID collisions (IDs are `CLIENT.YYYYMMDD.SEQ`).
- **Origin header for Better Auth**: Auth endpoints require `Origin: http://localhost:5173` (matching `BETTER_AUTH_URL`), even though actual HTTP goes to `127.0.0.1`.
- **Separate vitest config**: `vitest.config.e2e.ts` keeps e2e isolated. Unit test config in `vite.config.ts` excludes `src/e2e/**`.
- **PowerSync liveness**: The journeyapps/powersync-service image doesn't expose `/probes/liveness`. Test verifies service is reachable via `/api/` endpoint instead.

**Files created/modified in working tree:**
- `src/e2e/helpers.ts` — authenticated fetch wrappers, base URL config
- `src/e2e/setup.ts` — vitest globalSetup (user registration, session file)
- `src/e2e/test-init.ts` — per-file session cookie restoration
- `src/e2e/powersync-infra.e2e.test.ts` — JWKS, token, liveness (3 tests)
- `src/e2e/clients.e2e.test.ts` — client listing (1 test)
- `src/e2e/contracts.e2e.test.ts` — contract CRUD (3 tests)
- `src/e2e/notes.e2e.test.ts` — note CRUD + sub-resources (9 tests)
- `src/e2e/time-entries.e2e.test.ts` — time entry CRUD + weekly (6 tests)
- `src/e2e/timer.e2e.test.ts` — timer lifecycle (6 tests)
- `src/e2e/reference-data.e2e.test.ts` — deliverables, work types (2 tests)
- `src/e2e/search.e2e.test.ts` — note search (2 tests)
- `src/e2e/readme.md` — documentation
- `vitest.config.e2e.ts` — e2e vitest configuration
- `vite.config.ts` — added `src/e2e/**` to unit test exclude
- `package.json` — added `test:e2e` script
- `.gitignore` — added `.e2e-session.json`
