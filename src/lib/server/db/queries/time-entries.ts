import { eq, and, between, asc, sql } from 'drizzle-orm';
import { database, timeEntries, contracts, clients, deliverables, workTypes } from '$lib/server/db';
import { calculateTimerDurationMinutes } from './timer-duration';
import { decryptNullable, decryptText, encryptNullable } from '$lib/server/crypto/server-cipher';

type TimeEntryRow = typeof timeEntries.$inferSelect;

/** `time_entries.description` is encrypted at rest; decrypt rows leaving this module. */
function decryptTimeEntry(row: TimeEntryRow): TimeEntryRow {
	return { ...row, description: decryptNullable(row.description, 'time_entries.description') };
}

function decryptOptionalTimeEntry(row: TimeEntryRow | undefined): TimeEntryRow | null {
	return row ? decryptTimeEntry(row) : null;
}

/** Decrypts the description plus the joined contract and client names. */
function decryptTimeEntryWithContext(row: TimeEntryWithContext): TimeEntryWithContext {
	return {
		...row,
		description: decryptNullable(row.description, 'time_entries.description'),
		contractName: decryptText(row.contractName, 'contracts.name'),
		clientName: decryptText(row.clientName, 'clients.name')
	};
}

/** Shape returned by time entry queries that join related tables */
export type TimeEntryWithContext = {
	id: string;
	userId: string;
	contractId: string;
	deliverableId: string | null;
	workTypeId: string | null;
	date: string;
	startTime: string | null;
	endTime: string | null;
	durationMinutes: number;
	description: string | null;
	isDraft: boolean;
	createdAt: Date;
	updatedAt: Date;
	contractName: string;
	clientId: string;
	clientName: string;
	clientShortCode: string;
	clientColorIndex: number;
	deliverableName: string | null;
	workTypeName: string | null;
};

/** Base select with joins for full context */
function timeEntrySelectWithContext() {
	return database
		.select({
			id: timeEntries.id,
			userId: timeEntries.userId,
			contractId: timeEntries.contractId,
			deliverableId: timeEntries.deliverableId,
			workTypeId: timeEntries.workTypeId,
			date: timeEntries.date,
			startTime: timeEntries.startTime,
			endTime: timeEntries.endTime,
			durationMinutes: timeEntries.durationMinutes,
			description: timeEntries.description,
			isDraft: timeEntries.isDraft,
			createdAt: timeEntries.createdAt,
			updatedAt: timeEntries.updatedAt,
			contractName: contracts.name,
			clientId: clients.id,
			clientName: clients.name,
			clientShortCode: clients.shortCode,
			clientColorIndex: clients.colorIndex,
			deliverableName: deliverables.name,
			workTypeName: workTypes.name
		})
		.from(timeEntries)
		.innerJoin(contracts, eq(timeEntries.contractId, contracts.id))
		.innerJoin(clients, eq(contracts.clientId, clients.id))
		.leftJoin(deliverables, eq(timeEntries.deliverableId, deliverables.id))
		.leftJoin(workTypes, eq(timeEntries.workTypeId, workTypes.id));
}

/** List all time entries for a week (7-day range starting from weekStart) */
export async function listTimeEntriesForWeek(
	userId: string,
	weekStart: string
): Promise<TimeEntryWithContext[]> {
	const weekEndDate = new Date(weekStart);
	weekEndDate.setDate(weekEndDate.getDate() + 6);
	const weekEnd = weekEndDate.toISOString().split('T')[0];

	const rows = await timeEntrySelectWithContext()
		.where(
			and(
				eq(timeEntries.userId, userId),
				between(timeEntries.date, weekStart, weekEnd),
				eq(timeEntries.isDraft, false)
			)
		)
		.orderBy(asc(timeEntries.date), sql`${timeEntries.startTime} asc nulls last`, asc(timeEntries.createdAt));
	return rows.map(decryptTimeEntryWithContext);
}

/** Create a new time entry */
export async function createTimeEntry(data: {
	userId: string;
	contractId: string;
	deliverableId?: string | null;
	workTypeId?: string | null;
	date: string;
	startTime?: string | null;
	endTime?: string | null;
	durationMinutes: number;
	description?: string | null;
	isDraft?: boolean;
}) {
	const results = await database
		.insert(timeEntries)
		.values({ ...data, description: encryptNullable(data.description) })
		.returning();
	return decryptTimeEntry(results[0]);
}

/** Update an existing time entry (scoped by userId for security) */
export async function updateTimeEntry(
	entryId: string,
	userId: string,
	data: {
		contractId?: string;
		deliverableId?: string | null;
		workTypeId?: string | null;
		date?: string;
		startTime?: string | null;
		endTime?: string | null;
		durationMinutes?: number;
		description?: string | null;
		isDraft?: boolean;
	}
) {
	const results = await database
		.update(timeEntries)
		.set({ ...data, description: encryptNullable(data.description), updatedAt: new Date() })
		.where(and(eq(timeEntries.id, entryId), eq(timeEntries.userId, userId)))
		.returning();
	return decryptOptionalTimeEntry(results[0]);
}

/** Delete a time entry (scoped by userId for security) */
export async function deleteTimeEntry(entryId: string, userId: string) {
	const results = await database
		.delete(timeEntries)
		.where(and(eq(timeEntries.id, entryId), eq(timeEntries.userId, userId)))
		.returning();
	return decryptOptionalTimeEntry(results[0]);
}

/** Get the current draft/running timer entry for a user */
export async function getRunningTimer(userId: string) {
	const results = await timeEntrySelectWithContext()
		.where(and(eq(timeEntries.userId, userId), eq(timeEntries.isDraft, true)))
		.limit(1);
	return results[0] ? decryptTimeEntryWithContext(results[0]) : null;
}

/** Start a new timer — creates a draft entry with start_time=now */
export async function startTimer(userId: string, contractId: string) {
	const now = new Date();
	const currentDate = now.toISOString().split('T')[0];
	const currentTime = now.toTimeString().split(' ')[0]; // HH:MM:SS

	const results = await database
		.insert(timeEntries)
		.values({
			userId,
			contractId,
			date: currentDate,
			startTime: currentTime,
			durationMinutes: 0,
			isDraft: true
		})
		.returning();
	return decryptTimeEntry(results[0]);
}

/** Stop a running timer — sets end_time=now, calculates duration */
export async function stopTimer(entryId: string, userId: string) {
	const now = new Date();
	const currentTime = now.toTimeString().split(' ')[0];

	// First get the entry to calculate duration
	const existing = await database
		.select()
		.from(timeEntries)
		.where(and(eq(timeEntries.id, entryId), eq(timeEntries.userId, userId), eq(timeEntries.isDraft, true)))
		.limit(1);

	const entry = existing[0];
	if (!entry || !entry.startTime) return null;

	// Duration from full seconds, rounded up, never 0 (see timer-duration.ts)
	const durationMinutes = calculateTimerDurationMinutes(entry.startTime, currentTime);

	const results = await database
		.update(timeEntries)
		.set({
			endTime: currentTime,
			durationMinutes,
			updatedAt: new Date()
		})
		.where(and(eq(timeEntries.id, entryId), eq(timeEntries.userId, userId)))
		.returning();
	return decryptOptionalTimeEntry(results[0]);
}
