# Sprint 032-CL: `chronolog edit --work-type` transcript

Recorded 2026-11-04 against the worktree dev server (`http://localhost:5210`, shared dev Postgres) as a
fresh `qa-032-transcript-*` user, with `CHRONOLOG_BASE_URL` / `CHRONOLOG_API_TOKEN` in the environment.
The setup (client NWR, contract Study, deliverables Discovery and Recommendations, work types
Interviews and Survey under Discovery, Drafting under Recommendations) was built with the CLI too.

## Setup

```text
$ chronolog client add Northwind Research --code NWR
Created client NWR Northwind Research  id=14bc0f73-9228-459d-932d-9c14d02a46e9
[exit 0]

$ chronolog contract add NWR Study
Created contract NWR/Study (Northwind Research)  id=35ba35c8-6ce2-4fae-b6ac-8127921a2dbe
[exit 0]

$ chronolog deliverable add NWR/Study Discovery
Created deliverable NWR/Study/Discovery  id=a7ab9814-29c0-48e5-b282-8675d2104982
[exit 0]

$ chronolog deliverable add NWR/Study Recommendations
Created deliverable NWR/Study/Recommendations  id=db6a0e94-3b66-4dd0-aadb-55e65585e544
[exit 0]

$ chronolog work-type add NWR/Study/Discovery Interviews
Created work type NWR/Study/Discovery/Interviews  id=f9e08212-b9b8-4f8a-8f31-658ca371856d
[exit 0]

$ chronolog work-type add NWR/Study/Discovery Survey
Created work type NWR/Study/Discovery/Survey  id=4c83c993-744b-468c-96cf-f51d54dd895f
[exit 0]

$ chronolog work-type add NWR/Study/Recommendations Drafting
Created work type NWR/Study/Recommendations/Drafting  id=71fb486b-b4b3-4a8c-9717-e183deb2a23e
[exit 0]

$ chronolog log NWR/Study 1h30m Stakeholder interviews --date 2026-11-03 --deliverable Discovery --work-type Interviews
Logged 1h30m on 2026-11-03 to NWR/Study: Stakeholder interviews
id=b88dad33-7224-4481-abc1-d396d291bae0
[exit 0]

```

## Edit: success, mismatch (exit 3 with candidates), moving the pair, clearing

```text
$ chronolog edit b88dad33-7224-4481-abc1-d396d291bae0 --work-type survey
Updated 1h30m on 2026-11-03 NWR/Study [Discovery > Survey]: Stakeholder interviews
id=b88dad33-7224-4481-abc1-d396d291bae0
[exit 0]

$ chronolog edit b88dad33-7224-4481-abc1-d396d291bae0 --work-type Drafting
chronolog: No work type matches “Drafting” under deliverable “Discovery”.
  Interviews  id=f9e08212-b9b8-4f8a-8f31-658ca371856d
  Survey  id=4c83c993-744b-468c-96cf-f51d54dd895f
[exit 3]

$ chronolog edit b88dad33-7224-4481-abc1-d396d291bae0 --work-type Drafting --json
{"error":"No work type matches “Drafting” under deliverable “Discovery”.","code":"not_found","candidates":["Interviews  id=f9e08212-b9b8-4f8a-8f31-658ca371856d","Survey  id=4c83c993-744b-468c-96cf-f51d54dd895f"]}
[exit 3]

$ chronolog log NWR/Study 30m Wrong pair --date 2026-11-03 --deliverable Discovery --work-type Drafting
chronolog: No work type matches “Drafting” under deliverable “Discovery”.
  Interviews  id=f9e08212-b9b8-4f8a-8f31-658ca371856d
  Survey  id=4c83c993-744b-468c-96cf-f51d54dd895f
[exit 3]

$ chronolog edit b88dad33-7224-4481-abc1-d396d291bae0 --deliverable Recommendations --work-type Drafting
Updated 1h30m on 2026-11-03 NWR/Study [Recommendations > Drafting]: Stakeholder interviews
id=b88dad33-7224-4481-abc1-d396d291bae0
[exit 0]

$ chronolog edit b88dad33-7224-4481-abc1-d396d291bae0 --deliverable none
Updated 1h30m on 2026-11-03 NWR/Study: Stakeholder interviews
id=b88dad33-7224-4481-abc1-d396d291bae0
[exit 0]

$ chronolog edit b88dad33-7224-4481-abc1-d396d291bae0 --work-type Interviews
chronolog: This entry has no deliverable; give --deliverable X too (work types belong to a deliverable).
[exit 2]

```

## The API refuses a stale pair

The CLI never sends one (it resolves a work type only under the entry's deliverable, and a new
deliverable without `--work-type` clears the old work type), so this is the server's answer to a raw
`PATCH` that changes only the deliverable of an entry on Discovery > Interviews. Had the CLI
received it, it would print `chronolog: <error>` and exit 1.

```text
$ curl -X PATCH /api/time-entries/b88dad33-… -d '{"deliverableId":"<Recommendations>"}'
{"error":"Work type \"Interviews\" belongs to deliverable \"Discovery\", not \"Recommendations\"","code":"work_type_mismatch","message":"Work type \"Interviews\" belongs to deliverable \"Discovery\", not \"Recommendations\""}
HTTP 400
```
