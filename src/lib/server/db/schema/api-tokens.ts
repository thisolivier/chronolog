import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { user } from '../auth-schema';

/**
 * Personal API tokens for machine clients (the laptop CLI). Sprint 028-CL.
 *
 * The raw token (`clg_<id hex>_<secret>`) is shown once at creation; only the scrypt hash of
 * its secret part is stored. The id inside the token makes lookup a primary-key read.
 * Revoking sets `revoked_at` (the row is kept so a revoked token answers 403, not 401).
 */
export const apiTokens = pgTable(
	'api_tokens',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		tokenHash: text('token_hash').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
		revokedAt: timestamp('revoked_at', { withTimezone: true })
	},
	(table) => [index('api_tokens_user_id_idx').on(table.userId)]
);
