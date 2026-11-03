# Chronolog

Time-tracking and note-taking app for consulting work. Delivered as a Tauri 2.0 desktop app (macOS primary) with a PWA fallback for mobile.

Built with SvelteKit, Svelte 5, Tailwind CSS v4, PostgreSQL (Drizzle ORM), TipTap editor, and Better Auth with TOTP 2FA.

## Documentation

Project documentation lives in the [`docs/`](docs/) directory:

- **[SPEC.md](docs/SPEC.md)** — Full project specification (data model, tech stack, architecture, security)
- **[UI-SPEC.md](docs/UI-SPEC.md)** — UI specification (three-panel layout, timer widget, mobile layout)
- **[platform-abstraction.md](docs/platform-abstraction.md)** — Storage and window management abstraction for Tauri + PWA
- **[DEPLOYMENT.md](docs/DEPLOYMENT.md)** — Building and deploying for production

The live backlog is in [`docs/backlog.md`](docs/backlog.md). The root [`BACKLOG.md`](BACKLOG.md) is the original long-form task list.

## Working with Chronolog from a laptop

To log time, write client notes and check a week from a laptop with Claude Code, use the `chronolog` CLI together with the project's `chronolog-secretary` skill (`.claude/skills/chronolog-secretary/SKILL.md`). The one-time setup for each laptop is in [docs/ONBOARDING.md](docs/ONBOARDING.md): the device access key, a personal API token created in Settings, and the CLI install. Each laptop has its own token, so a lost laptop can be revoked without touching the others.

## Dev Environment Setup

### Prerequisites

- **Node.js** (v20+) and npm
- **Docker** and Docker Compose (for PostgreSQL)
- **Rust** toolchain (for Tauri desktop builds)
- **Xcode Command Line Tools** (macOS — `xcode-select --install`)

### Installing the Rust toolchain

If you don't already have Rust installed:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Follow the prompts (defaults are fine), then activate it in your current shell:

```bash
source "$HOME/.cargo/env"
```

Verify with `rustc --version`. Rustup will manage updates via `rustup update`.

### First-time setup

```bash
# 1. Clone the repo
git clone <repo-url> && cd chronolog

# 2. Install Node dependencies
npm install

# 3. Copy environment variables
cp .env.example .env
# Edit .env — see "Environment variables" below; the Postgres defaults match docker-compose.yml

# 4. Start PostgreSQL (Docker)
docker compose up -d postgres

# 5. Run database migrations
npm run db:migrate

# 6. Seed sample data (optional)
npm run db:seed

# 7. Start the dev server (web only)
npm run dev

# 8. Or start the Tauri desktop app (requires Rust)
npm run tauri:dev
```

The web app is available at `http://localhost:5173`. The Tauri app opens as a native window.

Alternatively, `docker compose up -d` (no service name) also starts a containerised app on port 5173 with hot reload, so you can skip `npm run dev`.

### Environment variables

`.env` is gitignored; `.env.example` lists every key. The app **refuses to boot** without the required ones.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | yes | PostgreSQL connection string (`postgresql://chronolog:chronolog@localhost:5432/chronolog` for the Docker Postgres) |
| `BETTER_AUTH_SECRET` | yes | Session signing secret (`openssl rand -base64 32`) |
| `ENCRYPTION_KEY` | yes | 256-bit key for encryption at rest (`openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | yes | Public URL of the app (`http://localhost:5173` in dev) |
| `ALLOW_REGISTRATION` | no | Registration is closed unless this is `true`. Set it to create your account, then unset it |
| `TRUSTED_ORIGINS` | no | Comma-separated extra origins Better Auth accepts (e.g. a Tailscale IP) |

### Resuming development

```bash
docker compose up -d postgres   # start PostgreSQL if not running
npm run dev                     # or: npm run tauri:dev
```

### Useful commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start SvelteKit dev server |
| `npm run tauri:dev` | Start Tauri desktop app (dev mode) |
| `npm run build` | Build SvelteKit for production |
| `npm run tauri:build` | Build Tauri desktop app for distribution |
| `npm run check` | Run svelte-check (type checking) |
| `npm run lint` | Run ESLint |
| `npm run test` | Run tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run db:generate` | Generate a new Drizzle migration |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed` | Seed sample data |
| `npm run db:studio` | Open Drizzle Studio (DB browser) |

## Project Structure

```
chronolog/
├── src/                  # SvelteKit application source
│   ├── routes/           #   Page routes and API endpoints
│   ├── lib/              #   Shared libraries, components, server code
│   └── hooks.server.ts   #   Auth guard and user sync hook
├── src-tauri/            # Tauri 2.0 desktop shell (Rust config)
├── static/               # Static assets served by SvelteKit
├── drizzle/              # Database migration files (PostgreSQL)
├── docs/                 # Project documentation
├── docker-compose.yml    # Local dev stack (PostgreSQL + optional containerised app)
├── docker-compose.prod.yml # Production stack (app + PostgreSQL)
├── drizzle.config.ts     # Drizzle ORM configuration
├── svelte.config.js      # SvelteKit configuration
├── vite.config.ts        # Vite build configuration
├── tsconfig.json         # TypeScript configuration
├── eslint.config.js      # ESLint configuration
├── package.json          # Dependencies and npm scripts
├── .env.example          # Environment variable template
├── CLAUDE.md             # AI assistant configuration
└── BACKLOG.md            # Original long-form task list (live backlog: docs/backlog.md)
```
