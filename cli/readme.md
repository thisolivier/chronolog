# Chronolog CLI

Command-line client for the Chronolog REST API. The laptop Claude secretary uses it to read and write time entries and notes for one signed-in user, and (sprint 031-CL) to set up clients, contracts, deliverables and work types. It authenticates with a personal API token (see `src/lib/server/auth-tokens/README.md`).

Node 20+, no dependencies. It talks only to `/api/*`; the only local state is the config file and `last-entry.json` beside it (the entry `undo` would delete).

## Install

From a checkout of the repo:

```bash
npm install -g .          # installs the `chronolog` command
node cli/chronolog.mjs me # run without installing
npx chronolog me          # inside the repo
```

`package.json` maps the `chronolog` bin to `cli/chronolog.mjs`. First-time setup is in `docs/ONBOARDING.md` ("New laptop CLI").

## Configuration

The config file is `~/.config/chronolog/config.json` (under `$XDG_CONFIG_HOME` when set). `$CHRONOLOG_CONFIG` overrides the whole path, and `chronolog init --config <path>` writes there. `init` creates it with mode 600 and never prints it. Keys: `baseUrl`, `apiToken`, `deviceKey`.

Environment variables win over the file:

| Variable | Purpose |
|----------|---------|
| `CHRONOLOG_BASE_URL` | Server origin (default `https://chronolog.throb.online`) |
| `CHRONOLOG_API_TOKEN` | Personal API token, `clg_…` |
| `CHRONOLOG_DEVICE_KEY` | Device access key, sent as `X-Device-Key` when set |
| `CHRONOLOG_CONFIG` | Path to the config file |
| `XDG_CONFIG_HOME` | Base directory for the default config path |

## Commands

- `init`: save server URL, API token and device key (checks `GET /api/me`)
- `me`: who you are, today, current ISO week
- `clients [--all]`, `contracts [client] [--all]`: reference lists (`--all` adds archived ones, marked `[archived]`)
- `week [2026-W45] [--client X | --contract X]`: entries and totals
- `log <contract> <duration> "<desc>" [--date D] [--deliverable X [--work-type Y]] [--note ID]`
- `note new <contract> "<title>" [--file body.md]` (body from `--file` or stdin), `note show <note-id>`
- `notes <contract> [--since YYYY-MM-DD]`, `search "<words or note id>" [--limit N]`
- `status <2026-W45|current> <unsubmitted|draft-ready|submitted>`
- `edit <entry-id> [--duration D] [--description "..."] [--date D] [--deliverable X|none] [--work-type X|none]`: change one entry (`PATCH /api/time-entries/<id>`); only the flags given change. A plain duration clears an old start/end range; a range sets a new one. A work type is resolved under the new deliverable if given, else the entry's current one (`--tag` works too). `--deliverable none` clears both; a new deliverable without `--work-type` clears the old deliverable's work type.
- `undo`: delete the last entry this CLI logged. `log` records it in `last-entry.json` next to the config file; `undo` deletes it once and forgets it. It refuses (exit 2) when nothing is recorded or the record is for another server. Entries made in the app or edited are not undoable this way.

### Setting up clients (sprint 031-CL)

These call the same `/api/*` routes, and so the same rules, as Settings → Clients and contracts.

- `client add "<name>" --code SHORT [--emoji X] [--color 0-7]`: the colour defaults to the first one no client uses
- `client edit <client> [--name] [--code] [--emoji X|none] [--color]`, `client archive|unarchive <client>`
- `client remove <client>`: entries and notes of all its contracts move to Deleted Client / Deleted Contract (each entry keeps a "Formerly:" line), then it is deleted
- `contract add <client> "<name>" [--description D] [--inactive]`, `contract edit <contract> [--name] [--description D|none] [--active|--inactive]`, `contract archive|unarchive|remove <contract>`
- `deliverables <contract> [--all]`, `deliverable add <contract> "<name>" [--order N]`, `deliverable edit <ref> [--name] [--order N]`, `deliverable remove <ref>`
- `work-types <deliverable> [--all]`, `work-type add <deliverable> "<name>" [--order N]`, `work-type edit <ref> [--name] [--order N]`, `work-type remove <ref>`. The app calls them work types; `tag` / `tags` work as aliases.

`remove` shows what it would move and asks `[y/N]` on a terminal. Without a terminal (Claude, scripts) it refuses with exit 2 unless `--yes` (`-y`) is given, so the caller must get the owner's yes first. Archive is the safer choice: it hides the object and keeps everything.

A short code already in use is 409 `duplicate` (exit 5) with the same message the admin page shows.

Add `--json` for machine-readable stdout. Errors then go to stderr as `{"error","code","status","candidates"}`.

### Deliverable and work type must match (sprint 032-CL)

The server refuses an entry whose deliverable is not on its contract (400 `deliverable_mismatch`) or whose work type is not under its deliverable (400 `work_type_mismatch`), with a message naming both, e.g. `Work type "Interviews" belongs to deliverable "Discovery", not "Recommendations"`. `log` and `edit` only look for a work type under the entry's deliverable (`lib/entry-references.mjs`), so a work type from elsewhere exits 3 with that deliverable's work types as candidates before anything is sent; a 400 that still comes back prints the server's message (exit 1).

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | OK |
| 1 | Other error (server, network, bad config) |
| 2 | Usage error |
| 3 | Unknown or ambiguous reference, or any 404 (note, entry, object not found): ask the person |
| 4 | Auth failure (401/403): token or device key |
| 5 | Conflict (409), including a duplicate short code |
| 6 | Rate limited (429) |

## References are never guessed

A contract, client or deliverable name (`acme retainer`, `ACME/Website`) or a UUID is resolved in `lib/resolve.mjs`. An exact name or code match wins. Otherwise every word must appear in the text of exactly one item. Any other outcome, no match or several matches, exits 3 and lists the candidates with their ids. The caller must ask the person which one is meant.

The admin commands take a path: `SHORTCODE` (client), `SHORTCODE/Contract`, `SHORTCODE/Contract/Deliverable`, `SHORTCODE/Contract/Deliverable/WorkType`, or an id. `lib/object-refs.mjs` resolves it one segment at a time with the same rule, archived objects included (so they can be restored). A name containing `/` can only be reached by id.

## Module layout

```
cli/chronolog.mjs         entry: argv to command, exit codes, --json output
cli/lib/args.mjs          argv parser (positionals, --flag value, switches), two-word commands and tag alias
cli/lib/config.mjs        config path, environment overrides, mode 600 writes
cli/lib/api.mjs           HTTP client: bearer token, device key, X-Timezone, ApiError
cli/lib/resolve.mjs       reference matching for contracts, clients, deliverables, work types; path splitting
cli/lib/object-refs.mjs   fetch + resolve one client/contract/deliverable/work type from an id or path
cli/lib/entry-references.mjs  an entry's deliverable and work type (work type only under that deliverable)
cli/lib/confirm.mjs       remove confirmation: --yes, [y/N] on a terminal, refuse otherwise
cli/lib/dates.mjs         ISO weeks, --date words, duration formatting
cli/lib/history.mjs       last-entry.json: the entry `undo` deletes
cli/commands/read.mjs     me, clients, contracts, week, notes, note show, search
cli/commands/write.mjs    log, note new, status
cli/commands/correct.mjs  edit, undo
cli/commands/manage-clients.mjs    client and contract add/edit/archive/unarchive/remove
cli/commands/manage-structure.mjs  deliverable and work type add/edit/remove and lists
cli/commands/init.mjs     setup: prompts (hidden input) or piped lines, then GET /api/me
```
