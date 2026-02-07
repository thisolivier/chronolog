/**
 * Parse wiki-links from markdown content.
 * Wiki-link syntax: [[NOTE_ID]], [[NOTE_ID|label]], [[NOTE_ID#heading]], [[NOTE_ID#heading|label]]
 *
 * Returns an array of parsed links with deduplication and self-link filtering.
 */
export function parseWikiLinks(
	sourceNoteId: string,
	markdownContent: string
): Array<{ targetNoteId: string; headingAnchor: string | null }> {
	const wikiLinkRegex = /\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|[^\]]+)?\]\]/g;
	const parsedLinks: Array<{ targetNoteId: string; headingAnchor: string | null }> = [];
	const seenKeys = new Set<string>();

	let match;
	while ((match = wikiLinkRegex.exec(markdownContent)) !== null) {
		const targetNoteId = match[1].trim();
		const headingAnchor = match[2]?.trim() ?? null;
		const key = `${targetNoteId}:${headingAnchor ?? ''}`;

		if (!seenKeys.has(key) && targetNoteId !== sourceNoteId) {
			seenKeys.add(key);
			parsedLinks.push({ targetNoteId, headingAnchor });
		}
	}

	return parsedLinks;
}
