# Chronolog CLI

Command-line client for the Chronolog REST API. The laptop Claude secretary uses it to read and write time entries and notes for one signed-in user, and (sprint 031-CL) to set up clients, contracts, deliverables and work types. It authenticates with a personal API token (see `src/lib/server/auth-tokens/README.md`).

Node 20+, no dependencies. It talks only to `/api/*`; the only local state is the config file, `last-entry.json` beside it (the entry `undo` would delete) and `last-import.json` (the entries `undo --last-import` would delete). Deleted notes go to the server's trash (sprint 037-CL); a `trash/` directory beside the config from sprint 034 is no longer read and can be removed (its files are plain markdown).

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
- `note new <contract> "<title>" [--file body.md] [--date D]` (body from `--file` or stdin), `note show <note-id>`. `--date` (`YYYY-MM-DD`, `today`, `yesterday`, a weekday) backdates the note: its id carries that date and `createdAt` is noon of that day in the laptop's timezone; a future date is 400 `invalid_date`. The creation date cannot be changed afterwards (the id would have to change); delete and recreate instead.
- `notes <contract> [--since YYYY-MM-DD]`, `search "<words or note id>" [--limit N]` (notes and time entries in two groups, matches marked `»…«`; `--json` is the `GET /api/search` result)
- `status <2026-W45|current> <unsubmitted|draft-ready|submitted>`
- `edit <entry-id> [--duration D] [--description "..."] [--date D] [--deliverable X|none] [--work-type X|none]`: change one entry (`PATCH /api/time-entries/<id>`); only the flags given change. A plain duration clears an old start/end range; a range sets a new one. A work type is resolved under the new deliverable if given, else the entry's current one (`--tag` works too). `--deliverable none` clears both; a new deliverable without `--work-type` clears the old deliverable's work type.
- `undo`: delete the last entry this CLI logged. `log` records it in `last-entry.json` next to the config file; `undo` deletes it once and forgets it. It refuses (exit 2) when nothing is recorded or the record is for another server. Entries made in the app or edited are not undoable this way.

### Changing and deleting notes (sprint 034-CL)

- `note edit <id> [--title "..."] [--contract X] [--file body.md | stdin]`: a body replaces the whole text (the note's `# title` heading is kept unless the body brings its own); `--title` replaces the heading; `--contract` moves the note (its id keeps its prefix).
- `note append <id> [--file text.md | stdin]`: adds a blank line and the text at the end.
- Both read the note, then `PATCH /api/notes/<id>` with the `updatedAt` they read (or `--expected-updated-at T`, the copy shown to the owner earlier). If the note changed in the app since, the server answers 409 and the command exits **7** "note changed on the server since it was read; re-run" without retrying. They send markdown only, so the server drops the note's TipTap JSON and the editor reloads from the new markdown.
- `note delete <id> [--yes]`: prints title, contract and word count, asks `[y/N]` on a terminal, refuses (exit 2) without `--yes` otherwise. Then `DELETE /api/notes/<id>` moves the note to the server's trash, where it keeps its id, links, backlinks and time-entry links; the output names the id and the restore command. Notes are purged 30 days after deletion.
- `note restore [<id>]`: `POST /api/notes/<id>/restore` brings the note back exactly as it was (same id and links); it notes when the contract is archived. Not in the trash: exit 3. Without an id it lists the trash (`GET /api/notes/trash`: id, deleted, purge date, contract, title).

### Attachments (sprint 036-CL)

- `note attach <note-id> <file> [--no-insert]`: uploads the file as multipart form data (Node's own `FormData` and `Blob`) to `POST /api/notes/<id>/attachments`. Images (PNG, JPEG, GIF, WebP, SVG) and PDFs up to 10 MB; the type sent comes from the extension, and the server checks the file's first bytes (a PDF renamed `.png`, a `.txt`, or anything over 10 MB is a 400, exit 1). By default it then appends the reference line at the end of the note through the `note append` path (same `updatedAt` check, exit 7): `![name](chronolog://attachment/<id>)` for an image (shown inline) or `[name](chronolog://attachment/<id>)` for a PDF (a link that opens it). `--no-insert` uploads only. Prints the id and the line (`attachment`, `reference`, `inserted` with `--json`). After an exit 7 the file is attached but not linked; the message carries the line.
- `note attachments <note-id>`: id, filename, type, size, created.
- `attachment get <id> [--out <path>] [--force]`: saves the bytes under the original filename (from `Content-Disposition`, reduced to a bare name) in the current directory, or at `--out` (a file, or a directory to save into). An existing file is never overwritten without `--force` (exit 2).
- `attachment delete <id> [--yes]`: reads the attachment's headers (`HEAD`, which carries `X-Note-Id`) and the note, prints filename, type, size and note, and is confirmed like `note delete`. When the note's text still links to it, it warns and leaves the link alone (the editor shows it as missing). An unknown id exits 3.

### The running timer (sprint 041-CL)

- `timer` (or `timer status`): the running timer (start, elapsed, contract, description), a stopped one waiting to be saved, or "No timer running."
- `timer start <contract> ["description"] [--at [date] HH:MM]`: starts the server timer the app shows (409, exit 5, when one is already running). Without `--at` it starts now.
- `timer adjust --at [date] HH:MM`: moves the running timer's start (`PATCH /api/timer`); without a date the timer's own day is kept. The app's clock and the menu bar follow on their next refresh.
- `--at` is `HH:MM`, optionally after a date word: `9:30`, `"yesterday 23:10"`, `"2026-11-03 23:10"`, `"monday 9:00"`. A start in the future is 400 `start_in_future`, more than 24 hours ago 400 `start_too_early` (exit 1).
- A start before the end of another entry prints `Warning: …` naming that entry, asks `[y/N]` on a terminal, and without a terminal refuses with exit 2 unless `--yes` is given (get the owner's yes first). A "no" prints "Start not changed." (exit 0).
- `timer stop`: stops the timer and saves it as an entry on its contract (with its description, deliverable and work type), printing the duration and range.

### Importing history (sprint 038-CL)

`chronolog import notes <file>` and `chronolog import entries <file>` send a whole file in a few requests (`POST /api/notes/batch`, 100 per request; `POST /api/time-entries/batch`, 200 per request). The file is JSON Lines (one object per line; blank lines and `//` lines skipped) or a JSON array. Items use the CLI's references, not ids:

```
{"contract": "ACME/Website", "title": "Kickoff", "body": "Agenda…", "date": "2026-10-04"}   new note; body gets a "# title" heading (as note new); "content" is used as written; date backdates
{"id": "ACME.20261004.001", "append": "Follow-up…"}      change a note: title, content (replaces) or append, optional expectedUpdatedAt
{"contract": "ACME/Website", "date": "2026-10-04", "duration": "1h30m", "description": "Review", "deliverable": "Phase 1", "workType": "Design", "note": "ACME.20261004.001"}
{"contract": "ACME/Website", "date": "monday", "startTime": "09:00", "endTime": "10:30"}
```

- Every distinct reference is resolved once (one contracts call, one deliverables call per contract, one work-types call per deliverable). If any line has an unknown or ambiguous reference the whole file is refused before anything is sent: exit 3, listing each bad line with its candidates. A line that is not JSON or has an unknown field is exit 2, also before sending.
- `--dry-run` prints each item as it would be sent (ids resolved, date words turned into dates) and sends nothing. Show it to the owner first.
- `--atomic` passes `atomic: true` with each request: within a chunk, one failure saves nothing (the others report `batch_rolled_back`).
- Output: `ok <line> <id>  <summary>` or `fail <line> <code> <message>` per item, then `Imported N of M …`. `--json` prints `{ created, updated, failed, results: [{ line, index, ok, id?, updatedAt?, error?, code?, unconditional? }] }`. Exit 0 when every item was saved, 1 when any failed (the others are saved; fix and import only the failed lines).
- A note change without `expectedUpdatedAt` is applied whatever the note's state (`(updated, unconditionally)`).
- The ids of created entries go to `last-import.json`; `chronolog undo --last-import` deletes them all after confirmation (`--yes` without a terminal, as for `remove`). Notes are not undone this way.

### Version

`chronolog --version` prints the CLI version, the root `package.json` version (1.1.0 since sprint 038). `chronolog me` adds the server's (`serverVersion` from `GET /api/me`). Changes per sprint are in [CHANGELOG.md](CHANGELOG.md).

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
| 2 | Usage error, a `remove`/`delete`/`undo --last-import` without `--yes` and no terminal, `attachment get` onto an existing file, an import line that is not valid |
| 3 | Unknown or ambiguous reference (for `import`: in any line, nothing sent), or any 404 (note, entry, object, attachment not found): ask the person |
| 4 | Auth failure (401/403): token or device key |
| 5 | Conflict (409), including a duplicate short code |
| 6 | Rate limited (429) |
| 7 | Note changed on the server since it was read (`note edit` / `note append`): re-read, then re-run |

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
cli/lib/import-file.mjs   import file reading (JSON Lines or array, line numbers), chunking
cli/lib/import-items.mjs  import items: references resolved once each, into batch API items
cli/lib/import-history.mjs  last-import.json: the entries `undo --last-import` deletes
cli/lib/note-body.mjs     note markdown: body input, title heading, edit/append text, word count
cli/lib/attachment-files.mjs  attachment type from extension, reference lines, sizes, Content-Disposition filename
cli/lib/version.mjs       CLI_VERSION from the root package.json
cli/commands/read.mjs     me, clients, contracts, week, notes, note show
cli/commands/search.mjs   search (GET /api/search)
cli/commands/write.mjs    log, note new, status
cli/commands/correct.mjs  edit, undo
cli/commands/import.mjs   import notes|entries, undo --last-import (falls back to correct.undo)
cli/commands/note-changes.mjs  note edit, append, delete, restore
cli/commands/attachments.mjs   note attach, note attachments, attachment get, attachment delete
cli/commands/timer.mjs    timer (status), timer start/adjust/stop; --at parsing; the overlap confirmation
cli/commands/manage-clients.mjs    client and contract add/edit/archive/unarchive/remove
cli/commands/manage-structure.mjs  deliverable and work type add/edit/remove and lists
cli/commands/init.mjs     setup: prompts (hidden input) or piped lines, then GET /api/me
```
