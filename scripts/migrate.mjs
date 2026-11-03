// Applies pending Drizzle migrations from ./drizzle against DATABASE_URL, then exits.
// Runs on every production container start (see Dockerfile CMD). Idempotent: Drizzle records
// applied migrations in drizzle.__drizzle_migrations and skips them on the next run.
// Plain JavaScript on purpose so it needs only production dependencies (drizzle-orm, postgres).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
	console.error('[migrate] DATABASE_URL is not set; refusing to start.');
	process.exit(1);
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(scriptDirectory, '..', 'drizzle');

// postgres.js needs max: 1 for migrations (they run inside one transaction).
const migrationClient = postgres(databaseUrl, { max: 1, onnotice: () => {} });

try {
	console.log(`[migrate] applying migrations from ${migrationsFolder}`);
	await migrate(drizzle(migrationClient), { migrationsFolder });
	console.log('[migrate] database is up to date');
} catch (migrationError) {
	console.error('[migrate] migration failed:', migrationError);
	process.exitCode = 1;
} finally {
	await migrationClient.end();
}
