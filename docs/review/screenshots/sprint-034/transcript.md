# Sprint 034-CL transcript: the CLI changes and deletes notes

Run 2026-11-04 against the worktree dev server (`http://localhost:5212`) as a fresh user
`qa-034-transcript-*@chronolog.test` with an API token, using `node cli/chronolog.mjs` (shown as
`chronolog`). `CHRONOLOG_CONFIG` pointed at a temporary directory, shown as `<tmp>`, so the trash
directory is `<tmp>/config/trash/` instead of `~/.config/chronolog/trash/`. The browser save is
the same `PUT` the editor sends (content and TipTap JSON together, with `expectedUpdatedAt`), made
with the user's session cookie. Every step ends with the CLI's exit code.

The automated versions of this sequence are `src/e2e/note-changes-cli.e2e.test.ts` (API e2e) and
`e2e-playwright/cli-note-edit.spec.ts` (the editor opens a browser-edited note that the CLI then
rewrote and shows the CLI's text: `01-editor-shows-cli-edit.png`).

Notes:
- The restored note got its old id back because it was the newest note of that day's sequence
  (ids are allocated as the day's highest sequence + 1). Otherwise it gets the next free one.
- Note ids share one sequence per client short code and day across all users of the dev database,
  hence `.166` and `.833` here.

```text

$ chronolog contracts
INTL/General (Internal)  id=9608f377-3a52-440c-822f-e2028507c23f
[exit 0]

$ printf "## Done
- Reviewed checkout with Dana
" | chronolog note new INTL/General "Status: checkout"
Created note INTL.20261104.166 in INTL/General: Status: checkout
[exit 0]

$ printf '## Next
- Prototype by Friday
' | chronolog note append INTL.20261104.166
Appended 4 words to note INTL.20261104.166: Status: checkout
[exit 0]

$ chronolog note show INTL.20261104.166
INTL.20261104.166  Status: checkout
Updated 2026-11-04T16:53:49.646Z

# Status: checkout

## Done
- Reviewed checkout with Dana

## Next
- Prototype by Friday
[exit 0]

$ chronolog note show INTL.20261104.166 --json | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const n=JSON.parse(d);console.log(JSON.stringify({id:n.id,updatedAt:n.updatedAt,wordCount:n.wordCount,contentJson:n.contentJson}))})"
{"id":"INTL.20261104.166","updatedAt":"2026-11-04T16:53:49.646Z","wordCount":11,"contentJson":null}
[exit 0]

# The owner types in the browser (the editor's PUT carries content and contentJson):

$ curl -s -o /dev/null -w 'PUT %{http_code}
' -X PUT http://localhost:5212/api/notes/INTL.20261104.166 -H 'Content-Type: application/json' -H "Cookie: $COOKIE" -d '{"title":"Status: checkout","content":"# Status: checkout

Owner rewrote this in the browser","contentJson":"{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"Owner rewrote this in the browser\"}]}]}","expectedUpdatedAt":"2026-11-04T16:53:49.646Z"}'
PUT 200
[exit 0]

$ printf 'Secretary rewrite
' | chronolog note edit INTL.20261104.166 --expected-updated-at 2026-11-04T16:53:49.646Z
chronolog: note changed on the server since it was read; re-run
[exit 7]

$ printf 'Secretary rewrite
' | chronolog note edit INTL.20261104.166 --title 'Status: checkout (rewritten)'
Updated note INTL.20261104.166: Status: checkout (rewritten)
[exit 0]

$ chronolog note show INTL.20261104.166 --json | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const n=JSON.parse(d);console.log(JSON.stringify({content:n.content,contentJson:n.contentJson,wordCount:n.wordCount}))})"
{"content":"# Status: checkout (rewritten)\n\nSecretary rewrite\n","contentJson":null,"wordCount":5}
[exit 0]

$ chronolog note delete INTL.20261104.166 < /dev/null
chronolog: Note INTL.20261104.166 “Status: checkout (rewritten)” in INTL/General, 5 words.
Not deleted: confirm with the owner, then run again with --yes.
[exit 2]

$ chronolog note delete INTL.20261104.166 --yes
Deleted note INTL.20261104.166 “Status: checkout (rewritten)” from INTL/General.
A copy is in <tmp>/config/trash/INTL.20261104.166.md
(`chronolog note restore INTL.20261104.166` brings it back as a new note.)
[exit 0]

$ ls -l <tmp>/config/trash/ | sed 's/olivier/owner/g'; cat <tmp>/config/trash/INTL.20261104.166.md
total 8
-rw-------@ 1 owner  wheel  261  4 Nov 08:53 INTL.20261104.166.md
---
id: INTL.20261104.166
title: Status: checkout (rewritten)
contractId: 9608f377-3a52-440c-822f-e2028507c23f
contract: INTL/General
updatedAt: 2026-11-04T16:53:50.265Z
deletedAt: 2026-11-04T16:53:50.633Z
---

# Status: checkout (rewritten)

Secretary rewrite
[exit 0]

$ chronolog note restore
Deleted notes that can be restored: 1
INTL.20261104.166  2026-11-04  INTL/General  Status: checkout (rewritten)
[exit 0]

$ chronolog note restore INTL.20261104.166
Restored INTL.20261104.166 as new note INTL.20261104.166 (the same id was free again) in INTL/General: Status: checkout (rewritten)
[exit 0]

$ chronolog notes INTL/General
Notes for INTL/General: 1
INTL.20261104.166  2026-11-04  Status: checkout (rewritten)
[exit 0]

$ chronolog note new INTL/General "Yesterday's kickoff" --date yesterday < /dev/null
Created note INTL.20261103.833 in INTL/General: Yesterday's kickoff
[exit 0]

$ chronolog note new INTL/General 'Next week' --date 2999-01-01 < /dev/null
chronolog: createdAt 2999-01-01 is in the future (today is 2026-11-04)
[exit 1]
```
