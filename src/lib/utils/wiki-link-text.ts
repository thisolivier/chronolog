/**
 * Plain-text form of wiki-links for titles and previews (sprint 043-CL). Pure; used on client
 * and server. A wiki-link shows its explicit label, else the target note's title (when the caller
 * can resolve it), else the note ID, the same rule as the editor chip (`wikiLinkDisplayText`).
 */

/** Looks up a note's display title; null or undefined when unknown */
export type NoteTitleResolver = (noteId: string) => string | null | undefined;

/** Options shared by the preview and title helpers */
export type PreviewTextOptions = {
	resolveNoteTitle?: NoteTitleResolver;
	/** Leave wiki-links out, as titles were derived before sprint 043 (to recognise those titles) */
	omitWikiLinks?: boolean;
};

/**
 * Parse the interior text of a `[[...]]` wiki-link: `NOTE_ID`, `NOTE_ID|label`,
 * `NOTE_ID#heading` or `NOTE_ID#heading|label`. The label defaults to the note ID.
 */
export function parseWikiLinkText(raw: string): { noteId: string; headingAnchor?: string; label: string } {
	let noteId = raw;
	let headingAnchor: string | undefined;
	let label: string | undefined;
	const pipeIndex = noteId.indexOf('|');
	if (pipeIndex !== -1) {
		label = noteId.slice(pipeIndex + 1);
		noteId = noteId.slice(0, pipeIndex);
	}
	const hashIndex = noteId.indexOf('#');
	if (hashIndex !== -1) {
		headingAnchor = noteId.slice(hashIndex + 1);
		noteId = noteId.slice(0, hashIndex);
	}
	return { noteId, headingAnchor: headingAnchor || undefined, label: label || noteId };
}

/** The text a wiki-link reads as: label, else the resolved title, else the note ID. */
export function wikiLinkPlainText(noteId: string, label: string | null | undefined, options: PreviewTextOptions = {}): string {
	if (options.omitWikiLinks) return '';
	if (label && label !== noteId) return label;
	return options.resolveNoteTitle?.(noteId) || noteId;
}

const MARKDOWN_WIKI_LINK = /\[\[([^\]\n]+)\]\]/g;

/** Every note ID a note links to, from its TipTap JSON and/or its markdown, without duplicates. */
export function collectWikiLinkNoteIds(contentJson: string | null | undefined, markdown?: string | null): string[] {
	const noteIds = new Set<string>();
	if (contentJson) {
		try {
			const visit = (node: { type?: string; attrs?: { noteId?: unknown }; content?: unknown }) => {
				if (node.type === 'wikiLink' && typeof node.attrs?.noteId === 'string') noteIds.add(node.attrs.noteId);
				if (Array.isArray(node.content)) node.content.forEach(visit);
			};
			visit(JSON.parse(contentJson));
		} catch {
			// Unreadable JSON: no links from it
		}
	}
	for (const match of (markdown ?? '').matchAll(MARKDOWN_WIKI_LINK)) {
		const { noteId } = parseWikiLinkText(match[1]);
		if (noteId) noteIds.add(noteId);
	}
	return [...noteIds];
}

/**
 * Inline markdown links as the text a reader sees: `[[ID|label]]` -> label (or title / ID),
 * `![alt](url)` -> alt, `[text](url)` -> text (attachment links included).
 */
export function markdownLinksToText(line: string, options: PreviewTextOptions = {}): string {
	return line
		.replace(MARKDOWN_WIKI_LINK, (_whole, inner: string) => {
			const { noteId, label } = parseWikiLinkText(inner);
			return wikiLinkPlainText(noteId, label, options);
		})
		.replace(/!\[([^\]]*)\]\([^)\s]*(?:\s+"[^"]*")?\)/g, '$1')
		.replace(/\[([^\]]+)\]\([^)\s]*(?:\s+"[^"]*")?\)/g, '$1');
}
