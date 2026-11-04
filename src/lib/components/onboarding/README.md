# Onboarding components

Small first-run helpers (sprint 029-CL).

- `first-run.ts` — pure rules: a new account holds only the seeded "Internal" (`INTL`) client
  with its "General" contract; `hasNoOwnClients` is true until the person adds another client
  (or renames the starter one).
- `FirstRunNotice.svelte` — a one-line notice mounted by `src/routes/(workspace)/+layout.svelte`
  above the timesheet and the notes list. It reads `/api/clients` through the data service and
  re-checks whenever the sidebar reloads its contracts (`contractDirectory`), so it disappears
  as soon as a client exists. It links to `/admin/clients` (Settings → Clients and contracts).
