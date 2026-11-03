# Sprint 028-CL verification transcript

Run on 2026-11-03 against the worktree dev server (`http://localhost:5206`) started with
`ALLOW_REGISTRATION=true BETTER_AUTH_URL=http://localhost:5206` **and a throwaway
`DEVICE_ACCESS_KEY_HASH`**, so the device gate was on and every CLI call went through
`X-Device-Key`. QA user: `qa-028-zaf7h6@chronolog.test` (fresh account, shared dev Postgres).
`chronolog` is `node cli/chronolog.mjs` from the worktree. No token or key value appears below:
`init` read them from files on stdin, and the transcript was grepped for both values (0 hits).

## 1. Browser: unlock, sign up, create a token (screenshots 01-02)

- `/unlock` with the device key, then sign-up; Acme Ltd (`ACME`) with contracts Website and Retainer
  created through `POST /api/contracts`.
- Settings shows the new **API tokens** card (`01-settings-api-tokens-card.png`).
- Created "MacBook CLI": the raw token is shown once with Copy/Done
  (`02-token-created-shown-once-masked.png`; the value was masked in the DOM before the shot).

## 2. Laptop CLI

```text
$ chronolog init      # answers piped in: server URL, API token, device key (values not shown)
Saved $SCRATCH/laptop-config.json (mode 600). Connected to http://localhost:5206 as qa-028-zaf7h6@chronolog.test; today is 2026-11-03, week 2026-W45.
[exit 0]
$ stat -f '%Sp' $CHRONOLOG_CONFIG
-rw-------

$ chronolog me
QA 028 <qa-028-zaf7h6@chronolog.test> via token
Today 2026-11-03 (America/Los_Angeles), week 2026-W45: 2026-11-02 to 2026-11-08
[exit 0]

$ chronolog clients
ACME     Acme Ltd  id=30201cbc-4ad6-4119-a37a-830f13673039
INTL     Internal  id=552b045a-5481-47f0-9d1c-c92622f25d80
[exit 0]

$ chronolog contracts
INTL/General (Internal)  id=6ac8349b-e201-432d-b349-5cbb9efe7d31
ACME/Website (Acme Ltd)  id=fefcb0c1-f47f-4547-9d8f-a29350742548
ACME/Retainer (Acme Ltd)  id=f02b8271-cffc-4990-ace2-ce026f027df1
[exit 0]

$ chronolog log acme 1h Ambiguous on purpose
chronolog: “acme” matches 2 contracts; be more specific or use an id.
  ACME/Website (Acme Ltd)  id=fefcb0c1-f47f-4547-9d8f-a29350742548
  ACME/Retainer (Acme Ltd)  id=f02b8271-cffc-4990-ace2-ce026f027df1
[exit 3]

$ chronolog note new ACME/Website "Status: checkout redesign" < status-body.md
Created note ACME.20261103.030 in ACME/Website: Status: checkout redesign
[exit 0]

$ chronolog log ACME/Website 1h30m Checkout flow review with Dana --note ACME.20261103.030
Logged 1h30m on 2026-11-03 to ACME/Website: Checkout flow review with Dana [[ACME.20261103.030]]
id=ff340950-eaf7-41e9-a968-a738819ffc1d
[exit 0]

$ chronolog log acme retainer 9:00-9:45 Monthly retainer call --date yesterday
Logged 45m (09:00-09:45) on 2026-11-02 to ACME/Retainer: Monthly retainer call
id=50023a70-b405-402a-8ff5-e94ec38d5359
[exit 0]

$ chronolog week --client ACME
Week 2026-W45 (2026-11-02 to 2026-11-08) for Acme Ltd: 2h15m, status Unsubmitted

Mon 2026-11-02  45m
     45m  ACME/Retainer  Monthly retainer call

Tue 2026-11-03  1h30m
   1h30m  ACME/Website  Checkout flow review with Dana [[ACME.20261103.030]]
[exit 0]

$ chronolog note show ACME.20261103.030
ACME.20261103.030  Status: checkout redesign
Updated 2026-11-03T21:32:14.360Z

# Status: checkout redesign

## Done
- Reviewed the checkout flow with Dana; agreed to drop the guest step.
## Next
- Prototype by Friday.

Linked time entries:
  2026-11-03  1h30m  Checkout flow review with Dana [[ACME.20261103.030]]
[exit 0]

$ chronolog search checkout
ACME.20261103.030  ACME/Website  Status: checkout redesign
[exit 0]
```

## 3. Browser: the CLI's work in the app (screenshots 03-05)

- `03-cli-entries-in-week-with-linked-note.png`: week 45 shows both CLI entries; Tuesday's entry
  carries the note link "Status: checkout redesign" (from `--note`), Monday's has its 09:00-09:45 range.
- `04-cli-note-in-contract-list.png`: Website's note list shows the CLI note by title (markdown preview
  fallback; before this sprint it would have read "Untitled").
- `05-cli-note-opened-in-editor.png`: the note opens in the editor with headings and lists, and its
  "Linked time entries" panel lists the CLI entry.

## 4. Revoke, then 403 (screenshot 06)

`06-token-revoked.png`: Revoke in Settings → the row shows "revoked".

```text
$ chronolog clients        # after "Revoke" in Settings → API tokens
chronolog: This API token has been revoked; create a new one in Settings
  (check the API token and device key; `chronolog init` to replace them)
[exit 4]

$ chronolog me --json
{"error":"This API token has been revoked; create a new one in Settings","code":"token_revoked","status":403}
[exit 4]

$ curl -s -w " %{http_code}\n" http://localhost:5206/api/me        # no device key header
{"error":"Device not authorised","code":"device_not_authorised","message":"Device not authorised"} 401

$ curl -s -w " %{http_code}\n" -H "X-Device-Key: $KEY" http://localhost:5206/api/me      # key, no token
{"error":"Unauthorized: sign in or send an API token","code":"unauthorized","message":"Unauthorized: sign in or send an API token"} 401
```

## 5. Regression checks

- `npm run check`: 0 errors (3 pre-existing warnings in `src/routes/+layout.svelte`).
- `npm test`: 54 files, 504 tests passed. `npm run lint`: clean.
- `npm run test:e2e` against `http://localhost:5206`: 9 files, 64 tests passed (11 new in
  `api-tokens-cli.e2e.test.ts`, including the CLI run as a child process).
- Checklist driver `QA_BASE_URL=http://localhost:5206 node e2e-playwright/manual-checklist/qa-driver.mjs`
  (server restarted without the device hash, as the driver expects): **65 pass / 0 fail**. Its 10
  console errors and 26 failed requests are navigation aborts and the driver's own offline simulation.
