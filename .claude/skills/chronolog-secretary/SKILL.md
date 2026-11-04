---
name: chronolog-secretary
description: Log consulting time, write, change or delete client notes, file a document (PDF or image) on a note, summarise a client's week and set up clients in Chronolog through the `chronolog` CLI. Use when the user says they worked on something ("log 2h on the Acme work"), asks to write up or file a note for a client, asks to attach or file a PDF, image or document, asks what was done this week or for a client, asks to mark a week ready or submitted, or asks to add, rename, archive or remove a client, contract, deliverable or work type (tag).
allowed-tools: Bash(chronolog:*), Bash(node cli/chronolog.mjs:*), Read, Write
---

# Chronolog secretary

You keep the owner's Chronolog up to date from their words, using the `chronolog` CLI on this
laptop. Chronolog is the source of truth for time and client notes; you never edit its database
or call the API with curl. If `chronolog` is not on the PATH, run `node cli/chronolog.mjs` from
the Chronolog repo instead. If it says "No server configured", stop and ask the owner to run
`chronolog init` (they need a token from Settings → API tokens); never ask them to paste the
token or device key into the chat.

Always add `--json` when you need to read the output yourself; show the owner the plain output.

## The one rule: never guess a contract

Time and notes belong to a **contract** (a client's piece of work). Map the owner's words to
exactly one contract, or ask.

1. `chronolog contracts --json` (or `chronolog contracts <client> --json`). Each row has `id`,
   `name`, `clientName`, `clientShortCode`, `isActive`.
2. Pick the contract only if the words clearly identify one row ("the Acme website" with one
   Acme contract named Website). If two rows fit ("the Acme work" and Acme has Website and
   Retainer), ask: "Website or Retainer?" Do not choose by recency or size.
3. Pass the reference you are sure of, best as `SHORTCODE/Contract name` (`ACME/Website`) or the
   `id`. The CLI also refuses to guess: an unknown or ambiguous reference exits **3** and prints
   the candidates. Show them to the owner and ask; do not retry with a looser name.
4. An `[inactive]` contract is valid but unusual: confirm before logging to it.

Remember what the owner confirms within the session ("Acme work" = `ACME/Retainer`), but
re-check against `chronolog contracts` in a new session.

## Logging time

```bash
chronolog log ACME/Website 1h30m "Checkout flow review with Dana" --json
chronolog log ACME/Website 9:00-10:30 "Workshop" --date yesterday --json
chronolog log ACME/Website 45m "Fixed staging deploy" --deliverable "Phase 2" --note ACME.20261103.001 --json
```

- **Durations** (same as the app): `1h30m`, `2h`, `1.5`, `1:30`, `90m`, `45 mins`, or a range
  `9:00-10:30` (also records start and end). Over 24h or zero is refused (exit 1, message says why).
  Convert the owner's words: "an hour and a half" → `1h30m`; "half an hour" → `30m`;
  "the morning" is not a duration — ask for hours or a time range.
- **Dates**: default is today in the laptop's timezone. `--date` takes `YYYY-MM-DD`, `today`,
  `yesterday`, or a weekday name meaning the most recent one (`monday` on a Monday is today).
  For anything else ("last Thursday week") work out the date with `chronolog me --json` (`today`)
  and pass `YYYY-MM-DD`.
- **Description**: one short line in the owner's words; past tense, what was done, for whom.
- **Deliverable** (`--deliverable`, then `--work-type`): only when the owner names one; same never-guess
  rule. A work type is looked for only under that deliverable; exit 3 lists that deliverable's work types.
- **Referencing a note**: `--note <note-id>` links the entry to that note (the CLI appends
  `[[ID]]` to the description, which is how the app links them). Note ids look like
  `ACME.20261103.001`. Find one with `chronolog search "<words>" --json` or
  `chronolog notes ACME/Website --json`. An unknown note id exits 3 and nothing is logged.
- After logging, report back in one line: duration, date, contract, description. Keep the
  `--json` result's `id`: corrections use it.

## Correcting an entry

```bash
chronolog undo --json                                   # "no, scrap that": deletes the last entry YOU logged
chronolog edit <entry-id> --duration 2h --json          # also --description "...", --date D, --deliverable X|none
chronolog edit <entry-id> --work-type Survey --json     # --deliverable X|none, --work-type X|none (none clears)
```

- `undo` deletes only the last entry this CLI logged, once. It exits 2 "Nothing to undo" when
  there is none; then find the entry with `chronolog week --json` and ask before deleting
  anything in the app. Never use `undo` for an entry the owner made in the app.
- `edit` changes only the flags given. Get the id from the `log` result or `chronolog week
  --json`; if several entries could be the one meant, list them and ask. Report the new line.

## Writing a note

```bash
chronolog note new ACME/Website "Status: checkout redesign" --json <<'EOF_NOTE'
## Done
- Reviewed checkout flow with Dana; agreed to drop the guest step.
## Next
- Prototype by Friday.
EOF_NOTE
```

The body is markdown from stdin or `--file path.md`; the title becomes the first heading. The
result's `id` is the note id: give it to the owner, and use it with `log --note` when the time
and the note are about the same work (create the note first, then log). Read one back with
`chronolog note show <id>`.

**Status notes**: title `Status: <topic>` or `Weekly status <ISO week>`; sections Done / Next /
Risks or questions; facts from the owner or from `chronolog week`, never invented.

**Backdate** with `--date yesterday` (or `YYYY-MM-DD`, a weekday) when the owner says it was
yesterday's meeting: the id carries that date, and it cannot be changed later.

## Changing a note

```bash
chronolog note show ACME.20261103.001 --json             # always read first; keep its updatedAt
chronolog note append ACME.20261103.001 --expected-updated-at <updatedAt> --json <<'EOF_NOTE'
## Update 4 Nov
- Guest step removed in staging.
EOF_NOTE
chronolog note edit ACME.20261103.001 --title "Status: checkout" --contract ACME/Retainer --json
```

- **Read before you change.** Show the owner what is there, then pass the `updatedAt` you read as
  `--expected-updated-at`. Exit **7** "note changed on the server" means the owner edited it in the
  app meanwhile: nothing was written. Re-read, tell them, and only then redo the change.
- **Prefer `append`** for status updates and new facts; it adds a blank line and the text at the
  end. `edit` with a body (stdin or `--file`) replaces the whole text: only when asked to rewrite.
- **Never delete a note unless the owner asked for it in this conversation.** `note delete <id>`
  without `--yes` exits 2 and prints title, contract and word count: tell the owner, then rerun with
  `--yes` on their yes. It goes to the server trash with its id and links for 30 days, then is
  purged: `chronolog note restore <id>` brings it back exactly (`note restore` lists the trash).

## Filing a document

```bash
chronolog note attach ACME.20261104.001 ~/Downloads/SOW.pdf --expected-updated-at <updatedAt> --json
chronolog note attachments ACME.20261104.001 --json; chronolog attachment get <id> --out ~/Downloads
```

- Attach only the file the owner names (PDF or image, ≤ 10 MB); confirm the note first, preferring the
  day's status note (`notes <contract> --since <today>`; none: ask before creating one). It appends a
  `[name](chronolog://…)` link (image: `![name](…)`); exit 7: attached but not linked, re-read and append.
- **Never delete an attachment unless the owner said so in this conversation** (`attachment delete
  <id>` exits 2 without `--yes`, showing the file and any note still linking to it).

## Summarising a client's week

```bash
chronolog me --json                                  # today, isoWeek (e.g. 2026-W45)
chronolog week 2026-W45 --client ACME --json         # or --contract ACME/Website
chronolog notes ACME/Website --since 2026-11-02 --json
```

`week` returns `entries` (date, durationMinutes, contractName, deliverableName, description),
`totalMinutes` and the week `status`. Summarise as: total hours, hours per contract and day,
the main pieces of work in a few bullets (merge similar descriptions), notes written that week
by title and id. Report minutes as hours and minutes (`7h45m`). No week given means the current
one (`chronolog week`).

**Week status**: `chronolog status 2026-W45 draft-ready` (or `unsubmitted`, `submitted`;
`current` for this week). Only set `submitted` when the owner says it was sent to the client.

## Setting up a client

The hierarchy is **client** (short code, e.g. `ACME`) → **contract** → **deliverable** → **work
type** (the owner may say "tag"; `tag` works as an alias). Time is logged to a contract, optionally
with a deliverable and one of its work types. Create top-down, each step using the last one's path:

```bash
chronolog client add "Acme Ltd" --code ACME --emoji 🚀 --json
chronolog contract add ACME "Website" --description "Rebuild of acme.com" --json
chronolog deliverable add ACME/Website "Phase 1" --json
chronolog work-type add "ACME/Website/Phase 1" "Design" --json
chronolog log ACME/Website 1h "Wireframes" --deliverable "Phase 1" --work-type Design --json
```

- **Short codes are the owner's choice.** Never invent or abbreviate one; ask "What short code
  for Acme?" It prefixes note ids and cannot clash: a code in use exits **5** `duplicate`.
- References are paths (`ACME`, `ACME/Website`, `ACME/Website/Phase 1`, `…/Design`) or ids, with
  the never-guess rule: exit 3 lists candidates, ask. Lists: `chronolog deliverables ACME/Website`,
  `chronolog work-types "ACME/Website/Phase 1"`, `clients --all` / `contracts --all` for archived.
- Edit: `client edit ACME --name "Acme Limited"` (`--code`, `--emoji X|none`), `contract edit
  ACME/Website --inactive` (`--name`, `--description`, `--active`), `deliverable|work-type edit
  <path> --name "…"`.
- **Prefer archive over remove.** "We're done with Acme" means `chronolog client archive ACME`
  (or `contract archive ACME/Website`): hidden from the sidebar and selects, everything kept,
  `unarchive` restores it.
- **`remove` is confirmed with the owner every time.** Run it once without `--yes`: it exits 2
  and prints what would move ("3 time entries (4h30m) and 1 note"). Tell the owner exactly that
  and that entries go to Deleted Client / Deleted Contract (deliverable or work type: entries
  keep a "Formerly:" line). Only after a clear yes, rerun with `--yes`, then report the message.

## When a call fails

The CLI prints the server's `{ error, code }`; with `--json` it is on stderr with `status`.

| Exit | Status / code | What to do |
|------|---------------|------------|
| 3 | ambiguous / not_found / note_not_found | Show the candidates, ask which one. Never retry with a guess. |
| 4 | 401 `device_not_authorised` | The device key is missing or wrong. Ask the owner to rerun `chronolog init`. |
| 4 | 401 `invalid_token` / `unauthorized` | The token is wrong. Owner creates a new one in Settings → API tokens, then `chronolog init`. |
| 4 | 403 `token_revoked` | This laptop's token was revoked. Same fix; do not retry. |
| 5 | 409 `conflict` | Someone changed the item in the app. Re-read it (`note show`), tell the owner, do not overwrite. |
| 7 | `note_changed` | The note changed since you read it. Re-read (`note show`), tell the owner, do not overwrite. |
| 5 | 409 `duplicate` | That short code is taken. Ask the owner for another; never pick one yourself. |
| 2 | `remove` / `note delete` / `attachment delete` without `--yes` | Expected: show the owner what would go, rerun with `--yes` only on their yes. |
| 6 | 429 `rate_limited` | Too many failed attempts. Wait a minute; do not loop. |
| 1 | 400 `deliverable_mismatch` / `work_type_mismatch` | The pair does not belong together; show the message, ask which is right. |
| 1 | 400 (e.g. `invalid_duration`) | Fix the input from the message, or ask the owner. |
| 1 | network / 5xx | Say the server is unreachable; do not retry more than once. |

Never print, log or echo the API token or device key, and never read
`~/.config/chronolog/config.json` aloud.

## Importing history

To back-fill weeks or months, never loop `log` or `note new`: write one file per batch (e.g.
`~/secretary/imports/2026-10-entries.jsonl`), one JSON object per line with the CLI's references:
entries `{"contract","date","duration","description","deliverable?","workType?","note?"}`, notes
`{"contract","title","body","date"}` or changes `{"id","append"}` (see `cli/readme.md`).
1. `chronolog import entries <file> --dry-run` (or `import notes`); exit 3 lists lines with unknown
   or ambiguous references: ask the owner, fix the file, rerun. Nothing was sent.
2. Show the owner the dry run (count, date range, total hours) and wait for a yes.
3. `chronolog import entries <file>`; report the summary. `fail` lines (exit 1) were not saved:
   fix only those lines into a new file and import that, never the whole file again.
4. Keep the file. A wrong import of entries is undone with `chronolog undo --last-import` (asks
   first; `--yes` only after the owner agrees).

## The running timer

"I started at 9:30" or "I forgot the timer": `chronolog timer` shows it, `timer adjust --at 09:30`
moves its start (`--at "yesterday 23:10"` across midnight), `timer start <contract> --at 09:30`
starts one late, `timer stop` saves it. A `Warning:` that the start overlaps another entry (exit 2)
means ask the owner; rerun with `--yes` only after a yes. Future or over-a-day starts exit 1.

**Searching (sprint 042-CL).** `chronolog search "<words>" --json` covers notes and time entries:
`{ notes: { hits, total }, timeEntries: { hits, total } }`. Note ids are `notes.hits[].id` (title hits
first); entry hits carry `id`, `date`, `durationMinutes` and a `snippet.text`. Use it to answer "when
did I work on X" or to find an entry id before `edit`. At least two characters.
