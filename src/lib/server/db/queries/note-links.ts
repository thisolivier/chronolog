import { and, eq, inArray, isNull } from 'drizzle-orm';
import { database, notes, contracts } from '$lib/server/db';
import { noteLinks } from '$lib/server/db/schema/note-links';
import { parseWikiLinks } from './wiki-link-parser';
import { decryptNullable } from '$lib/server/crypto/server-cipher';
import { noteDisplayTitle } from '$lib/utils/note-display-title';

export { parseWikiLinks } from './wiki-link-parser';

/**
 * Get the user's notes that link TO a given note (backlinks).
 * `noteTitle` is the source note's display title (stored title, else first line);
 * contract and client IDs let the UI open a source note in another contract.
 * Trashed sources are hidden; their link rows stay, so a restore brings them back (sprint 037-CL).
 */
export async function getBacklinksForNote(targetNoteId: string, userId: string) {
	const rows = await database
		.select({
			sourceNoteId: noteLinks.sourceNoteId,
			headingAnchor: noteLinks.headingAnchor,
			noteTitle: notes.title,
			noteContentJson: notes.contentJson,
			noteContractId: notes.contractId,
			noteClientId: contracts.clientId
		})
		.from(noteLinks)
		.innerJoin(notes, eq(noteLinks.sourceNoteId, notes.id))
		.innerJoin(contracts, eq(notes.contractId, contracts.id))
		.where(and(eq(noteLinks.targetNoteId, targetNoteId), eq(notes.userId, userId), isNull(notes.deletedAt)));

	// notes.title and notes.content_json are encrypted at rest
	return rows.map(({ noteContentJson, ...row }) => ({
		...row,
		noteTitle: noteDisplayTitle(
			decryptNullable(row.noteTitle, 'notes.title'),
			decryptNullable(noteContentJson, 'notes.content_json')
		)
	}));
}

/**
 * Parse wiki-links from markdown content and update the note_links table.
 * Deletes all existing outgoing links for the source note, then inserts
 * new links for any valid target note IDs found in the content. A trashed target still counts as
 * existing (it keeps its ID), so a restore finds its backlinks in place.
 */
export async function updateNoteLinks(sourceNoteId: string, markdownContent: string) {
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
					headingAnchor: link.headingAnchor
				}))
			);
		}
	}

	return parsedLinks.length;
}
