# Sprint 037-CL transcript: the note trash through the CLI

Run on 2026-11-04 against the worktree's dev server (`http://localhost:5215`, shared dev Postgres)
as a fresh `qa-037-transcript-*` user, with the real `cli/chronolog.mjs` and an API token. The `curl`
calls show what the browser asks for (the wiki-link renderer's `titles?includeDeleted=1`, the
backlinks panel, the linked time entries). The same sequence is automated in
`src/e2e/note-trash-cli.e2e.test.ts`; the browser side (Undo toast, "deleted" wiki-link and its
inline restore) in `e2e-playwright/note-trash.spec.ts`, with the screenshots beside this file:
`01-deleted-wiki-link.png`, `02-undo-toast.png`, `03-restore-prompt.png`.

## 1. Create A over the CLI (word count from the markdown)

```console
$ chronolog note show INTL.20261104.365 --json
{
  "id": "INTL.20261104.365",
  "userId": "86ydqHVsVxOTUPTbXct7EzqRCnrK7msM",
  "contractId": "0fcd7c7c-01f0-41d5-8aef-2d87bb4fe83e",
  "title": "Kickoff plan",
  "content": "# Kickoff plan\n\nAgreed scope and the next three milestones.\n",
  "contentJson": null,
  "wordCount": 9,
  "isPinned": false,
  "createdAt": "2026-11-04T17:31:23.672Z",
  "updatedAt": "2026-11-04T17:31:23.672Z",
  "deletedAt": null,
  "timeEntries": []
}
(exit 0)
```

## 2. B links to A; an entry links to A

```console
$ printf 'Follow-up on [[INTL.20261104.365]]: milestones confirmed.\n' | chronolog note new INTL/General Status 4 Nov
Created note INTL.20261104.366 in INTL/General: Status 4 Nov
(exit 0)
```

```console
$ chronolog log INTL/General 45m Kickoff prep [[INTL.20261104.365]] --note INTL.20261104.365
Logged 45m on 2026-11-04 to INTL/General: Kickoff prep [[INTL.20261104.365]]
id=88a67ecd-258a-47d6-8951-526da00b2639
(exit 0)
```

## 3. Delete A (refused without --yes, then confirmed)

```console
$ chronolog note delete INTL.20261104.365
chronolog: Note INTL.20261104.365 “Kickoff plan” in INTL/General, 9 words.
Not deleted: confirm with the owner, then run again with --yes.
(exit 2)
```

```console
$ chronolog note delete INTL.20261104.365 --yes
Deleted note INTL.20261104.365 “Kickoff plan” from INTL/General.
Restore with `chronolog note restore INTL.20261104.365` within 30 days.
(exit 0)
```

```console
$ chronolog note show INTL.20261104.365
chronolog: INTL.20261104.365 is in the trash: `chronolog note restore INTL.20261104.365` brings it back.
(exit 3)
```

## 4. The trash, and what B's link sees (titles with includeDeleted, through the API)

```console
$ chronolog note restore
Notes in the trash (restorable for 30 days): 1
INTL.20261104.365  deleted 2026-11-04  purged 2026-12-04  INTL/General  Kickoff plan
(exit 0)
```

```console
$ curl -H 'Authorization: Bearer …' '/api/notes/titles?ids=INTL.20261104.365,INTL.20261104.366&includeDeleted=1'
{"titles":[{"id":"INTL.20261104.365","displayTitle":"Kickoff plan","contractId":"0fcd7c7c-01f0-41d5-8aef-2d87bb4fe83e","clientId":"fa83e53f-e137-4682-a08c-c378d70f0250","deletedAt":"2026-11-04T17:31:24.438Z"},{"id":"INTL.20261104.366","displayTitle":"Status 4 Nov","contractId":"0fcd7c7c-01f0-41d5-8aef-2d87bb4fe83e","clientId":"fa83e53f-e137-4682-a08c-c378d70f0250","deletedAt":null}]}
```

## 5. Restore A: same ID, backlink from B and the entry link intact

```console
$ chronolog note restore INTL.20261104.365
Restored note INTL.20261104.365 “Kickoff plan” to INTL/General.
(exit 0)
```

```console
$ curl … /api/notes/INTL.20261104.365/backlinks ; curl … /api/notes/INTL.20261104.365/time-entries
{"backlinks":[{"sourceNoteId":"INTL.20261104.366","headingAnchor":null,"noteTitle":"Status 4 Nov","noteContractId":"0fcd7c7c-01f0-41d5-8aef-2d87bb4fe83e","noteClientId":"fa83e53f-e137-4682-a08c-c378d70f0250"}]}
[{"timeEntryId":"88a67ecd-258a-47d6-8951-526da00b2639","description":"Kickoff prep [[INTL.20261104.365]]","durationMinutes":45}]
```

```console
$ chronolog note restore INTL.20261104.365
chronolog: INTL.20261104.365 is not in the trash (`chronolog note restore` lists it; notes are purged 30 days after deletion).
(exit 3)
```

## Backfill and purge, inside the production image

```console
$ docker build -t chronolog-037-check .
$ docker run --rm --env-file .env --network host chronolog-037-check node scripts/backfill-note-word-counts.mjs --dry-run
[backfill-note-word-counts] 848 note(s) with word_count 0 and some content; 841 have words.
[backfill-note-word-counts] dry run: 841 note(s) would be updated.
[backfill-note-word-counts] sample: ACME.20261103.024 (12 words), ACME.20261103.027 (9 words), ACME.20261103.028 (5 words), ACME.20261103.030 (20 words), BIGCH.20260203.001 (36 words)
$ docker run --rm --env-file .env --network host chronolog-037-check node scripts/backfill-note-word-counts.mjs --apply
[backfill-note-word-counts] 848 note(s) with word_count 0 and some content; 841 have words.
[backfill-note-word-counts] updated 841 note(s).
$ docker run --rm --env-file .env --network host chronolog-037-check node scripts/backfill-note-word-counts.mjs --dry-run
[backfill-note-word-counts] 7 note(s) with word_count 0 and some content; 0 have words.
[backfill-note-word-counts] dry run: 0 note(s) would be updated.
$ docker run --rm --env-file .env --network host chronolog-037-check node scripts/purge-note-trash.mjs --dry-run
[purge-note-trash] dry run: 0 note(s) trashed more than 30 days ago would be purged.
$ docker run --rm --env-file .env --network host chronolog-037-check node scripts/encrypt-existing.mjs --dry-run | tail -1
[encrypt-existing] done: 0 value(s) would be encrypted (dry run).
$ docker rmi chronolog-037-check
```

The 7 left at 0 are browser notes whose TipTap JSON has no words (empty paragraphs, or an empty
`content: []` document beside a one-line markdown); the app counts the JSON when there is one, and so
does the script. Later in the session the count of zero-word notes grew again: another worktree's dev
server (sprint 038-CL, port 5216, without this sprint's create-time count) was creating notes in the
shared database. A re-run of the dry run then reported 137; they are left for the backfill to pick
up after the merge.
