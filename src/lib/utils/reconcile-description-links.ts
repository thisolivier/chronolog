import { parseWikiLinkText } from '$lib/components/notes/extensions/wiki-link';

/**
 * Parsed link from a description text.
 */
export type DescriptionLink = {
	noteId: string;
	headingAnchor?: string;
};

/**
 * Extract all wiki-link references from a description string.
 * Returns deduplicated list of { noteId, headingAnchor }.
 */
export function extractDescriptionLinks(description: string): DescriptionLink[] {
	const pattern = /\[\[([^\]]+)\]\]/g;
	const seen = new Set<string>();
	const links: DescriptionLink[] = [];

	let match: RegExpExecArray | null;
	while ((match = pattern.exec(description)) !== null) {
		const parsed = parseWikiLinkText(match[1]);
		const key = parsed.headingAnchor
			? `${parsed.noteId}#${parsed.headingAnchor}`
			: parsed.noteId;

		if (!seen.has(key) && parsed.noteId) {
			seen.add(key);
			links.push({
				noteId: parsed.noteId,
				headingAnchor: parsed.headingAnchor
			});
		}
	}

	return links;
}

/**
 * Compute the diff between current links and desired links.
 * Returns lists of links to add and links to remove.
 */
export function reconcileLinks(
	currentLinks: Array<{ noteId: string; headingAnchor?: string | null }>,
	desiredLinks: DescriptionLink[]
): {
	toAdd: DescriptionLink[];
	toRemove: Array<{ noteId: string }>;
} {
	const currentSet = new Set(currentLinks.map((link) => link.noteId));
	const desiredSet = new Set(desiredLinks.map((link) => link.noteId));

	const toAdd = desiredLinks.filter((link) => !currentSet.has(link.noteId));
	const toRemove = currentLinks
		.filter((link) => !desiredSet.has(link.noteId))
		.map((link) => ({ noteId: link.noteId }));

	return { toAdd, toRemove };
}
