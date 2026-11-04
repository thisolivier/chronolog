# Chronolog CLI

Command-line client for the Chronolog REST API. The laptop Claude secretary uses it to read and write time entries and notes for one signed-in user. It authenticates with a personal API token (see `src/lib/server/auth-tokens/README.md`).

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
- `clients`, `contracts [client]`: reference lists
- `week [2026-W45] [--client X | --contract X]`: entries and totals
- `log <contract> <duration> "<desc>" [--date D] [--deliverable X] [--note ID]`
- `note new <contract> "<title>" [--file body.md]` (body from `--file` or stdin), `note show <note-id>`
- `notes <contract> [--since YYYY-MM-DD]`, `search "<words or note id>" [--limit N]`
- `status <2026-W45|current> <unsubmitted|draft-ready|submitted>`
- `edit <entry-id> [--duration D] [--description "..."] [--date D] [--deliverable X|none]`: change one entry (`PATCH /api/time-entries/<id>`); only the flags given change. A plain duration clears an old start/end range; a range sets a new one.
- `undo`: delete the last entry this CLI logged. `log` records it in `last-entry.json` next to the config file; `undo` deletes it once and forgets it. It refuses (exit 2) when nothing is recorded or the record is for another server. Entries made in the app or edited are not undoable this way.

Add `--json` for machine-readable stdout. Errors then go to stderr as `{"error","code","status","candidates"}`.

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | OK |
| 1 | Other error (server, network, bad config) |
| 2 | Usage error |
| 3 | Unknown or ambiguous reference, or note not found: ask the person |
| 4 | Auth failure (401/403): token or device key |
| 5 | Conflict (409) |
| 6 | Rate limited (429) |

## References are never guessed

A contract, client or deliverable name (`acme retainer`, `ACME/Website`) or a UUID is resolved in `lib/resolve.mjs`. An exact name or code match wins. Otherwise every word must appear in the text of exactly one item. Any other outcome, no match or several matches, exits 3 and lists the candidates with their ids. The caller must ask the person which one is meant.

## Module layout

```
cli/chronolog.mjs         entry: argv to command, exit codes, --json output
cli/lib/args.mjs          argv parser (positionals, --flag value, boolean json/help)
cli/lib/config.mjs        config path, environment overrides, mode 600 writes
cli/lib/api.mjs           HTTP client: bearer token, device key, X-Timezone, ApiError
cli/lib/resolve.mjs       reference matching for contracts, clients, deliverables
cli/lib/dates.mjs         ISO weeks, --date words, duration formatting
cli/lib/history.mjs       last-entry.json: the entry `undo` deletes
cli/commands/read.mjs     me, clients, contracts, week, notes, note show, search
cli/commands/write.mjs    log, note new, status
cli/commands/correct.mjs  edit, undo
cli/commands/init.mjs     setup: prompts (hidden input) or piped lines, then GET /api/me
```
