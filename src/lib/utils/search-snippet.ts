/**
 * Search snippets (sprint 042-CL): a short excerpt of a text around the first match of a query,
 * with the offsets of every match inside the excerpt, so the client can highlight them without
 * searching again. Case-insensitive substring matching, like the rest of Chronolog's search.
 */

export type MatchRange = { start: number; end: number };
export type SearchSnippet = { text: string; matches: MatchRange[] };

/** Characters kept before the first match (the rest of the budget goes after it) */
const DEFAULT_CONTEXT_BEFORE = 50;
const DEFAULT_SNIPPET_LENGTH = 180;
const ELLIPSIS = '…';

/** Every non-overlapping occurrence of `needle` in `text`, case-insensitive. */
export function findMatchRanges(text: string, needle: string): MatchRange[] {
	const lowerNeedle = needle.toLowerCase();
	if (!lowerNeedle) return [];
	const lowerText = text.toLowerCase();
	const ranges: MatchRange[] = [];
	let searchFrom = 0;
	for (;;) {
		const index = lowerText.indexOf(lowerNeedle, searchFrom);
		if (index === -1) break;
		ranges.push({ start: index, end: index + lowerNeedle.length });
		searchFrom = index + lowerNeedle.length;
	}
	return ranges;
}

/**
 * Markdown to one line of readable text: drops heading and list markers, emphasis, code fences,
 * image/link syntax and `[[id|label]]` wiki-link brackets, and collapses whitespace.
 */
export function plainTextFromMarkdown(markdown: string): string {
	return markdown
		.replace(/```[^\n]*\n?/g, ' ')
		.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
		.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
		.replace(/\[\[([^\]]+)\]\]/g, '$1')
		.replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+(\[[ xX]\]\s+)?/gm, '')
		.replace(/(\*\*|__|~~|`)/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * The excerpt of `text` around the first match of `needle`, cut at word boundaries where possible,
 * with "…" where it was cut. Without a match it is the start of the text and `matches` is empty.
 */
export function buildSearchSnippet(
	text: string,
	needle: string,
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

export type SnippetPart = { text: string; isMatch: boolean };

/** Split a snippet into plain and matched parts, for rendering `<mark>` without `{@html}`. */
export function snippetParts(snippet: SearchSnippet): SnippetPart[] {
	const parts: SnippetPart[] = [];
	let position = 0;
	for (const range of snippet.matches) {
		if (range.start < position) continue;
		if (range.start > position) parts.push({ text: snippet.text.slice(position, range.start), isMatch: false });
		parts.push({ text: snippet.text.slice(range.start, range.end), isMatch: true });
		position = range.end;
	}
	if (position < snippet.text.length) parts.push({ text: snippet.text.slice(position), isMatch: false });
	return parts;
}
