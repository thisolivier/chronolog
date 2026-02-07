import { eq, and, desc } from "drizzle-orm";
import { database, notes, noteTimeEntries } from "$lib/server/db";

export async function listNotesForUser(userId: string) {
	return database
		.select()
		.from(notes)
		.where(eq(notes.userId, userId))
		.orderBy(desc(notes.createdAt));
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
	if (\!noteData) return null;

	const linkedTimeEntries = await database
		.select()
		.from(noteTimeEntries)
		.where(eq(noteTimeEntries.noteId, noteId));

	return {
		...noteData,
		linkedTimeEntries
	};
}

export async function createNoteForUser(userId: string, title: string, contentJson: string) {
	const results = await database
		.insert(notes)
		.values({
			userId,
			title,
			contentJson,
			wordCount: calculateWordCountFromJson(contentJson)
		})
		.returning();
	return results[0];
}

export async function updateNoteForUser(userId: string, noteId: string, title: string, contentJson: string) {
	const results = await database
		.update(notes)
		.set({
			title,
			contentJson,
			wordCount: calculateWordCountFromJson(contentJson),
			updatedAt: new Date()
		})
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
		if (\!content.content || \!Array.isArray(content.content)) {
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
