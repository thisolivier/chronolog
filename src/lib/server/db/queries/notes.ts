import { eq, and, desc, like } from "drizzle-orm";
import { database, notes, noteTimeEntries, contracts, clients } from "$lib/server/db";

export async function listNotesForUser(userId: string) {
	return database
		.select()
		.from(notes)
		.where(eq(notes.userId, userId))
		.orderBy(desc(notes.createdAt));
}

export async function listNotesForContract(userId: string, contractId: string) {
	const results = await database
		.select()
		.from(notes)
		.where(and(eq(notes.userId, userId), eq(notes.contractId, contractId)))
		.orderBy(desc(notes.isPinned), desc(notes.updatedAt));
	return results;
}

export async function getNoteForUser(noteId: string, userId: string) {
	const results = await database
		.select()
		.from(notes)
		.where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
		.limit(1);
	return results[0] ?? null;
}

export async function getNoteWithTimeEntriesForUser(noteId: string, userId: string) {
	const noteData = await getNoteForUser(noteId, userId);
	if (!noteData) return null;

	const linkedTimeEntries = await database
		.select()
		.from(noteTimeEntries)
		.where(eq(noteTimeEntries.noteId, noteId));

	return {
		...noteData,
		linkedTimeEntries
	};
}

/**
 * Generates the next note ID for a given contract
 * Format: CLIENT_SHORT_CODE.YYYYMMDD.SEQ
 * Example: BIGCH.20260207.001
 */
export async function getNextNoteId(contractId: string): Promise<string> {
	// Get the client's short code via the contract
	const contractData = await database
		.select({
			shortCode: clients.shortCode
		})
		.from(contracts)
		.innerJoin(clients, eq(contracts.clientId, clients.id))
		.where(eq(contracts.id, contractId))
		.limit(1);

	if (!contractData.length) {
		throw new Error('Contract not found');
	}

	const shortCode = contractData[0].shortCode;
	const today = new Date();
	const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD

	// Find existing notes for this client+date
	const prefix = `${shortCode}.${dateStr}.`;
	const existingNotes = await database
		.select({ id: notes.id })
		.from(notes)
		.where(like(notes.id, `${prefix}%`))
		.orderBy(desc(notes.id));

	// Determine next sequence number
	let nextSeq = 1;
	if (existingNotes.length > 0) {
		const lastId = existingNotes[0].id;
		const lastSeqStr = lastId.split('.')[2];
		const lastSeq = parseInt(lastSeqStr, 10);
		nextSeq = lastSeq + 1;
	}

	const seqStr = nextSeq.toString().padStart(3, '0');
	return `${shortCode}.${dateStr}.${seqStr}`;
}

export async function createNoteForUser(
	userId: string,
	contractId: string,
	title?: string,
	content?: string,
	contentJson?: string
) {
	const noteId = await getNextNoteId(contractId);

	const wordCount = contentJson ? calculateWordCountFromJson(contentJson) : 0;

	const results = await database
		.insert(notes)
		.values({
			id: noteId,
			userId,
			contractId,
			title: title ?? null,
			content: content ?? null,
			contentJson: contentJson ?? null,
			wordCount
		})
		.returning();
	return results[0];
}

export async function updateNoteForUser(
	userId: string,
	noteId: string,
	title?: string,
	content?: string,
	contentJson?: string
) {
	const updateData: {
		title?: string | null;
		content?: string | null;
		contentJson?: string | null;
		wordCount?: number;
		updatedAt: Date;
	} = {
		updatedAt: new Date()
	};

	if (title !== undefined) {
		updateData.title = title;
	}
	if (content !== undefined) {
		updateData.content = content;
	}
	if (contentJson !== undefined) {
		updateData.contentJson = contentJson;
		updateData.wordCount = calculateWordCountFromJson(contentJson);
	}

	const results = await database
		.update(notes)
		.set(updateData)
		.where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
		.returning();
	return results[0] ?? null;
}

export async function deleteNoteForUser(userId: string, noteId: string) {
	await database.delete(noteTimeEntries).where(eq(noteTimeEntries.noteId, noteId));

	const results = await database
		.delete(notes)
		.where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
		.returning();
	return results[0] ?? null;
}

export async function linkTimeEntryToNote(noteId: string, timeEntryId: string) {
	const results = await database
		.insert(noteTimeEntries)
		.values({ noteId, timeEntryId })
		.returning();
	return results[0];
}

export async function unlinkTimeEntryFromNote(noteId: string, timeEntryId: string) {
	const results = await database
		.delete(noteTimeEntries)
		.where(and(eq(noteTimeEntries.noteId, noteId), eq(noteTimeEntries.timeEntryId, timeEntryId)))
		.returning();
	return results[0] ?? null;
}

function calculateWordCountFromJson(contentJson: string): number {
	try {
		const content = JSON.parse(contentJson);
		if (!content.content || !Array.isArray(content.content)) {
			return 0;
		}

		let wordCount = 0;
		for (const block of content.content) {
			if (block.content && Array.isArray(block.content)) {
				for (const node of block.content) {
					if (node.type === "text" && node.text) {
						wordCount += node.text.split(/\s+/).filter((word: string) => word.length > 0).length;
					}
				}
			}
		}
		return wordCount;
	} catch {
		return 0;
	}
}
