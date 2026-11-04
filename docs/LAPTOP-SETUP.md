# Laptop setup: from a running Mac mini to a working secretary

Written 2026-11-04. One page that takes you from "the production stack is up on the Mac mini" to
"Claude Code on my laptop logs my hours". Do the steps in order; each one depends on the last.
The longer references are [DEPLOYMENT.md](DEPLOYMENT.md) (server side) and
[ONBOARDING.md](ONBOARDING.md) (devices, key rotation, restore).

Where things stand as of writing:

- The production stack runs on the Mac mini: `chronolog-prod-app` on `127.0.0.1:3123` and
  `chronolog-prod-postgres` with no published port. Nightly backups run at 03:30.
- The database is empty and registration is **open** until the first account exists.
- Nothing reaches the app from outside the Mac mini until the Cloudflare hostname exists (step 1).
- The Mac mini is `100.110.206.54` on the tailnet, user `olivier`.

## 1. Cloudflare: route the hostname to the box

The tunnel on the Mac mini is the existing `cloudflared` LaunchDaemon and is dashboard-managed, so
nothing on the box changes. Everything here is in the Cloudflare dashboard.

**Public hostname.** Zero Trust → Networks → Tunnels → the Mac mini tunnel → Public Hostname →
Add a public hostname:

| Field | Value |
|---|---|
| Subdomain | `chronolog` |
| Domain | `throb.online` |
| Path | empty |
| Service | `HTTP` → `localhost:3123` |

Saving it creates a proxied CNAME `chronolog` → `<tunnel-id>.cfargotunnel.com`. Check it is listed
under DNS → Records with the orange cloud on. Do **not** add Cloudflare Access to this hostname: the
device key and the login are the gate, and a future Tauri build cannot carry Access credentials.

**Rate-limit rule (optional).** Skipped on 2026-11-04 because the plan has no WAF rate limiting;
the app's own limiters (Better Auth, the device-gate lockout, the token limiter) cover it. For
reference, Security → WAF → Rate limiting rules → Create rule:

| Setting | Value |
|---|---|
| Name | `chronolog auth endpoints` |
| Expression | `(http.host eq "chronolog.throb.online" and http.request.method eq "POST" and (http.request.uri.path in {"/login" "/unlock"} or starts_with(http.request.uri.path, "/api/auth/")))` |
| Characteristics | IP |
| Rate | 10 requests per 1 minute (or per 10 seconds if that is all the plan offers) |
| Action | Block for 10 minutes (or the longest the plan allows) |

**Check from the laptop:**

```bash
curl -sI https://chronolog.throb.online/login | head -1     # HTTP/2 200 (or 302 to /unlock)
curl -s  https://chronolog.throb.online/api/clients          # {"error":"Device not authorised",...}
```

## 2. Secrets into the password manager

The raw secrets are in one file on the Mac mini, mode 600. Copy it to the laptop, put the four
values into the password manager, then delete both copies.

```bash
scp olivier@100.110.206.54:/Users/olivier/sites/chronolog-prod/SECRETS-move-to-password-manager.txt ~/Desktop/
# ... save DEVICE_ACCESS_KEY, ENCRYPTION_KEY, BETTER_AUTH_SECRET and POSTGRES_PASSWORD ...
rm ~/Desktop/SECRETS-move-to-password-manager.txt
ssh olivier@100.110.206.54 rm /Users/olivier/sites/chronolog-prod/SECRETS-move-to-password-manager.txt
```

The `ENCRYPTION_KEY` is the one that matters most: without it the nightly backups are unreadable.
`.env.prod` on the box keeps a copy for the running stack, and only the hash of the device key.

## 3. First account, in a browser

1. Open `https://chronolog.throb.online/unlock` and enter the device access key. The browser keeps
   it as a one-year HttpOnly cookie. Five wrong keys from one IP lock that IP out for 15 minutes.
2. Open `/register` and create the account. Then enable 2FA under Settings.
3. Tell the Claude session on the Mac mini that the account exists. It sets
   `ALLOW_REGISTRATION=false` in `.env.prod` and redeploys, which also brings production up to the
   current `main`. After that `/register` reports closed and only the owner can add accounts by
   reopening it.

## 4. Create the laptop's API token

In the browser: Settings → API tokens (`/settings/api-tokens`). Name it after the laptop. The token
is shown once; put it in the password manager. Each laptop gets its own token, so a lost laptop is
revoked alone without touching the others.

## 5. Clone the repo on the laptop

```bash
git clone git@github.com:thisolivier/chronolog.git ~/sites/chronolog
```

Why a clone and not just a binary: the CLI is a single dependency-free script at `cli/chronolog.mjs`,
and the secretary skill lives at `.claude/skills/chronolog-secretary/SKILL.md`. Both are versioned
with the API they talk to, so a `git pull` keeps the laptop in step with whatever is deployed. Claude
Code only loads project skills from the repo it is opened in, and the repo also gives the laptop
Claude the project docs for context. Nothing else from the repo is needed on the laptop: no
`npm install`, no Postgres, no dev server.

Put the CLI on the PATH (Node 20 or newer; the script has a shebang and is executable):

```bash
mkdir -p ~/.local/bin
ln -s ~/sites/chronolog/cli/chronolog.mjs ~/.local/bin/chronolog
grep -q '.local/bin' ~/.zshrc || echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
chronolog --help
```

`/usr/local/bin` is root-owned on macOS (and may not exist on Apple Silicon), so linking there
needs `sudo`; a user-owned directory on the PATH avoids that. On an Apple Silicon Mac with Homebrew,
`/opt/homebrew/bin` is user-owned and already on the PATH, so `ln -s … /opt/homebrew/bin/chronolog`
also works.

## 6. `chronolog init`

```bash
chronolog init
```

It asks for the server URL (Enter keeps `https://chronolog.throb.online`), the API token and the
device key, with hidden input, then writes `~/.config/chronolog/config.json` with mode 600 and checks
the connection. Then:

```bash
chronolog me           # who the token belongs to, today, the current ISO week
chronolog clients      # short codes and ids; empty until you add clients under Settings
```

Clients, contracts, deliverables and work types can be added in the browser under Settings →
Clients and contracts, or with the CLI (`chronolog client add …`, see the quick reference below).

## 7. A secretary workspace, separate from the repo

The clone exists to provide the CLI and the skill; it is not where the secretary session should
run. The repo's `CLAUDE.md` is written for development (sub-agents, tests, worktrees) and none of it
applies to logging hours. Make a small directory of your own and point its skill at the clone:

```bash
mkdir -p ~/secretary/.claude/skills
ln -s ~/sites/chronolog/.claude/skills/chronolog-secretary ~/secretary/.claude/skills/chronolog-secretary
cat > ~/secretary/CLAUDE.md <<'TXT'
# Secretary

This directory is the owner's assistant workspace. Chronolog (time and client notes) is reached
through the `chronolog` CLI and the `chronolog-secretary` skill; never edit its database or call
its API directly. Keep working files here, not in ~/sites/chronolog.
TXT
```

Claude Code keeps session history and memory per directory under `~/.claude/projects/`, so
everything the secretary does stays under `~/secretary`. Later skills (Airtable hours, invoices)
and their templates live here too. Do not make a branch in the clone for this: it isolates
nothing and turns every update into a merge.

## 8. Use it from Claude Code

Open Claude Code in `~/secretary` on the laptop. The `chronolog-secretary` skill triggers on
things like "log 2h on the Acme work", "write up today's call for Acme", or "what did I do this
week". It will not guess a contract: when two fit it asks. It never asks you to paste the token or
key into the chat; if it reports "No server configured", run `chronolog init` yourself.

Quick reference:

```
chronolog log ACME/Website 1h30m "Checkout review" [--date yesterday] [--deliverable X] [--note ID]
chronolog edit <entry-id> --duration 2h
chronolog undo                      # deletes the last entry this laptop logged
chronolog import entries october.jsonl --dry-run   # then without --dry-run; notes too (import notes)
chronolog undo --last-import        # deletes every entry of the last import (asks first)
chronolog note new ACME/Website "Status 4 Nov" --file body.md [--date yesterday]
chronolog note append <note-id> --file update.md   # or note edit <id> [--title] [--contract]; exit 7 = changed in the app
chronolog note delete <note-id>    # asks first; copy kept in ~/.config/chronolog/trash/, note restore <id>
chronolog note attach <note-id> ~/Downloads/SOW.pdf   # PDF or image ≤ 10 MB; appends a link to the note
chronolog note attachments <note-id>; chronolog attachment get <id> [--out DIR]; attachment delete <id>
chronolog --version                 # CLI version; `chronolog me` also shows the server's
chronolog week [2026-W45] [--client ACME]
chronolog status current draft-ready

# Setting up a client (short codes are yours to choose; remove asks first, -y skips it)
chronolog client add "Acme Ltd" --code ACME [--emoji 🚀]
chronolog contract add ACME "Website" [--description "..."]
chronolog deliverable add ACME/Website "Phase 1"
chronolog work-type add "ACME/Website/Phase 1" "Design"   # alias: tag add
chronolog log ACME/Website 1h "Wireframes" --deliverable "Phase 1" --work-type Design
chronolog client archive ACME       # or unarchive; contract archive|unarchive ACME/Website
chronolog client edit ACME --name "Acme Limited"
chronolog deliverables ACME/Website; chronolog work-types "ACME/Website/Phase 1"
chronolog client remove ACME        # entries move to Deleted Client; prefer archive
```

Durations: `1h30m`, `1.5`, `1:30`, `90m`, `9:00-10:30`. Dates: `YYYY-MM-DD`, `today`, `yesterday`,
`monday`.

## 9. Optional: the desktop app

A macOS app with the running timer in the menu bar, built from the same clone. Steps, including
copying a build from the Mac mini: [DESKTOP.md](DESKTOP.md).

## Updating

Server: a sprint merges to `main`, and the Mac mini session runs `scripts/deploy-prod.sh` from the
production checkout (backup first). Laptop: `git pull` in `~/sites/chronolog`. The `chronolog`
command is a symlink into the clone and the skill is a file in it, so the next command and the
next Claude session use the new code. No reinstall, no shell restart.

## If something fails

| Response | Meaning | Fix |
|---|---|---|
| curl in step 1 times out or returns a Cloudflare error page | hostname not routed, or tunnel down | re-check the public hostname; on the box `pgrep -fl cloudflared` |
| 401 `device_not_authorised` | device key missing or wrong | run `chronolog init` again |
| 401 `invalid_token` | token wrong or from another server | create a new token, `chronolog init` |
| 403 `token_revoked` | that laptop's token was revoked | create a new token, `chronolog init` |
| 429 `device_locked` | five wrong device keys from this IP | wait 15 minutes |
| `/register` says closed | registration already closed | ask the Mac mini session to reopen it for one account |

Key rotation and restoring from backup are in [ONBOARDING.md](ONBOARDING.md).
