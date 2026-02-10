# Chronolog

Time-tracking and note-taking app for consulting work. Delivered as a Tauri 2.0 desktop app (macOS primary) with a PWA fallback for mobile.

Built with SvelteKit, Svelte 5, Tailwind CSS v4, PostgreSQL (Drizzle ORM), TipTap editor, and Better Auth with TOTP 2FA.

## Documentation

Project documentation lives in the [`docs/`](docs/) directory:

- **[SPEC.md](docs/SPEC.md)** — Full project specification (data model, tech stack, architecture, security)
- **[UI-SPEC.md](docs/UI-SPEC.md)** — UI specification (three-panel layout, timer widget, mobile layout)
- **[platform-abstraction.md](docs/platform-abstraction.md)** — Storage and window management abstraction for Tauri + PWA
- **[DEPLOYMENT.md](docs/DEPLOYMENT.md)** — Building and deploying for production

The current task backlog is in [`BACKLOG.md`](BACKLOG.md) at the project root.

## Dev Environment Setup

### Prerequisites

- **Node.js** (v20+) and npm
- **Docker** (for local PostgreSQL)
- **Rust** toolchain (for Tauri desktop builds — `rustup` recommended)

### First-time setup

```bash
# 1. Clone the repo
git clone <repo-url> && cd chronolog

# 2. Install Node dependencies
npm install

# 3. Copy environment variables
cp .env.example .env
# Edit .env — the defaults work for local dev with Docker

# 4. Start PostgreSQL (Docker)
docker context use desktop-linux   # required on macOS with Docker Desktop
docker compose up -d

# 5. Run database migrations
npm run db:migrate

# 6. Seed sample data (optional)
npm run db:seed

# 7. Start the dev server
npm run dev
```

The app is available at `http://localhost:5173`.

To run the Tauri desktop app instead:

```bash
npm run tauri:dev
```

### Resuming development

```bash
docker compose up -d    # start PostgreSQL if not running
npm run dev             # or: npm run tauri:dev
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
├── docker-compose.yml    # Local dev PostgreSQL container
├── drizzle.config.ts     # Drizzle ORM configuration
├── svelte.config.js      # SvelteKit configuration
├── vite.config.ts        # Vite build configuration
├── tsconfig.json         # TypeScript configuration
├── eslint.config.js      # ESLint configuration
├── package.json          # Dependencies and npm scripts
├── .env.example          # Environment variable template
├── CLAUDE.md             # AI assistant configuration
└── BACKLOG.md            # Current task backlog
```
