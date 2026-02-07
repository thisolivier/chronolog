import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: ['./src/lib/server/db/schema.ts', './src/lib/server/db/auth-schema.ts'],
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: {
		url: process.env.DATABASE_URL || 'postgresql://chronolog:chronolog@localhost:5432/chronolog',
	},
});
