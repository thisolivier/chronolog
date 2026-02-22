import { integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { deliverables } from './deliverables';
import { users } from './users';

export const workTypes = pgTable('work_types', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
	deliverableId: uuid('deliverable_id')
		.notNull()
		.references(() => deliverables.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	sortOrder: integer('sort_order').notNull().default(0)
});
