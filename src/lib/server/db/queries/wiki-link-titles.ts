/**
 * Wiki-link text for server-built titles and previews (sprint 043-CL).
 *
 * A wiki-link with no label reads as its target's title. `wikiLinkPreviewOptions` collects the
 * note IDs the given notes link to, loads those titles in one query (the user's own notes only,
 * trashed ones included, since a link to a trashed note still names it), and returns preview
 * options for `extractPreviewLines` / `extractMarkdownPreviewLines` / `noteDisplayTitle`.
 * A target's own wiki-links are not followed (one level); unknown targets read as their ID.
 */
import { and, eq, inArray } from 'drizzle-orm';
import { database, notes } from '$lib/server/db';
import { decryptNullable } from '$lib/server/crypto/server-cipher';
import { noteDisplayTitle } from '$lib/utils/note-display-title';
import { extractMarkdownPreviewLines } from '$lib/utils/markdown-preview-lines';
import { collectWikiLinkNoteIds, type PreviewTextOptions } from '$lib/utils/wiki-link-text';

type LinkingNote = { contentJson?: string | null; content?: string | null };

export async function wikiLinkPreviewOptions(userId: string, linkingNotes: LinkingNote[]): Promise<PreviewTextOptions> {
	const targetIds = new Set<string>();
	for (const note of linkingNotes) {
		// The markdown only matters for notes without JSON (created over the API)
		for (const noteId of collectWikiLinkNoteIds(note.contentJson, note.contentJson ? null : note.content)) {
			targetIds.add(noteId);
		}
	}
	if (targetIds.size === 0) return {};

	const rows = await database
		.select({ id: notes.id, title: notes.title, content: notes.content, contentJson: notes.contentJson })
		.from(notes)
		.where(and(eq(notes.userId, userId), inArray(notes.id, [...targetIds])));
	const titles = new Map<string, string>();
	for (const row of rows) {
		const contentJson = decryptNullable(row.contentJson, 'notes.content_json');
		const title =
			noteDisplayTitle(decryptNullable(row.title, 'notes.title'), contentJson) ??
			(contentJson ? null : extractMarkdownPreviewLines(decryptNullable(row.content, 'notes.content')).firstLine || null);
		if (title) titles.set(row.id, title);
	}
	return { resolveNoteTitle: (noteId) => titles.get(noteId) };
}
