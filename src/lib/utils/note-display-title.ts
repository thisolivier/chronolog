import { extractPreviewLines } from './extract-preview-lines';

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
 */
export function noteDisplayTitle(title: string | null | undefined, contentJson: string | null | undefined): string | null {
	const storedTitle = title?.trim();
	if (storedTitle) return truncateNoteTitle(storedTitle);
	const { firstLine } = extractPreviewLines(contentJson ?? null);
	return firstLine ? truncateNoteTitle(firstLine) : null;
}
