import { sql } from 'drizzle-orm';
import { boolean, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { clients } from './clients';

export const contracts = pgTable(
	'contracts',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		clientId: uuid('client_id')
			.notNull()
			.references(() => clients.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		description: text('description'),
		isActive: boolean('is_active').notNull().default(true),
		sortOrder: integer('sort_order').notNull().default(0),
		/** Archived contracts keep their entries and notes but are hidden from selects and the sidebar. */
		archivedAt: timestamp('archived_at', { withTimezone: true }),
		/** The per-user "Deleted Contract" that receives reassigned entries and notes. */
		isSystem: boolean('is_system').notNull().default(false),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(table) => [
		uniqueIndex('contracts_one_system_contract_per_client')
			.on(table.clientId)
			.where(sql`${table.isSystem}`)
	]
);
