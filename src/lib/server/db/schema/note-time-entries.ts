import { pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';
import { notes } from './notes';
import { timeEntries } from './time-entries';

export const noteTimeEntries = pgTable(
	'note_time_entries',
	{
		noteId: text('note_id')
			.notNull()
			.references(() => notes.id, { onDelete: 'cascade' }),
		timeEntryId: uuid('time_entry_id')
			.notNull()
			.references(() => timeEntries.id, { onDelete: 'cascade' }),
		headingAnchor: text('heading_anchor')
	},
	(table) => [primaryKey({ columns: [table.noteId, table.timeEntryId] })]
);
