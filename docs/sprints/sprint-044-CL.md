# Sprint 044 — CL: Platform follow-ups (auth test, version drift, desktop, admin)

**Status:** ready for review
**Branch:** `sprint-044-CL/platform-followups` · **Worktree:** `.claude/worktrees/sprint-044-CL` · **Port:** 5222
**Sources:** "Carried-over follow-ups" in `docs/backlog.md` (API/CLI, Infrastructure, Admin/shell, Navigation). Runs in parallel with 043-CL; wave rules in `docs/sprints/_wave-rules.md` apply (no migration in this sprint).

**Owns:** auth/login, `/api/me`, `cli/`, `src-tauri/`, admin colour picking, the root layout navigation context, the secretary skill. Do not touch notes components or the editor (043).

## Tasks

1. **2FA login test.** A Playwright test that registers a `qa-044-*` user, enables TOTP, signs out, signs in with a generated code (HMAC-SHA1 TOTP computed in the test with `node:crypto`, no new dependency), and lands in the app. The 2FA login path was broken from sprint 003 to 2026-11-04 unnoticed.
2. **Version drift notice.** The server reports its build commit (baked into the image at build time; `dev` locally) and version on `/api/me`; the CLI prints one line on stderr ("server is at <commit>, this CLI at <commit>: run git pull") when they differ, at most once a day (cache in the CLI config dir), never in `--json` output on stdout.
3. **Desktop bundle version.** `src-tauri/tauri.conf.json` takes its version from `package.json` (Tauri supports a path to package.json; check with context7). Signing out clears the menu-bar timer title. Do not rebuild or reinstall the desktop app; say what the owner must run.
4. **Distinct client colours.** A new client gets the first palette colour not already used by the user's active clients; Settings shows a hint when two active clients share one. No change to existing clients' colours.
5. **Navigation context.** The root layout creates the navigation context so a client-side move from an unauthenticated page into `/` no longer throws "Navigation context not found"; remove the `/login` workaround if it becomes dead code.
6. **`undo --last-import` covers notes**: imported notes go to the trash (037) on undo, with the same confirmation; entries as today.
7. **Housekeeping.** Fix the 12 `svelte-check` warnings where the fix is safe; split the secretary skill (`.claude/skills/chronolog-secretary/SKILL.md`, over 200 lines) into SKILL.md plus a reference file, without changing what it tells the laptop Claude to do; update the checklist driver README to the post-033 sidebar; delete the leftover `qa-029-*`/`qa-030-*` dev users and their data (dev DB only).
8. **Test hygiene.** Two WebKit Playwright tests are flaky (passed on retry after the 039–042 merge): `sidebar-client-view.spec.ts` "reorder clients by dragging" and `navigation-journeys.spec.ts` J2. Make them deterministic (wait on state, not time). Full Playwright runs also overwrite every sprint's committed screenshots in `docs/review/screenshots/`; write them only when an env var such as `UPDATE_SPRINT_SCREENSHOTS=1` is set (else to `test-results/`).
9. **Tests.** Unit for the drift check and colour picking; the Playwright 2FA test; API e2e for undo of an imported note batch.

## Verification

Transcript of the drift notice; the 2FA test passing on chromium and webkit. Sign-off as per the wave rules, plus the exact commands the owner must run for the desktop app.

## Sign-off

**2026-11-04, implemented on `sprint-044-CL/platform-followups`, rebased onto `main` (`6e9fc2c`, after 043 and 046 merged). Status: ready for review, not merged.** Dev server on port 5222; QA users `qa-044-*`. No migration, no `package.json` bump (CLI lines under `## Unreleased`).

### What was done

1. **2FA login test.** `e2e-playwright/two-factor-login.spec.ts` (chromium and webkit, own browser context): registers a `qa-044-pw-2fa-*` user, enables TOTP in Settings with a code computed from the `secret` of the otpauth URI (RFC 6238 HMAC-SHA1 with `node:crypto`; the helper is checked against the RFC test vector), signs out from Settings, signs in with the password, sees the code prompt, a wrong code is refused, a code from a later 30 s window (never the enrolment code) lands in `/` and `/api/me` is that user. It also asserts no "Navigation context" page error on the way (task 5).
2. **Version drift notice.** `GET /api/me` adds `serverCommit`: `CHRONOLOG_BUILD_COMMIT` read at runtime, `dev` when unset (`api/me/server-version.ts`). The production image bakes it: `Dockerfile` `ARG BUILD_COMMIT=dev` → `ENV CHRONOLOG_BUILD_COMMIT`, `docker-compose.prod.yml` passes `build.args.BUILD_COMMIT`, and `scripts/deploy-prod.sh` exports `BUILD_COMMIT=$(git rev-parse HEAD)` (warns on uncommitted changes); `.git` stays out of the build context. CLI: `cli/lib/version-drift.mjs`, run after every successful command; at most once a day (`version-check.json` beside the config; the `/api/me` call is made only when a check is due) it compares the server's commit with `git rev-parse HEAD` of the CLI's checkout and, when both are known and differ (short vs full hashes compare by prefix), writes one line to **stderr**. Never stdout, never a failed command, silent against a `dev` server or outside git; `CHRONOLOG_NO_VERSION_CHECK=1` turns it off. `chronolog me` shows both commits. Documented in `docs/DEPLOYMENT.md`, `cli/readme.md`, `cli/CHANGELOG.md`, and one paragraph in the skill.
3. **Desktop.** `src-tauri/tauri.conf.json` already had `"version": "../package.json"` since 035 (context7 confirms Tauri 2 resolves it relative to `src-tauri/`); the installed app says 0.0.1 because `package.json` was 0.0.1 when it was built. A rebuild bundles 1.2.0; no config change was needed, docs say so (`src-tauri/README.md`, `docs/DESKTOP.md`, the dmg name is no longer hard-coded). **Sign-out clears the menu-bar title:** `clearDesktopTimer()` in `src/lib/desktop/bridge.ts` invokes `set_timer_state` with a stopped state; Settings → Sign out calls it first and the login page calls it on load (covers an expired session or a sign-out in another window). This is page code, so it reaches the desktop app with the next production deploy, no rebuild.
4. **Distinct client colours.** `suggestClientColorIndex` now counts **active** clients only (archived ones free their colour) and, with all eight taken, picks the least used colour (was: client count wrapped). `nextClientColorIndex` (API and inline create) uses active clients; the admin `create` action falls back to it when no colour is posted. Settings → Clients shows an amber hint listing active clients that share a colour (`findSharedClientColors`), with "Pick another colour with Edit on one of them". Existing colours are never changed.
5. **Navigation context.** The root layout now always creates the navigation, timer and data-service contexts (the workspace code preload still waits for a user). The `/login` workaround is gone: `+page.server.ts` redirects any signed-in request (document or client-side) with a 303 to `/`, the page no longer reloads itself, and register does `goto('/login', { invalidateAll: true })` so the root layout's data carries the new user. Also fixes the 3 `svelte-check` warnings in `+layout.svelte` (`data` captured once).
6. **`undo --last-import` covers notes.** `import notes` records the notes it **created** (updates/appends to existing notes are not undone) in `last-import.json` (`{ kind, entryIds, noteIds, ... }`; a pre-044 record still reads). `undo --last-import` (now `cli/commands/undo-import.mjs`) asks once ("created 29 notes. Move them all to the trash?", `--yes` without a terminal) and `DELETE`s each note, i.e. moves it to the 037 trash; JSON `{ trashed, alreadyGone, noteIds, file }`. Entries as before. The last import of either kind is the one undone.
7. **Housekeeping.** `svelte-check`: 0 errors, 0 warnings (only 3 were left at sprint start, all in `+layout.svelte`, fixed by task 5; the 12 counted earlier had been fixed by later sprints). **Secretary skill split:** `SKILL.md` 237 → 167 lines (intro, never guess, logging, correcting, writing and changing notes, failure table, drift paragraph, task lists, pinning) plus `reference.md` (93 lines: filing a document, week summaries, setting up a client, importing history, timer, search). `SKILL.md` has an explicit "read reference.md first" list for those tasks. Every original line is in one of the two files (checked line by line); the only wording change is the import-undo step, which now says notes are trashed. The laptop symlinks the whole skill directory (`docs/LAPTOP-SETUP.md`), so `reference.md` arrives with `git pull`. **Checklist driver README** describes the 033/039 sidebar (single-contract rows, Archived section, manual order); the driver's note-id check now accepts 4-digit sequences (the dev DB reached `INTL.20261104.1493` today, which broke 15 note steps); driver run: **65 pass / 0 fail**. **Dev users:** dump `~/Backups/chronolog/pre-session/dev-sprint044-20261104T190730Z.dump`, then deleted the 117 `qa-029-*` / `qa-030-*` users from `users` and `user` in one transaction (cascade: 226 clients, 196 notes, 264 time entries, their contracts, links, attachments, sessions, tokens). No orphans left.
8. **Test hygiene.** Root cause of both WebKit flakes: shared state, not timing alone. Every spec shares one user and chromium and webkit run at once, so the two reorder tests overwrote each other's full client order, and the other browser's J2 seeded cards on the same day, shifting the list between saving and restoring its scroll. Both also reloaded while a save was in flight. Fixes: `e2e-playwright/fresh-user.ts` (`signInAsFreshUser`) gives the two reorder tests and J2 their own user; reloads wait for the server state (`GET /api/clients` order, the stored scroll in sessionStorage, `isPinned` for the pin test, which showed the same in-flight reload in one run); the drag is dispatched as DOM drag events sharing one `DataTransfer` (Playwright's native drag in WebKit sometimes never fired `drop`); J2's fixed `waitForTimeout`s became "scroll steady for 5 frames" waits, the week path is read only after the URL moves, and the in-editor wiki-link click is retried until the URL follows. **Screenshots:** `e2e-playwright/sprint-screenshots.ts`; every spec that wrote into `docs/review/screenshots/` (034, 036, 037, 039, 040, 041, 042, 043, 046, 044) now writes to `test-results/sprint-screenshots/` unless `UPDATE_SPRINT_SCREENSHOTS=1`. A full run leaves `git status` clean.
9. **Tests.** Unit: `cli/lib/version-drift.test.mjs` (9), `cli/commands/undo-import.test.mjs` (4), colour picking and shared colours in `client-colors.test.ts` (+3), `bridge.test.ts` (+2), login load (redirect on data requests). Playwright: `two-factor-login.spec.ts` (2), `client-colours.spec.ts` (1). API e2e: undo of an imported note batch (`import-cli.e2e.test.ts`), default colour and freeing it by archiving (`clients.e2e.test.ts`), `me` with commits (`attachments-cli.e2e.test.ts`).

### Verification

`npm run check` 0 errors 0 warnings, `npm run lint` clean, `npm test` **1017 passed in 105 files**, API e2e against `http://localhost:5222` (`E2E_USER_PREFIX=qa-044-e2e`) **126 passed in 21 files**, Playwright full suite chromium + webkit with `--retries=0` **148 passed, 5 skipped** (the chromium-only offline tests under webkit), screenshots of other sprints untouched. Formerly flaky tests with `--repeat-each=10 --retries=0` before the rebase (60/60) and `--repeat-each=5` after it, with the pin test added (41/41, incl. auth setup). 2FA test green in chromium and webkit. Checklist driver 65/65.

Drift notice transcript (dev server started with `CHRONOLOG_BUILD_COMMIT` set to an older commit, a `qa-044-drift-*` user, a scratch config):

```
$ chronolog clients
INTL     Internal  id=c5adab5a-a256-4ebc-9df5-16b717f4fba4
chronolog: server is at bbca947, this CLI at dc98a78: run git pull
$ chronolog clients        # same day: no second notice
INTL     Internal  id=c5adab5a-a256-4ebc-9df5-16b717f4fba4
$ chronolog clients --json 2>/dev/null     # stdout is pure JSON
[ { "id": "c5adab5a-…", … } ]
$ chronolog me
QA 044 drift <qa-044-drift-mw2hrv2h@chronolog.test> via token
Today 2026-11-04 (America/Los_Angeles), week 2026-W45: 2026-11-02 to 2026-11-08
Server 1.2.0 (bbca947) at http://localhost:5222, CLI 1.2.0 (dc98a78)
```

Screenshots in `docs/review/screenshots/sprint-044/`: `01-two-factor-code-prompt.png`, `02-signed-in-after-2fa.png`, `03-shared-colour-hint.png`.

### Owner: desktop app and deploy

The sign-out fix needs only a production deploy. The bundle version needs a rebuild on a Mac, from a checkout with this sprint merged:

```bash
cd ~/sites/chronolog && git pull && npm install
CI=true npm run tauri:build        # or `npm run tauri:build` from Terminal on the laptop
# Mac mini build, copy to the laptop:
scp 'olivier@100.110.206.54:sites/chronolog/src-tauri/target/release/bundle/dmg/Chronolog_*_aarch64.dmg' ~/Downloads/
# Quit Chronolog (Cmd+Q), open ~/Downloads/Chronolog_1.2.0_aarch64.dmg, drag Chronolog over the old one
plutil -p /Applications/Chronolog.app/Contents/Info.plist | grep ShortVersion   # "1.2.0"
```

Production, so `/api/me` reports the commit: `cd ~/sites/chronolog-prod && scripts/backup-postgres.sh && git pull --ff-only && scripts/deploy-prod.sh` (the script passes `BUILD_COMMIT`). Laptops: `git pull` in the Chronolog checkout (CLI and skill, including the new `reference.md`).

### Left, and notes

- The drift notice says "run git pull" whenever the commits differ, including when the laptop is ahead of the server (a local commit, or production not yet deployed). Telling those apart needs the server's commit in the laptop's history; left as is, per the spec wording.
- `undo --last-import` undoes only the most recent import: importing entries after notes replaces the notes record (as one entries import always replaced the previous one).
- `Cargo.toml` still says `version = "0.0.1"`; Tauri uses `tauri.conf.json`'s version for the bundle, so only the crate metadata says 0.0.1.
- Root layout `data.user` stays stale after a client-side move only if a page navigates into the app without `invalidateAll`; nothing in the workspace reads it (register now invalidates).
- Merge notes vs 043/046 (already on `main`, rebase was clean except `e2e-playwright/readme.md`): this branch edits `notes-followups.spec.ts` and `search-results-layout.spec.ts` (screenshot directory only, two lines each), `search.spec.ts`, `src/lib/utils/README.md`. `cli/CHANGELOG.md` has a new `## Unreleased` section for the merger's version bump.
- QA users `qa-044-*` and their data remain in the shared dev database.
