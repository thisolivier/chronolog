# Decisions log

Short, dated records of decisions the owner has taken. Newest first. Sprint specs and reviews hold
the detail; this file is the index a new session reads first.

## 2026-11-03 — Production and security posture

- **Hosting:** app + Postgres containerised on the Mac mini (OrbStack). Hetzner/Coolify is dropped.
- **Exposure:** Cloudflare Tunnel on the existing `cloudflared` LaunchDaemon, hostname
  `chronolog.throb.online` → `http://localhost:3123` (confirmed by the owner 2026-11-03). Not Tailscale-only: the owner's VPN and Tailscale conflict
  unpredictably and access to the app wins. Cloudflare Access is **not** used, because a standalone
  Tauri build cannot carry Access credentials cleanly.
- **Gate instead of Access:** a self-managed device access key, following the music gateway's
  `X-API-Key` pattern. Only a hash lives on the box; browsers enter the key once on an unlock page and
  keep it as a long-lived HttpOnly cookie; the CLI and Tauri app send it as a header. Checked in the
  server hooks before login/register. Lockout and logging on failures; Cloudflare rate-limit rules on
  the unlock and login paths.
- **Encryption at rest:** application-level AES-256-GCM on note content and titles, time-entry
  descriptions, contract names and descriptions, client names, attachment bytes. Search and
  autocomplete over encrypted fields run in memory (single user, small data). **Key lives on the box**
  in the env file (owner's call: not concerned about physical theft; FileVault is off because the
  machine auto-logs-in to survive power cuts). Protects against leaked dumps, stolen backups and
  copied volumes, not against a shell on the box.
- **Binding:** app listens on `127.0.0.1:3123` only; production Postgres publishes no port; dev
  Postgres binds to `127.0.0.1`. Port 3123 is the first entry in `docs/ports.md`.
- **Registration:** closed by default (`ALLOW_REGISTRATION=true` to open for first-account setup).
- **Offline:** PowerSync removed (sprint 021). Long-lived read cache + write outbox with
  last-write-wins per field, a visible "replayed" marker, and a held queue with a prompt when the
  server copy changed meanwhile (built in sprint 045-CL: read cache in IndexedDB, outbox in
  localStorage, SvelteKit service worker for the app shell; no new dependency).
- **Laptop Claude access:** plain REST with a long-lived API token, a small CLI and a project skill.
  MCP deferred until a shell-less client (Claude Desktop, phone) needs it.
- **Backups:** daily `pg_dump -Fc` via launchd to `~/Backups/chronolog`, mirrored to the Rabbit4TB
  volume when mounted; restore tested before go-live.
- **Deferred, needs the owner at the keyboard:** SSH key-only, Screen Sharing restricted to the
  Tailscale interface. Lockout risk means these are done together, not unattended.

## 2026-11-03 — Process

- The Director / Team PM sprint framework is retired. Fable orchestrates directly; Opus agents do
  implementation and review, Haiku agents do mechanical work. Sprint specs remain as plain docs.
- Stabilise, do not rebuild (three reviews in `docs/review/`).


## 2026-11-04 — Cloudflare hostname live; no WAF rate-limit rule

`chronolog.throb.online` → `http://localhost:3123` is published through the dashboard-managed tunnel and
verified with curl from the laptop. The Cloudflare plan has no WAF rate limiting, so the documented rule
is not applied; the app's own limiters (Better Auth auth-path limit, device-gate lockout, token failure
limiter) are the protection. Secrets have been moved to the owner's password manager and the secrets
file removed from the box.

## 2026-11-04 — Go-live complete

First account registered with TOTP 2FA, then `ALLOW_REGISTRATION=false` set in `.env.prod` and the stack
redeployed at `9a6e5d8` (sprints 029 and 030 included). Pre-change backup taken. Registration is closed;
reopen only for one account at a time by flipping the flag and redeploying.

## 2026-11-04 — Archived contracts stay writable; bare integers are minutes

Archived clients and contracts are not read-only: notes and entries can still be created and edited on
them (033 follow-up closed). A bare integer duration stays minutes (`8` is 8 minutes; 025 follow-up
closed).

## 2026-11-04 — No timer pause; iOS build

The timer will not get pause back (025 follow-up closed). An iOS build is next: a Tauri 2 iOS shell
loading production like the macOS menu-bar app, shipped to TestFlight with the release lane from
`~/sites/timeConvertor` (xcodegen, `ExportOptions.plist`, altool upload, shared signing in
`~/sites/navidromClient/spike/.signing`). iOS bundle id `dev.thisolivier.chronolog` via
`tauri.ios.conf.json`; the desktop app keeps `com.chronolog.app` so its stored data and device key stay put.
Preceded by a UI pass at iPhone sizes.

## 2026-11-04 — PWA alongside the iOS shell

The web app is now a proper installable PWA: `static/manifest.webmanifest` (standalone, Chronolog
blue `#2563eb`), Apple home-screen tags and icons cut from the iOS app icon (the old `pwa-*.png` were
placeholders). The owner runs it side by side with the Tauri iOS shell as an experiment; whichever
wins decides whether the TestFlight lane is kept.

## 2026-11-07 — Design overhaul r1: four decisions before stage 2

The engineering spec pack (`docs/design/r1/`, revision 1 of 7 Nov 2026) left thirteen open items. The
owner settled the four that blocked the token and identity work:

- **Contract identity marks (O02 / DS-07): keep it minimal for now.** Ship the earth-tone reskin with
  solid colour marks (client colour plus contract initials) rather than procedural or hand-drawn
  pattern tiles. The DS-04 pattern placements (timer header repeat, selected-contract repeat, notes
  list and editor header repeats) are deferred to a later sprint; the layout must leave room for them.
- **Typography (O01): system sans stack.** `-apple-system`/SF Pro on Mac and iOS, Segoe/Roboto
  elsewhere. No bundled font. Hierarchy comes from weight, size and colour.
- **Branch strategy: integration branch `design-r1`, merged to main at coherent checkpoints.** Each
  stage runs in its own worktree and merges into `design-r1`; `design-r1` merges to main (and
  deploys) only when the result looks consistent: first tokens + shell + sidebar + notes headers,
  then capture/split, then review, then search. Production never shows a half-styled mix.
- **Week numbering (O05 / TR-07): Week 1 is the Monday-start week that contains 1 January.** 29 Dec
  2025 to 4 Jan 2026 is 2026 Week 1. Replaces ISO numbering in the label; the storage and URL keys
  are decided in the time-review stage.

## 2026-11-07 — Week keys: the Monday is the identity, `YYYY-Www` keys use the new numbering (057-DR)

The owner's rule (Week 1 contains 1 January) needed a storage and URL key. Chosen, with no schema
migration: a week is identified by its **Monday date** everywhere (`weekly_statuses.week_start`, which
every row already stored); statuses are looked up by it. `/time/YYYY-Www`, `GET /api/me` (`week`, with
`isoWeek` kept as an alias of the same value) and the CLI keep the `YYYY-Www` form, numbered by the new
rule. Why: the two numberings agree for every week of 2024–2026, so existing bookmarks and stored rows
mean the same week; the first difference is 28 Dec 2026 (ISO 2026-W53, now 2027 Week 1). The only ISO
key that no longer exists, a week 53 in a 52-week year, still opens the same Monday's week.
`year`/`week_number` stay as stored labels; a status write renumbers any ISO-numbered row first so the
unique key cannot collide. Rejected: `/time/<monday-date>` URLs (every bookmark and the CLI's `2026-W45`
arguments would change for no gain while the numberings agree). See `docs/sprints/sprint-057-DR.md`.
