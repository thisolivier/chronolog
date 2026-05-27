import { integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
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
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(table) => [unique('clients_user_id_short_code_unique').on(table.userId, table.shortCode)]
);
