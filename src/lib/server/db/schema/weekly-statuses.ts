import { date, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

export const weeklyStatuses = pgTable(
	'weekly_statuses',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		weekStart: date('week_start', { mode: 'string' }).notNull(),
		year: integer('year').notNull(),
		weekNumber: integer('week_number').notNull(),
		status: text('status').notNull().default('Unsubmitted'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(table) => [
		unique('weekly_statuses_user_id_year_week_number_unique').on(
			table.userId,
			table.year,
			table.weekNumber
		)
	]
);
