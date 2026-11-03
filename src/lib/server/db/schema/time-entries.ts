import { boolean, date, integer, pgTable, text, time, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';
import { contracts } from './contracts';
import { deliverables } from './deliverables';
import { workTypes } from './work-types';

export const timeEntries = pgTable('time_entries', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	// No cascade: deleting a contract must first reassign its entries and notes (sprint 026-CL).
	contractId: uuid('contract_id')
		.notNull()
		.references(() => contracts.id, { onDelete: 'no action' }),
	deliverableId: uuid('deliverable_id').references(() => deliverables.id, {
		onDelete: 'set null'
	}),
	workTypeId: uuid('work_type_id').references(() => workTypes.id, { onDelete: 'set null' }),
	date: date('date', { mode: 'string' }).notNull(),
	startTime: time('start_time'),
	endTime: time('end_time'),
	durationMinutes: integer('duration_minutes').notNull(),
	description: text('description'),
	isDraft: boolean('is_draft').notNull().default(false),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});
