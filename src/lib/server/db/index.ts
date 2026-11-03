import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import * as relations from './relations';

const connectionString =
	process.env.DATABASE_URL || 'postgresql://chronolog:chronolog@localhost:5432/chronolog';

/**
 * One Postgres client per process. Vite's dev server re-evaluates this module on every SSR
 * invalidation; without the `globalThis` cache each reload opened a fresh pool (up to 10
 * connections) and never closed the old one, until Postgres refused clients (`53300`).
 * In production (`node build`) the module is evaluated once, so the cache is a no-op.
 */
const globalForDatabase = globalThis as typeof globalThis & {
	chronologPostgresClient?: ReturnType<typeof postgres>;
};

const client = globalForDatabase.chronologPostgresClient ?? postgres(connectionString);
if (process.env.NODE_ENV !== 'production') {
	globalForDatabase.chronologPostgresClient = client;
}

export const database = drizzle(client, { schema: { ...schema, ...relations } });

export * from './schema';
export * from './relations';
