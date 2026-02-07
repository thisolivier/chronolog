# Context7 Library Registry

Libraries tracked for this project. Used by the `context7` skill to look up documentation without re-resolving IDs each time.

## How this file works

- **context7_id**: The Context7-compatible library identifier (resolved via `resolve-library-id`)
- **version**: The version currently used in this project (from package.json, Cargo.toml, etc.)
- **verified**: Date the version was last checked against the project's dependency files
- **status**: `active` (in use), `not-found` (Context7 doesn't have it), `removed` (no longer a dependency)

## Registry

| Library | context7_id | Version | Verified | Status |
|---------|-------------|---------|----------|--------|
| svelte | /svelte/svelte | ^5.49.2 | 2026-02-07 | active |
| @sveltejs/kit | /sveltejs/kit | ^2.50.2 | 2026-02-07 | active |
| @tiptap/core | /ueberdosis/tiptap | ^3.19.0 | 2026-02-07 | active |
| @tiptap/suggestion | /ueberdosis/tiptap | ^3.19.0 | 2026-02-07 | active |
| drizzle-orm | /drizzle-team/drizzle-orm | ^0.45.1 | 2026-02-07 | active |
| better-auth | /better-auth/better-auth | ^1.4.18 | 2026-02-07 | active |
| tailwindcss | /tailwindlabs/tailwindcss | ^4.0.0 | 2026-02-07 | active |
| @tauri-apps/api | /tauri-apps/tauri | ^2.0.0 | 2026-02-07 | active |
| vitest | /vitest-dev/vitest | ^4.0.18 | 2026-02-07 | active |
| tiptap-markdown | /aguingand/tiptap-markdown | ^0.9.0 | 2026-02-07 | active |

## Notes

- `@tiptap/suggestion` shares the same context7_id as `@tiptap/core` (`/ueberdosis/tiptap`) -- use the `topic` parameter to target specific sub-package docs.
- `@tauri-apps/api` maps to `/tauri-apps/tauri` (the main Tauri monorepo).
