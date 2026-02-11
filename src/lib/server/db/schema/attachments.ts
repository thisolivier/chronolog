import { customType } from 'drizzle-orm/pg-core';
import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { notes } from './notes';
import { users } from './users';

const bytea = customType<{ data: Buffer }>({
	dataType() {
		return 'bytea';
	}
});

export const attachments = pgTable('attachments', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
	noteId: text('note_id')
		.notNull()
		.references(() => notes.id, { onDelete: 'cascade' }),
	filename: text('filename').notNull(),
	mimeType: text('mime_type').notNull(),
	sizeBytes: integer('size_bytes').notNull(),
	data: bytea('data').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});
