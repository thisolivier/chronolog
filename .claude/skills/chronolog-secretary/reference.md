# Chronolog secretary: reference

Read by the [chronolog-secretary skill](SKILL.md) before filing a document, summarising a week,
setting up a client, importing history, adjusting the timer or searching. Everything in SKILL.md
still applies here: never guess a contract (exit 3 lists candidates: ask), read before you change,
and nothing is deleted or removed without the owner's yes in this conversation.

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
4. Keep the file. A wrong import is undone with `chronolog undo --last-import` (asks first;
   `--yes` only after the owner agrees): the entries it created are deleted, the notes it created
   go to the trash (`note restore <id>` within 30 days), notes it appended to are left as they are.

## The running timer

"I started at 9:30" or "I forgot the timer": `chronolog timer` shows it, `timer adjust --at 09:30`
moves its start (`--at "yesterday 23:10"` across midnight), `timer start <contract> --at 09:30`
starts one late, `timer stop` saves it. A `Warning:` that the start overlaps another entry (exit 2)
means ask the owner; rerun with `--yes` only after a yes. Future or over-a-day starts exit 1.

**Searching (sprint 042-CL).** `chronolog search "<words>" --json` covers notes and time entries:
`{ notes: { hits, total }, timeEntries: { hits, total } }`. Note ids are `notes.hits[].id` (title hits
first); entry hits carry `id`, `date`, `durationMinutes` and a `snippet.text`. Use it to answer "when
did I work on X" or to find an entry id before `edit`. At least two characters.
