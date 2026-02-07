import { relations } from 'drizzle-orm';
import {
	users,
	clients,
	contracts,
	deliverables,
	workTypes,
	timeEntries,
	notes,
	noteTimeEntries,
	weeklyStatuses,
	attachments
} from './schema';

// --- User relations ---

export const usersRelations = relations(users, ({ many }) => ({
	clients: many(clients),
	timeEntries: many(timeEntries),
	notes: many(notes),
	weeklyStatuses: many(weeklyStatuses)
}));

// --- Client relations ---

export const clientsRelations = relations(clients, ({ one, many }) => ({
	user: one(users, {
		fields: [clients.userId],
		references: [users.id]
	}),
	contracts: many(contracts)
}));

// --- Contract relations ---

export const contractsRelations = relations(contracts, ({ one, many }) => ({
	client: one(clients, {
		fields: [contracts.clientId],
		references: [clients.id]
	}),
	deliverables: many(deliverables),
	timeEntries: many(timeEntries),
	notes: many(notes)
}));

// --- Deliverable relations ---

export const deliverablesRelations = relations(deliverables, ({ one, many }) => ({
	contract: one(contracts, {
		fields: [deliverables.contractId],
		references: [contracts.id]
	}),
	workTypes: many(workTypes)
}));

// --- Work type relations ---

export const workTypesRelations = relations(workTypes, ({ one }) => ({
	deliverable: one(deliverables, {
		fields: [workTypes.deliverableId],
		references: [deliverables.id]
	})
}));

// --- Time entry relations ---

export const timeEntriesRelations = relations(timeEntries, ({ one, many }) => ({
	user: one(users, {
		fields: [timeEntries.userId],
		references: [users.id]
	}),
	contract: one(contracts, {
		fields: [timeEntries.contractId],
		references: [contracts.id]
	}),
	deliverable: one(deliverables, {
		fields: [timeEntries.deliverableId],
		references: [deliverables.id]
	}),
	workType: one(workTypes, {
		fields: [timeEntries.workTypeId],
		references: [workTypes.id]
	}),
	noteTimeEntries: many(noteTimeEntries)
}));

// --- Note relations ---

export const notesRelations = relations(notes, ({ one, many }) => ({
	user: one(users, {
		fields: [notes.userId],
		references: [users.id]
	}),
	contract: one(contracts, {
		fields: [notes.contractId],
		references: [contracts.id]
	}),
	noteTimeEntries: many(noteTimeEntries),
	attachments: many(attachments)
}));

// --- Note-time entry join table relations ---

export const noteTimeEntriesRelations = relations(noteTimeEntries, ({ one }) => ({
	note: one(notes, {
		fields: [noteTimeEntries.noteId],
		references: [notes.id]
	}),
	timeEntry: one(timeEntries, {
		fields: [noteTimeEntries.timeEntryId],
		references: [timeEntries.id]
	})
}));

// --- Weekly status relations ---

export const weeklyStatusesRelations = relations(weeklyStatuses, ({ one }) => ({
	user: one(users, {
		fields: [weeklyStatuses.userId],
		references: [users.id]
	})
}));

// --- Attachment relations ---

export const attachmentsRelations = relations(attachments, ({ one }) => ({
	note: one(notes, {
		fields: [attachments.noteId],
		references: [notes.id]
	})
}));
