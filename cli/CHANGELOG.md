# chronolog CLI changelog

The CLI ships in the repo and takes its version from the root `package.json` (`chronolog --version`;
`chronolog me` also shows the server's version). A laptop is up to date after `git pull`. Sprints
030, 033 and 035 changed nothing in the CLI and are not listed.

## Unreleased

- Sprint 041-CL: `timer` / `timer status`, `timer start <contract> ["desc"] [--at [date] HH:MM]`,
  `timer adjust --at [date] HH:MM` and `timer stop` (stops and saves the entry). `--at` takes
  `9:30` or a date word and a time (`"yesterday 23:10"`). A future start (`start_in_future`) or one
  over 24 hours ago (`start_too_early`) exits 1; a start before the end of another entry warns and
  needs a yes on a terminal or `--yes` without one (exit 2 otherwise).
- Sprint 040-CL: `todos [contract] [--all] [--json]` lists open checkbox items (`- [ ]`) across
  the user's notes, one line per item (note id, title, item) grouped by note; `--all` adds done
  items marked `[x]`. Served by the new `GET /api/notes/todos`. Notes written with `- [ ]` /
  `- [x]` open in the editor as checkboxes; `note show`, `edit` and `append` keep the syntax.

- Sprint 042-CL: `search "<words>" [--limit N]` now searches time entry descriptions as well as
  notes, through the new `GET /api/search`. It prints a `Notes (n)` group (title hits before body
  hits; id, client/contract, last edited, title, then a snippet) and a `Time entries (n)` group
  (date, duration, client/contract, snippet, entry id), matches marked `»…«`, `(5 of 12)` when the
  limit cut a group. **`--json` shape changed**: `{ query, notes: { hits, total }, timeEntries:
  { hits, total } }` instead of an array of notes (note ids are `notes.hits[].id`); each hit has a
  `snippet` `{ text, matches: [{ start, end }] }`. Trashed notes never appear. A query under two
  characters is a usage error (exit 2).

- Sprint 039-CL: `note pin <id>` / `note unpin <id>` keep a note at the top of its list in the app
  (`PUT /api/notes/<id>/pin`; `updatedAt` unchanged). `notes <contract>` marks pinned notes with 📌
  (they already came first). `client edit <client> --order N` moves a client to place N in the
  sidebar (1 = top) and prints where it landed.

## Sprint 037-CL, 2026-11-04: server-side note trash (after 1.1.0; version not bumped)

- `note delete <id> [--yes]` moves the note to the server's trash: it keeps its id, its wiki-links,
  its backlinks and its time-entry links. It prints the id and "Restore with `chronolog note restore
  <id>` within 30 days". Nothing is written to `~/.config/chronolog/trash/` any more.
- `note restore <id>` brings the note back exactly (same id, links intact) through
  `POST /api/notes/<id>/restore`; it says so when the note's contract is archived. A note not in the
  trash exits 3. `--contract` is gone (use `note edit <id> --contract X` after restoring).
- `note restore` with no id lists the server trash: id, deleted, purge date, contract, title.
- `note new` without TipTap JSON now stores the right word count (server side).
- Old `trash/<id>.md` files from sprint 034 are left on disk and no longer read; they are plain
  markdown and can be re-filed with `note new --file`.

## 1.1.0 (sprint 038-CL, 2026-11-04): importing history

- `import notes <file>` and `import entries <file>`: JSON Lines or a JSON array using the CLI's
  references (`contract`, `deliverable`, `workType`, `note`, date words, the usual durations).
  References are resolved once each; any unknown or ambiguous one refuses the whole file (exit 3,
  bad lines listed) before anything is sent. Sent in chunks of 100 notes / 200 entries to the new
  `POST /api/notes/batch` and `POST /api/time-entries/batch`. `--dry-run`, `--atomic`, `--json`.
  One `ok`/`fail` line per item and a summary; exit 1 if any item failed.
- Note items create (`contract`, `title`, `body` or `content`, `date` to backdate) or change by
  `id` (`title`, `content`, `append`, optional `expectedUpdatedAt`).
- `undo --last-import [--yes]`: deletes every entry the last entries import created (confirmed).

## 1.0.0 (sprint 036-CL, 2026-11-04): attachments, versions

- `note attach <note-id> <file> [--no-insert]`: uploads an image or a PDF (10 MB at most; the server
  checks the file's bytes, so a PDF renamed `.png` is refused) and appends `![name](chronolog://attachment/<id>)`
  for an image or `[name](chronolog://attachment/<id>)` for a PDF at the end of the note, through the
  `note append` path (`--expected-updated-at`, exit 7). Prints the attachment id and the line.
- `note attachments <note-id>`: id, filename, type, size, created.
- `attachment get <id> [--out <path>] [--force]`: saves the file under its original name in the
  current directory (or `--out`, a file or a directory); refuses to overwrite without `--force`.
- `attachment delete <id> [--yes]`: confirmed like `note delete`; warns when the note still links to
  it and leaves the link in the text.
- `--version`; `me` prints `Server <version> at <url>, CLI <version>` (`serverVersion`, `cliVersion`
  with `--json`).

## Sprint 034-CL: changing and deleting notes

- `note edit <id> [--title] [--contract] [--file | stdin]`: a body replaces the text; `--contract` moves it.
- `note append <id> [--file | stdin]`: a blank line and the text at the end.
- Both send the `updatedAt` they read (or `--expected-updated-at`); a note changed in the app since
  exits **7** and nothing is written.
- `note delete <id> [--yes]`: confirmed; a copy goes to `~/.config/chronolog/trash/<id>.md`.
- `note restore [<id>] [--contract X]`: recreates a deleted note (no id: list the trash).
- `note new … --date D`: backdates a note (its id carries the date).

## Sprint 032-CL: deliverable and work type must match

- `edit <entry-id> [--deliverable X|none] [--work-type X|none]` (`--tag` too); a work type is looked
  for only under the entry's deliverable, so a mismatch exits 3 with that deliverable's work types.
- `log --work-type` follows the same rule.

## Sprint 031-CL: setting up clients

- `client add|edit|archive|unarchive|remove`, `contract add|edit|archive|unarchive|remove`.
- `deliverables`, `deliverable add|edit|remove`, `work-types`, `work-type add|edit|remove` (`tag`/`tags` aliases).
- `clients --all`, `contracts --all` list archived objects too.
- `remove` asks `[y/N]` on a terminal and refuses (exit 2) without `--yes` (`-y`) otherwise.

## Sprint 029-CL: corrections

- `edit <entry-id> [--duration] [--description] [--date] [--deliverable]`: changes one entry.
- `undo`: deletes the last entry this CLI logged (recorded in `last-entry.json`).

## Sprint 028-CL: first release

- `init` (server URL, API token, device key; config mode 600), `me`, `clients`, `contracts [client]`.
- `week [2026-W45] [--client | --contract]`, `log <contract> <duration> "<desc>" [--date] [--deliverable] [--note ID]`.
- `note new <contract> "<title>" [--file]`, `note show <id>`, `notes <contract> [--since]`, `search "<q>"`.
- `status <week> <unsubmitted|draft-ready|submitted>`; `--json` on every command; exit codes 0 to 6.
