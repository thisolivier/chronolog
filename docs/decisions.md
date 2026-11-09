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

## 2026-11-07 — Week numbering: ISO 8601 after all (061-DR)

Supersedes the two entries above on week numbering (O05 / TR-07, "Week 1 is the Monday-start week
that contains 1 January", and its 057-DR key decision as far as numbering goes). After discussing what
ISO weeks are, the owner chose **ISO 8601** for every label, `/time/YYYY-Www` URL, `GET /api/me`
(`week` and `isoWeek`, both ISO, same value), the weekly-status API and the CLI: weeks start Monday
and week 1 contains the year's first Thursday, so 28 Dec 2026 – 3 Jan 2027 is 2026-W53 and 2027-W01
starts 4 Jan 2027. ISO is what clients, payroll, calendars and `date +%V` use, so a submitted week's
number matches theirs. The Monday date stays the week's identity.

**Storage unchanged, no migration.** Statuses are looked up by `weekly_statuses.week_start`. The
calendar-year rule (v1.5.0, live for one evening) agrees with ISO for every week up to 21 Dec 2026, so
every stored row's `year`/`week_number` is already its ISO number; a row a v1.5.0 client might still
write for a later week is renumbered to ISO by the existing step before the next status write (it
reads the user's rows once and writes only rows that differ; a no-op today). `calendar-week.ts` and
the legacy-URL redirect are deleted: ISO keys are canonical again, and v1.5.0's URLs equal ISO's
through 2026. The "update every CLI before 28 Dec" warning is withdrawn: an older (pre-1.5.0) CLI is
ISO already. See `docs/sprints/sprint-061-DR.md`.

## 2026-11-07 — Home button and history buttons

"Chronolog" is ever present at the top left of the app bar and acts as the home button, on desktop,
tablet and phone. The back and forward history buttons sit immediately to its right. The phone's
"← Back" / "← Chronolog" top-left label, which hid the home affordance behind history navigation, is
replaced by this layout (sprint 062-DR). The owner also dropped the phone timesheet's Start timer and
Add Entry buttons as nice-to-haves that cost space (sprint 060-DR); the header pill and the home
screen widget give timer access on the phone.

## 2026-11-08 — Contract pattern tiles un-deferred (063-DR)

The owner: "Generate some tiles and finish off the contract tile UI elements. I'll replace them
eventually, but we're looking at one-colour cutouts." This lifts the 2026-11-07 deferral of DS-03 /
DS-04 / DS-07 for a placeholder set; the minimal-mark decision above is superseded as far as the
mark's content goes (colour still names the client).

- **Procedural one-colour cutouts, no new dependency.** 32 square motifs authored as plain SVG
  shapes in `src/lib/components/identity/tile-library.ts`, each checked at the 16 px mark size on a
  contact sheet. Drawn as a CSS mask over the client colour, so one source square serves the mark
  and every repeat (edge to edge, clipped, never stretched).
- **Deterministic allocation, no migration.** A contract's motif is FNV-1a (32-bit) of its id modulo
  the library size, computed wherever a mark is drawn. Nothing is stored and no payload gained a
  new field from the database. Two contracts, even of the same client, can share a motif; accepted
  for now.
- **Persisted assignment later.** A stored `contracts.pattern_index` with sibling-collision
  avoidance and a reassignment control in Settings (O13) is on the backlog; it needs a migration and
  so the owner's approval first. Changing the library's order or size reshuffles every contract
  until then.
- **Placements (DS-04):** the timer header's 1.5-tile region, the selected sidebar row's quiet
  repeat, the notes list header (one contract's list only) and the note editor header (not in the
  single-column phone layout). No repeats on time-entry rows, search rows or note bodies. See
  `docs/sprints/sprint-063-DR.md`.

## 2026-11-08 — Owner polish round after v1.6.0 (064-DR)

Seven small changes, with "feel free to carry these over to the non-noted platform where it makes
sense". Recorded here because three of them retire earlier design decisions:

- **No running light.** The pulsing green dot (TC-02, O03 pulse timing, "RECORDING text removed;
  running dot pulses") is withdrawn: "the clock ticking is enough feedback." `TimerPulseDot` is
  deleted. On review the owner removed the split-time overlay's static dot too, and with it
  `--color-running`: no running colour anywhere.
- **The timer heading is the contract picker.** The running panel's "Contract" field is gone.
  With no contract the header shows no tile region, "No contract yet" and a "Select" link; with
  one, the tile, names and "Change". Either link opens a dropdown of contracts at that spot;
  clicking away, Escape or collapsing cancels. The chevron still never chooses (053-DR).
- **Headers lose what the sidebar already says.** When the sidebar names the contract, the notes
  list header is one row: sort toggle, the contract's repeat, a borderless New note icon (kept
  the primary green on review). The
  editor header's repeat fills its row (the 063-DR ten-tile cap is lifted). Linked time has no
  heading; a clock glyph marks each row and unlinking asks inline first.
- **Timesheet bars edge to edge**, text where it was; entry times end on the day total. On the
  phone the row's icons moved before the time rather than insetting the total (see the sprint doc).

Details, measurements and screenshots: `docs/sprints/sprint-064-DR.md`.
