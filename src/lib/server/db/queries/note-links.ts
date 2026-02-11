import { eq, inArray } from 'drizzle-orm';
import { database, notes } from '$lib/server/db';
import { noteLinks } from '$lib/server/db/schema/note-links';
import { parseWikiLinks } from './wiki-link-parser';

export { parseWikiLinks } from './wiki-link-parser';

/**
 * Get all notes that link TO a given note (backlinks).
 */
export async function getBacklinksForNote(targetNoteId: string) {
	return database
		.select({
			sourceNoteId: noteLinks.sourceNoteId,
			headingAnchor: noteLinks.headingAnchor,
			noteTitle: notes.title,
			noteContractId: notes.contractId
		})
		.from(noteLinks)
		.innerJoin(notes, eq(noteLinks.sourceNoteId, notes.id))
		.where(eq(noteLinks.targetNoteId, targetNoteId));
}

/**
 * Get all outgoing links from a given note.
 */
export async function getOutgoingLinksForNote(sourceNoteId: string) {
	return database
		.select({
			targetNoteId: noteLinks.targetNoteId,
			headingAnchor: noteLinks.headingAnchor,
			noteTitle: notes.title
		})
		.from(noteLinks)
		.innerJoin(notes, eq(noteLinks.targetNoteId, notes.id))
		.where(eq(noteLinks.sourceNoteId, sourceNoteId));
}

/**
 * Parse wiki-links from markdown content and update the note_links table.
 * Deletes all existing outgoing links for the source note, then inserts
 * new links for any valid target note IDs found in the content.
 */
export async function updateNoteLinks(sourceNoteId: string, markdownContent: string, userId: string) {
	const parsedLinks = parseWikiLinks(sourceNoteId, markdownContent);

	// Delete all existing outgoing links for this note
	await database.delete(noteLinks).where(eq(noteLinks.sourceNoteId, sourceNoteId));

	// Insert new links (only if targets exist)
	if (parsedLinks.length > 0) {
		const targetIds = parsedLinks.map((link) => link.targetNoteId);
		const existingNotes = await database
			.select({ id: notes.id })
			.from(notes)
			.where(inArray(notes.id, targetIds));
		const existingIds = new Set(existingNotes.map((noteRow) => noteRow.id));
		const validLinks = parsedLinks.filter((link) => existingIds.has(link.targetNoteId));

		if (validLinks.length > 0) {
			await database.insert(noteLinks).values(
				validLinks.map((link) => ({
					sourceNoteId,
					targetNoteId: link.targetNoteId,
					headingAnchor: link.headingAnchor,
					userId
				}))
			);
		}
	}

	return parsedLinks.length;
}
