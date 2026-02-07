import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';
import { contracts } from './contracts';

export const notes = pgTable('notes', {
	id: text('id').primaryKey(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	contractId: uuid('contract_id')
		.notNull()
		.references(() => contracts.id, { onDelete: 'cascade' }),
	title: text('title'),
	content: text('content'),
	isPinned: boolean('is_pinned').notNull().default(false),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});
