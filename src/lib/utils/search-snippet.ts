/**
 * Search snippets (sprint 042-CL): a short excerpt of a text around the first match of a query,
 * with the offsets of every match inside the excerpt, so the client can highlight them without
 * searching again. Case-insensitive substring matching, like the rest of Chronolog's search.
 */

export type MatchRange = { start: number; end: number };
export type SearchSnippet = {
	text: string;
	matches: MatchRange[];
	/** Text of wiki-links to notes in the trash, drawn struck through (sprint 060-DR) */
	deletedLinks?: MatchRange[];
};

/** Reads one wiki-link as text: its label, its target's title or its ID (`wikiLinkPlainText`) */
export type WikiLinkTextResolver = (noteId: string, label: string) => string;

/**
 * Private-use characters around a deleted link's text while an excerpt is built; never sent to the
 * client (`extractDeletedLinks` turns them into `deletedLinks` ranges).
 */
const DELETED_LINK_OPEN = '\uE000';
const DELETED_LINK_CLOSE = '\uE001';

/** Wrap a deleted link's text so `extractDeletedLinks` can find it after the excerpt is cut */
export function markDeletedLinkText(text: string): string {
	return `${DELETED_LINK_OPEN}${text}${DELETED_LINK_CLOSE}`;
}

/** Characters kept before the first match (the rest of the budget goes after it) */
const DEFAULT_CONTEXT_BEFORE = 50;
const DEFAULT_SNIPPET_LENGTH = 180;
const ELLIPSIS = '…';

/**
 * Every occurrence of one needle, case-insensitive, non-overlapping, as offsets into the original
 * `text`. A regex with the `i` flag folds case without changing lengths, so the offsets stay right
 * after characters whose lower case is longer (e.g. "İ"); lower-casing the text first would shift them.
 */
function rangesOfNeedle(text: string, needle: string): MatchRange[] {
	if (!needle) return [];
	const pattern = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu');
	return [...text.matchAll(pattern)].map((found) => ({ start: found.index, end: found.index + found[0].length }));
}

/**
 * Every occurrence of `needle` in `text`, case-insensitive. Given several needles (a query's
 * phrase and its words, sprint 058-DR), the ranges of all of them, sorted, with overlapping
 * ranges merged so the result never overlaps.
 */
export function findMatchRanges(text: string, needle: string | readonly string[]): MatchRange[] {
	const needles = typeof needle === 'string' ? [needle] : needle;
	const ranges = needles
		.flatMap((oneNeedle) => rangesOfNeedle(text, oneNeedle))
		.sort((first, second) => first.start - second.start || second.end - first.end);
	const merged: MatchRange[] = [];
	for (const range of ranges) {
		const previous = merged[merged.length - 1];
		if (previous && range.start < previous.end) previous.end = Math.max(previous.end, range.end);
		else merged.push({ ...range });
	}
	return merged;
}

/**
 * Markdown to one line of readable text: drops heading and list markers, emphasis, code fences,
 * image/link syntax and `[[id|label]]` wiki-link brackets, and collapses whitespace.
 */
export function plainTextFromMarkdown(markdown: string, readWikiLink?: WikiLinkTextResolver): string {
	return wikiLinksToText(markdown, readWikiLink)
		.replace(/```[^\n]*\n?/g, ' ')
		.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
		.replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+(\[[ xX]\]\s+)?/gm, '')
		.replace(/(\*\*|__|~~|`)/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * `[[id|label]]` as its label and `[[id]]` as `readWikiLink`'s text (the target's title), else the ID.
 */
export function wikiLinksToText(text: string, readWikiLink?: WikiLinkTextResolver): string {
	return text.replace(/\[\[([^\]\n]+)\]\]/g, (_whole, inner: string) => {
		const pipeIndex = inner.indexOf('|');
		const target = pipeIndex === -1 ? inner : inner.slice(0, pipeIndex);
		const label = pipeIndex === -1 ? '' : inner.slice(pipeIndex + 1);
		const noteId = target.split('#')[0];
		if (readWikiLink) return readWikiLink(noteId, label);
		return label || target;
	});
}

/**
 * Take the deleted-link marks (`markDeletedLinkText`) out of a built excerpt: the text without
 * them, the match offsets moved to suit, and the deleted links' ranges. A link cut by the
 * excerpt's ends runs to that end.
 */
export function extractDeletedLinks(snippet: SearchSnippet): SearchSnippet {
	const { text } = snippet;
	if (!text.includes(DELETED_LINK_OPEN) && !text.includes(DELETED_LINK_CLOSE)) return snippet;
	const newOffsetOf: number[] = [];
	const deletedLinks: MatchRange[] = [];
	let output = '';
	let openAt: number | null = null;
	let sawAnyMark = false;
	for (let index = 0; index <= text.length; index++) {
		newOffsetOf[index] = output.length;
		if (index === text.length) break;
		const character = text[index];
		if (character === DELETED_LINK_OPEN) {
			openAt = output.length;
			sawAnyMark = true;
		} else if (character === DELETED_LINK_CLOSE) {
			// A close with no open: the excerpt began inside the link
			const start = openAt ?? (sawAnyMark ? null : 0);
			if (start !== null && output.length > start) deletedLinks.push({ start, end: output.length });
			openAt = null;
			sawAnyMark = true;
		} else {
			output += character;
		}
	}
	if (openAt !== null && output.length > openAt) deletedLinks.push({ start: openAt, end: output.length });
	const matches = snippet.matches
		.map((range) => ({ start: newOffsetOf[range.start], end: newOffsetOf[range.end] }))
		.filter((range) => range.end > range.start);
	return { text: output, matches, ...(deletedLinks.length > 0 ? { deletedLinks } : {}) };
}

/**
 * The excerpt of `text` around the first match of `needle` (or of any of several needles), cut at
 * word boundaries where possible, with "…" where it was cut. Without a match it is the start of the
 * text and `matches` is empty.
 */
export function buildSearchSnippet(
	text: string,
	needle: string | readonly string[],
	options: { length?: number; contextBefore?: number } = {}
): SearchSnippet {
	const length = options.length ?? DEFAULT_SNIPPET_LENGTH;
	const contextBefore = options.contextBefore ?? DEFAULT_CONTEXT_BEFORE;
	const firstMatch = findMatchRanges(text, needle)[0];

	let start = firstMatch ? Math.max(0, firstMatch.start - contextBefore) : 0;
	if (start > 0) {
		const nextSpace = text.indexOf(' ', start);
		if (nextSpace !== -1 && firstMatch && nextSpace < firstMatch.start) start = nextSpace + 1;
	}
	let end = Math.min(text.length, start + length);
	if (firstMatch && end < firstMatch.end) end = firstMatch.end;
	if (end < text.length) {
		const lastSpace = text.lastIndexOf(' ', end);
		if (lastSpace > (firstMatch?.end ?? start)) end = lastSpace;
	}

	const prefix = start > 0 ? ELLIPSIS : '';
	const suffix = end < text.length ? ELLIPSIS : '';
	const excerpt = `${prefix}${text.slice(start, end)}${suffix}`;
	const matches = findMatchRanges(excerpt, needle).filter((range) => range.end <= excerpt.length - suffix.length);
	return { text: excerpt, matches };
}

export type SnippetPart = { text: string; isMatch: boolean; isDeletedLink?: boolean };

const inAnyRange = (ranges: readonly MatchRange[], start: number, end: number) =>
	ranges.some((range) => range.start <= start && end <= range.end);

/**
 * Split a snippet into plain, matched and deleted-link parts, for rendering `<mark>` and the
 * struck-through deleted link without `{@html}`.
 */
export function snippetParts(snippet: SearchSnippet): SnippetPart[] {
	const deletedLinks = snippet.deletedLinks ?? [];
	const boundaries = new Set<number>([0, snippet.text.length]);
	for (const range of [...snippet.matches, ...deletedLinks]) {
		boundaries.add(Math.max(0, Math.min(range.start, snippet.text.length)));
		boundaries.add(Math.max(0, Math.min(range.end, snippet.text.length)));
	}
	const sorted = [...boundaries].sort((first, second) => first - second);
	const parts: SnippetPart[] = [];
	for (let index = 0; index < sorted.length - 1; index++) {
		const start = sorted[index];
		const end = sorted[index + 1];
		const isMatch = inAnyRange(snippet.matches, start, end);
		const isDeletedLink = inAnyRange(deletedLinks, start, end);
		const previous = parts[parts.length - 1];
		if (previous && previous.isMatch === isMatch && Boolean(previous.isDeletedLink) === isDeletedLink) {
			previous.text += snippet.text.slice(start, end);
		} else {
			parts.push({ text: snippet.text.slice(start, end), isMatch, ...(isDeletedLink ? { isDeletedLink } : {}) });
		}
	}
	return parts;
}
