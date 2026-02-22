import { boolean, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { clients } from './clients';
import { users } from './users';

export const contracts = pgTable('contracts', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
	clientId: uuid('client_id')
		.notNull()
		.references(() => clients.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	description: text('description'),
	isActive: boolean('is_active').notNull().default(true),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});
