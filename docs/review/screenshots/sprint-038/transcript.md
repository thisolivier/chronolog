# Sprint 038-CL transcript: `chronolog import`

Recorded 2026-11-04 against the worktree's dev server (`http://localhost:5216`, shared dev Postgres)
as a fresh `qa-038-demo-*` user with an API token, CLI 1.1.0. Shows a refused dry run, the fixed
dry runs, an import of notes (backdated creates and an append by id), an import of entries with one
item the server refuses, `week` showing the entries, and `undo --last-import` (refused without
`--yes`, then done).

```
# Setup: client OCT3017 with two contracts, a deliverable and work type, and a note to append to

$ chronolog client add October Co --code OCT3017
Created client OCT3017 October Co  id=4d70ba25-5fa3-4c08-b864-038106615475
(exit 0)

$ chronolog contract add OCT3017 Website
Created contract OCT3017/Website (October Co)  id=37662b28-620b-4951-848a-8b68f7dbf0a8
(exit 0)

$ chronolog contract add OCT3017 Retainer
Created contract OCT3017/Retainer (October Co)  id=5e139835-6565-413f-bdda-93cb08e17992
(exit 0)

$ chronolog deliverable add OCT3017/Website Discovery
Created deliverable OCT3017/Website/Discovery  id=b1d70f49-891d-4708-b56b-6dc10f0b9535
(exit 0)

$ chronolog work-type add OCT3017/Website/Discovery Interviews
Created work type OCT3017/Website/Discovery/Interviews  id=9f67bdfe-b7e5-4f45-b9c4-ab6bf4512cce
(exit 0)

$ chronolog note new OCT3017/Website Running log --date 2026-10-01
Created note OCT3017.20261001.001 in OCT3017/Website: Running log
(exit 0)

$ cat october-notes.jsonl
{"contract": "OCT3017/Website", "title": "Kickoff", "body": "Agreed scope and the October plan.", "date": "2026-10-05"}
{"contract": "OCT3017/Website", "title": "Interview round 1", "body": "Five interviews; themes below.\n\n- checkout friction\n- search", "date": "2026-10-07"}
{"contract": "OCT3017 retainer", "title": "Retainer check-in", "body": "Monthly check-in.", "date": "2026-10-09"}
{"id": "OCT3017.20261001.001", "append": "2026-10-09: interviews done, synthesis next."}

$ cat october-entries.jsonl
{"contract": "OCT3017/Website", "date": "2026-10-05", "duration": "1h30m", "description": "Kickoff", "note": "OCT3017.20261005.001"}
{"contract": "OCT3017/Website", "date": "2026-10-06", "duration": "2h", "description": "Interview prep", "deliverable": "Discovery"}
{"contract": "OCT3017/Website", "date": "2026-10-07", "startTime": "09:00", "endTime": "12:30", "description": "Interviews", "deliverable": "Discovery", "workType": "Interviews"}
{"contract": "OCT3017/Retainer", "date": "2026-10-08", "duration": "45m", "description": "Support tickets"}
{"contract": "OCT3017/Retainer", "date": "2026-10-09", "duration": "1:15", "description": "Check-in"}
{"contract": "OCT3017/Website", "date": "2026-10-09", "duration": "3h", "description": "Synthesis", "deliverable": "Research"}
{"contract": "OCT3017/Website", "date": "2026-10-10", "duration": "25h", "description": "Typo in the duration"}

# 1. Dry runs. Line 6 of the entries file names a deliverable that does not exist: the whole file is refused.

$ chronolog import entries october-entries.jsonl --dry-run
chronolog: 1 line of october-entries.jsonl cannot be imported; nothing was sent. Fix them and run again.
  line 6: No deliverable matches “Research”.
      Discovery  id=b1d70f49-891d-4708-b56b-6dc10f0b9535
(exit 3)

# Fixed line 6 in the file: deliverable "Research" -> "Discovery"

$ chronolog import entries october-entries.jsonl --dry-run
would create 1  2026-10-05 1h30m OCT3017/Website
    {"contractId":"37662b28-620b-4951-848a-8b68f7dbf0a8","date":"2026-10-05","duration":"1h30m","description":"Kickoff","noteId":"OCT3017.20261005.001"}
would create 2  2026-10-06 2h OCT3017/Website
    {"contractId":"37662b28-620b-4951-848a-8b68f7dbf0a8","date":"2026-10-06","duration":"2h","description":"Interview prep","deliverableId":"b1d70f49-891d-4708-b56b-6dc10f0b9535"}
would create 3  2026-10-07 09:00-12:30 OCT3017/Website
    {"contractId":"37662b28-620b-4951-848a-8b68f7dbf0a8","date":"2026-10-07","startTime":"09:00","endTime":"12:30","description":"Interviews","deliverableId":"b1d70f49-891d-4708-b56b-6dc10f0b9535","workTypeId":"9f67bdfe-b7e5-4f45-b9c4-ab6bf4512cce"}
would create 4  2026-10-08 45m OCT3017/Retainer
    {"contractId":"5e139835-6565-413f-bdda-93cb08e17992","date":"2026-10-08","duration":"45m","description":"Support tickets"}
would create 5  2026-10-09 1:15 OCT3017/Retainer
    {"contractId":"5e139835-6565-413f-bdda-93cb08e17992","date":"2026-10-09","duration":"1:15","description":"Check-in"}
would create 6  2026-10-09 3h OCT3017/Website
    {"contractId":"37662b28-620b-4951-848a-8b68f7dbf0a8","date":"2026-10-09","duration":"3h","description":"Synthesis","deliverableId":"b1d70f49-891d-4708-b56b-6dc10f0b9535"}
would create 7  2026-10-10 25h OCT3017/Website
    {"contractId":"37662b28-620b-4951-848a-8b68f7dbf0a8","date":"2026-10-10","duration":"25h","description":"Typo in the duration"}
Dry run: 7 time entries in 1 request; nothing sent.
(exit 0)

$ chronolog import notes october-notes.jsonl --dry-run
would create 1  OCT3017/Website 2026-10-05: Kickoff
    {"contractId":"37662b28-620b-4951-848a-8b68f7dbf0a8","title":"Kickoff","content":"# Kickoff\n\nAgreed scope and the October plan.\n","createdAt":"2026-10-05"}
would create 2  OCT3017/Website 2026-10-07: Interview round 1
    {"contractId":"37662b28-620b-4951-848a-8b68f7dbf0a8","title":"Interview round 1","content":"# Interview round 1\n\nFive interviews; themes below.\n\n- checkout friction\n- search\n","createdAt":"2026-10-07"}
would create 3  OCT3017/Retainer 2026-10-09: Retainer check-in
    {"contractId":"5e139835-6565-413f-bdda-93cb08e17992","title":"Retainer check-in","content":"# Retainer check-in\n\nMonthly check-in.\n","createdAt":"2026-10-09"}
would update 4  change: append
    {"id":"OCT3017.20261001.001","append":"2026-10-09: interviews done, synthesis next."}
Dry run: 4 notes in 1 request; nothing sent.
(exit 0)

# 2. Import notes, then entries (entry 1 links to the Kickoff note the notes import creates; line 7 fails on the server, the rest are saved)

$ chronolog import notes october-notes.jsonl
ok 1 OCT3017.20261005.001  OCT3017/Website 2026-10-05: Kickoff
ok 2 OCT3017.20261007.001  OCT3017/Website 2026-10-07: Interview round 1
ok 3 OCT3017.20261009.001  OCT3017/Retainer 2026-10-09: Retainer check-in
ok 4 OCT3017.20261001.001 (updated, unconditionally)  change: append
Imported 4 of 4 notes from october-notes.jsonl: 3 created, 1 updated, 0 failed.
(exit 0)

$ chronolog import entries october-entries.jsonl
ok 1 23a7c98e-fe87-4ad1-b356-3b7588614f81  2026-10-05 1h30m OCT3017/Website
ok 2 a1cc2d69-8f43-4eb8-aa13-7ef5e5a7887c  2026-10-06 2h OCT3017/Website
ok 3 f1532252-711a-4e1d-85ea-795cb93e1230  2026-10-07 09:00-12:30 OCT3017/Website
ok 4 9db86dcf-04d8-44a4-92f7-71fd44f66065  2026-10-08 45m OCT3017/Retainer
ok 5 d90f2e9b-381c-4c5c-93c4-8ddf7c79eca2  2026-10-09 1:15 OCT3017/Retainer
ok 6 3ea46875-a704-4d66-b91a-5d59c4a5890c  2026-10-09 3h OCT3017/Website
fail 7 invalid_duration One entry cannot be longer than 24 hours
Imported 6 of 7 time entries from october-entries.jsonl: 6 created, 0 updated, 1 failed.
chronolog: 1 of 7 items failed (line 7); the others are saved.
(exit 1)

$ chronolog week 2026-W41
Week 2026-W41 (2026-10-05 to 2026-10-11): 12h, status Unsubmitted

Mon 2026-10-05  1h30m
   1h30m  OCT3017/Website  Kickoff [[OCT3017.20261005.001]]

Tue 2026-10-06  2h
      2h  OCT3017/Website · Discovery  Interview prep

Wed 2026-10-07  3h30m
   3h30m  OCT3017/Website · Discovery  Interviews

Thu 2026-10-08  45m
     45m  OCT3017/Retainer  Support tickets

Fri 2026-10-09  4h15m
   1h15m  OCT3017/Retainer  Check-in
      3h  OCT3017/Website · Discovery  Synthesis
(exit 0)

$ chronolog note show OCT3017.20261001.001
OCT3017.20261001.001  Running log
Updated 2026-11-04T17:30:19.157Z

# Running log

2026-10-09: interviews done, synthesis next.
(exit 0)

# 3. Undo the entries import

$ chronolog undo --last-import
chronolog: The last import (october-entries.jsonl, 2026-11-04T17:30:19.289Z) created 6 time entries.
Not deleted: confirm with the owner, then run again with --yes.
(exit 2)

$ chronolog undo --last-import --yes
Deleted 6 time entries from the import of october-entries.jsonl.
(exit 0)

$ chronolog week 2026-W41
Week 2026-W41 (2026-10-05 to 2026-10-11): 0m, status Unsubmitted
No entries.
(exit 0)

```
