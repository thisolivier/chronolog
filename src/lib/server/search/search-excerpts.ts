/**
 * Excerpts and highlights for search hits (sprint 058-DR). Highlights cover every query word found
 * in the shown text (the whole phrase merges into one run). A hit that matched on client/contract
 * identity alone has no highlights: its snippet is the unhighlighted start of the record's own
 * text, never an invented excerpt, and `matchedIn: 'context'` plus `matchedContext` say why it matched.
 */
import {
	buildSearchSnippet,
	extractDeletedLinks,
	findMatchRanges,
	plainTextFromMarkdown,
	wikiLinksToText,
	type MatchRange,
	type SearchSnippet,
	type WikiLinkTextResolver
} from '$lib/utils/search-snippet';
import { highlightNeedles, type SearchQuery } from '$lib/search/record-matcher';
import type { NoteCandidate, TimeEntryCandidate } from './search-candidates';

export type NoteExcerpt = {
	/** Display title, falling back to the note ID */
	title: string;
	titleMatches: MatchRange[];
	snippet: SearchSnippet;
};

/**
 * The note's title highlights and a body excerpt around the first matched word. With
 * `readWikiLink` (global search, sprint 060-DR) a `[[id]]` in the excerpt reads as its target's
 * title, and a link to a trashed note comes back as a `deletedLinks` range.
 */
export function noteExcerpt(note: NoteCandidate, query: SearchQuery, readWikiLink?: WikiLinkTextResolver): NoteExcerpt {
	const needles = highlightNeedles(query);
	const title = note.displayTitle ?? note.id;
	// The body usually opens with the title as a heading: the snippet starts after it
	const content = note.readContent();
	const fullPlainBody = plainTextFromMarkdown(content, readWikiLink);
	const plainBody = fullPlainBody.startsWith(title) ? fullPlainBody.slice(title.length).trim() : fullPlainBody;
	// A word only in the raw markdown (a link target, a marker) shows the raw text instead
	const inPlain = findMatchRanges(fullPlainBody, needles).length > 0;
	const inMarkup = !inPlain && findMatchRanges(content, needles).length > 0;
	const snippetSource = inMarkup ? content.replace(/\s+/g, ' ').trim() : plainBody;
	return {
		title,
		titleMatches: findMatchRanges(title, needles),
		snippet: extractDeletedLinks(buildSearchSnippet(snippetSource, needles))
	};
}

/** The entry's description, around the first matched word, its `[[id]]` links read as titles. */
export function timeEntryExcerpt(entry: TimeEntryCandidate, query: SearchQuery, readWikiLink?: WikiLinkTextResolver): SearchSnippet {
	const description = wikiLinksToText(entry.description, readWikiLink);
	return extractDeletedLinks(buildSearchSnippet(description, highlightNeedles(query)));
}
