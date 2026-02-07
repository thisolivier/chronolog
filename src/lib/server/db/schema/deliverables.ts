import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { contracts } from './contracts';

export const deliverables = pgTable('deliverables', {
	id: uuid('id').primaryKey().defaultRandom(),
	contractId: uuid('contract_id')
		.notNull()
		.references(() => contracts.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});
