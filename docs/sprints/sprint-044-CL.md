# Sprint 044 — CL: Platform follow-ups (auth test, version drift, desktop, admin)

**Status:** planned (starts after 039–042 merge)
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
8. **Tests.** Unit for the drift check and colour picking; the Playwright 2FA test; API e2e for undo of an imported note batch.

## Verification

Transcript of the drift notice; the 2FA test passing on chromium and webkit. Sign-off as per the wave rules, plus the exact commands the owner must run for the desktop app.

## Sign-off

(pending)
