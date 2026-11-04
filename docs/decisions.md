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
