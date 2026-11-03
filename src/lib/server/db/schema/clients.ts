import { sql } from 'drizzle-orm';
import {
	boolean,
	integer,
	pgTable,
	text,
	timestamp,
	unique,
	uniqueIndex,
	uuid
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const clients = pgTable(
	'clients',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		shortCode: text('short_code').notNull(),
		emoji: text('emoji'),
		colorIndex: integer('color_index').notNull().default(0),
		/** Archived clients keep their data but are hidden from selects and the sidebar. */
		archivedAt: timestamp('archived_at', { withTimezone: true }),
		/** The per-user "Deleted Client" that receives reassigned entries; hidden everywhere. */
		isSystem: boolean('is_system').notNull().default(false),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(table) => [
		unique('clients_user_id_short_code_unique').on(table.userId, table.shortCode),
		uniqueIndex('clients_one_system_client_per_user')
			.on(table.userId)
			.where(sql`${table.isSystem}`)
	]
);
