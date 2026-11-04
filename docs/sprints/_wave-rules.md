# Parallel wave rules (sprints 039–044, 2026-11-04)

Sprints in a wave run at once from the same `main` (039–042, then 043–044). These rules keep the merges clean.

- **Worktree only** (`.claude/worktrees/<sprint>`), with a `.claude-session.lock` file while working. Do not merge; rebase onto `main` before sign-off.
- **Dev server** on the sprint's port with `BETTER_AUTH_URL=http://localhost:<port>` and `ALLOW_REGISTRATION=true`; shared dev Postgres 127.0.0.1:5432; users `qa-<sprint number>-*`; no reset, no seed. Another sprint may add a migration to the shared DB meanwhile; that is fine.
- **Migrations:** only 039-CL adds one (`0010`). Any other sprint that finds it needs schema changes stops and says so in its sign-off instead.
- **CLI version:** do not bump `package.json`. Add your lines to `cli/CHANGELOG.md` under an `## Unreleased` heading at the top (create it if missing). The merger bumps the version.
- **Skill:** additions to `.claude/skills/chronolog-secretary/SKILL.md` are one short appended paragraph (under 8 lines), or go in a new reference file the skill links to; the skill is over its 200-line guideline already.
- **Shared files:** keep edits to files owned by another sprint (listed in each spec) to one registration line each.
- **Done means:** `npm run check` 0 errors, `npm test`, `npm run lint`, API e2e and the relevant Playwright specs green; the feature proved in the real UI with screenshots in `docs/review/screenshots/sprint-0NN/`; module readmes updated; sign-off section filled in the sprint spec (what was done, what was left, test counts).
- Code style: verbose names, files under ~200 lines where practical, minimal dependencies.
