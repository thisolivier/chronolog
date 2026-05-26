# ---- Build stage ----
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run prepare 2>/dev/null || true
RUN npm run build

# ---- Production stage ----
FROM node:20-alpine

WORKDIR /app

# Copy built output, migrations, and dependencies
COPY --from=build /app/build ./build
COPY --from=build /app/package*.json ./
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/drizzle.config.ts ./
COPY --from=build /app/node_modules ./node_modules

EXPOSE 3000

# Run migrations then start production server
CMD ["sh", "-c", "npx drizzle-kit migrate && node build"]
