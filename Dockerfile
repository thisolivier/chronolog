# Chronolog production image (adapter-node). Used by docker-compose.prod.yml.
# Build stage installs everything and runs `vite build`; the final stage carries only
# build/, the migrations, the migration runner and production dependencies, and runs as `node`.

# ---- Build stage ----
FROM node:22.23.4-alpine3.24 AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Production dependencies only ----
FROM node:22.23.4-alpine3.24 AS production-dependencies

WORKDIR /app

COPY package.json package-lock.json ./
# --ignore-scripts: the `prepare` script calls svelte-kit, a dev dependency.
# --omit=optional: better-auth lists @sveltejs/kit, svelte, vitest, drizzle-kit... as optional peers,
# and npm keeps them in the runtime tree otherwise. They are bundled into build/ or unused at
# runtime. @sveltejs/adapter-node is a devDependency for the same reason: build time only.
RUN npm ci --omit=dev --omit=optional --ignore-scripts && npm cache clean --force

# ---- Runtime ----
FROM node:22.23.4-alpine3.24

# BODY_SIZE_LIMIT: adapter-node refuses bodies over 512 KB by default; attachments go up to
# 10 MB (the route returns its own 400 above that), so allow a little over for multipart framing.
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    BODY_SIZE_LIMIT=11M

WORKDIR /app

COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/build ./build
COPY --chown=node:node package.json ./
COPY --chown=node:node drizzle ./drizzle
COPY --chown=node:node scripts/migrate.mjs ./scripts/migrate.mjs

USER node

EXPOSE 3000

# Apply pending migrations (idempotent: drizzle records applied ones), then hand PID 1 to the server.
CMD ["sh", "-c", "node scripts/migrate.mjs && exec node build"]
