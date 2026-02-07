import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import * as relations from './relations';

const connectionString =
	process.env.DATABASE_URL || 'postgresql://chronolog:chronolog@localhost:5432/chronolog';
const client = postgres(connectionString);

export const database = drizzle(client, { schema: { ...schema, ...relations } });

export * from './schema';
export * from './relations';
