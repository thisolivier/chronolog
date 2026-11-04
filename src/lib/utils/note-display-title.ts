import { extractPreviewLines } from './extract-preview-lines';
import { collectWikiLinkNoteIds, type PreviewTextOptions } from './wiki-link-text';

/** Longest title stored or shown for a note; longer first lines are cut with an ellipsis. */
export const NOTE_TITLE_MAX_LENGTH = 120;

/**
 * Shorten a title to `NOTE_TITLE_MAX_LENGTH` characters, breaking on a word where possible.
 */
export function truncateNoteTitle(text: string, maxLength: number = NOTE_TITLE_MAX_LENGTH): string {
	const trimmed = text.trim().replace(/\s+/g, ' ');
	if (trimmed.length <= maxLength) return trimmed;
	const slice = trimmed.slice(0, maxLength - 1);
	const lastSpace = slice.lastIndexOf(' ');
	const wordBoundary = lastSpace > maxLength * 0.6 ? slice.slice(0, lastSpace) : slice;
	return `${wordBoundary.trimEnd()}…`;
}

/**
 * The human-readable name of a note: its stored title, else the first line of its
 * content, else `null` (callers fall back to the note ID). Pure; used on client and server.
 *
 * Wiki-links read as their label, the target's title (`options.resolveNoteTitle`) or the ID
 * (sprint 043-CL). A stored title saved before that, which simply dropped the links ("Beta note
 * links to"), is recognised and derived again from the content.
 */
export function noteDisplayTitle(
	title: string | null | undefined,
	contentJson: string | null | undefined,
	options: PreviewTextOptions = {}
): string | null {
	const storedTitle = title?.trim();
	if (storedTitle && !isTitleWithoutWikiLinks(storedTitle, contentJson)) return truncateNoteTitle(storedTitle);
	const { firstLine } = extractPreviewLines(contentJson ?? null, options);
	if (firstLine) return truncateNoteTitle(firstLine);
	return storedTitle ? truncateNoteTitle(storedTitle) : null;
}

/** True when `storedTitle` is the content's first line with its wiki-links left out */
function isTitleWithoutWikiLinks(storedTitle: string, contentJson: string | null | undefined): boolean {
	if (!contentJson || collectWikiLinkNoteIds(contentJson).length === 0) return false;
	const legacyFirstLine = extractPreviewLines(contentJson, { omitWikiLinks: true }).firstLine;
	return truncateNoteTitle(legacyFirstLine) === truncateNoteTitle(storedTitle) &&
		extractPreviewLines(contentJson).firstLine !== legacyFirstLine;
}
