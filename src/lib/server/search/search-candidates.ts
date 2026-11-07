/**
 * Search candidates (sprint 058-DR): every non-trashed note and every time entry of one user,
 * decrypted once per request with the client/contract identity the matcher searches and every
 * hit returns. The columns are encrypted at rest, so matching happens in memory
 * (`record-matcher.ts`); never filter them with SQL `ILIKE`.
 */
import { and, eq, isNull } from 'drizzle-orm';
import { database, notes, contracts, clients, timeEntries, deliverables, workTypes } from '$lib/server/db';
import { noteDisplayTitle } from '$lib/utils/note-display-title';
import { decryptNullable, decryptText } from '$lib/server/crypto/server-cipher';

/** The owning client and contract, returned with every search hit */
export type HitContext = {
	clientId: string;
	clientName: string;
	clientShortCode: string;
	/** The client's colour slot, so a hit can show its identity without another request */
	clientColorIndex: number;
	contractId: string;
	contractName: string;
};

export type NoteCandidate = HitContext & {
	id: string;
	title: string | null;
	contentJson: string | null;
	/** Markdown body ('' when none) */
	content: string;
	/** Stored title, else first content line, else null */
	displayTitle: string | null;
	updatedAt: Date;
};

export type TimeEntryCandidate = HitContext & {
	id: string;
	/** YYYY-MM-DD */
	date: string;
	startTime: string | null;
	durationMinutes: number;
	description: string;
	deliverableName: string | null;
	workTypeName: string | null;
	createdAt: Date;
};

type ContextRow = {
	clientId: string;
	clientName: string;
	clientShortCode: string;
	clientColorIndex: number;
	contractId: string;
	contractName: string;
};

const contextColumns = {
	contractId: contracts.id,
	contractName: contracts.name,
	clientId: clients.id,
	clientName: clients.name,
	clientShortCode: clients.shortCode,
	clientColorIndex: clients.colorIndex
};

function decryptContext(row: ContextRow): HitContext {
	return {
		clientId: row.clientId,
		clientName: decryptText(row.clientName, 'clients.name'),
		clientShortCode: row.clientShortCode,
		clientColorIndex: row.clientColorIndex,
		contractId: row.contractId,
		contractName: decryptText(row.contractName, 'contracts.name')
	};
}

/** Just the identity part of a candidate, for a hit */
export function hitContextOf(candidate: HitContext): HitContext {
	return {
		clientId: candidate.clientId,
		clientName: candidate.clientName,
		clientShortCode: candidate.clientShortCode,
		clientColorIndex: candidate.clientColorIndex,
		contractId: candidate.contractId,
		contractName: candidate.contractName
	};
}

/** Every note of the user that is not in the trash, decrypted. */
export async function loadNoteCandidates(userId: string): Promise<NoteCandidate[]> {
	const rows = await database
		.select({
			id: notes.id,
			title: notes.title,
			content: notes.content,
			contentJson: notes.contentJson,
			updatedAt: notes.updatedAt,
			...contextColumns
		})
		.from(notes)
		.innerJoin(contracts, eq(notes.contractId, contracts.id))
		.innerJoin(clients, eq(contracts.clientId, clients.id))
		.where(and(eq(notes.userId, userId), isNull(notes.deletedAt)));

	return rows.map((row) => {
		const title = decryptNullable(row.title, 'notes.title');
		const contentJson = decryptNullable(row.contentJson, 'notes.content_json');
		return {
			id: row.id,
			title,
			contentJson,
			content: decryptNullable(row.content, 'notes.content') ?? '',
			displayTitle: noteDisplayTitle(title, contentJson),
			updatedAt: row.updatedAt,
			...decryptContext(row)
		};
	});
}

/** Every time entry of the user, decrypted, with its deliverable and work type names. */
export async function loadTimeEntryCandidates(userId: string): Promise<TimeEntryCandidate[]> {
	const rows = await database
		.select({
			id: timeEntries.id,
			date: timeEntries.date,
			startTime: timeEntries.startTime,
			durationMinutes: timeEntries.durationMinutes,
			description: timeEntries.description,
			createdAt: timeEntries.createdAt,
			deliverableName: deliverables.name,
			workTypeName: workTypes.name,
			...contextColumns
		})
		.from(timeEntries)
		.innerJoin(contracts, eq(timeEntries.contractId, contracts.id))
		.innerJoin(clients, eq(contracts.clientId, clients.id))
		.leftJoin(deliverables, eq(timeEntries.deliverableId, deliverables.id))
		.leftJoin(workTypes, eq(timeEntries.workTypeId, workTypes.id))
		.where(eq(timeEntries.userId, userId));

	return rows.map((row) => ({
		id: row.id,
		date: row.date,
		startTime: row.startTime,
		durationMinutes: row.durationMinutes,
		description: (decryptNullable(row.description, 'time_entries.description') ?? '').replace(/\s+/g, ' ').trim(),
		deliverableName: row.deliverableName,
		workTypeName: row.workTypeName,
		createdAt: row.createdAt,
		...decryptContext(row)
	}));
}

/** Newer sorts larger: a note by its last edit */
export function noteRecencyKey(note: NoteCandidate): string {
	return note.updatedAt.toISOString();
}

/** Newer sorts larger: an entry by date, start time (none sorts as the start of the day), creation */
export function timeEntryRecencyKey(entry: TimeEntryCandidate): string {
	return `${entry.date}T${(entry.startTime ?? '00:00').slice(0, 5)}|${entry.createdAt.toISOString()}`;
}
