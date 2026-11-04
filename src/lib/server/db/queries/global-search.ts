import { and, desc, eq, isNull } from 'drizzle-orm';
import { database, notes, contracts, clients, timeEntries } from '$lib/server/db';
import { noteDisplayTitle } from '$lib/utils/note-display-title';
import { decryptNullable, decryptText } from '$lib/server/crypto/server-cipher';
import {
	buildSearchSnippet,
	findMatchRanges,
	plainTextFromMarkdown,
	type MatchRange,
	type SearchSnippet
} from '$lib/utils/search-snippet';
import { rankNoteMatch } from './note-search';

/**
 * Global search (sprint 042-CL): the user's notes (ID, title, body) and time entries (description)
 * across every client, for `GET /api/search` and `chronolog search`.
 *
 * Every searched column is encrypted at rest, so, like `note-search.ts`, the rows are decrypted
 * and matched in memory. Never filter them with SQL `ILIKE`. Trashed notes are never returned.
 */

type HitContext = {
	clientId: string;
	clientName: string;
	clientShortCode: string;
	contractId: string;
	contractName: string;
};

export type NoteSearchHit = HitContext & {
	id: string;
	title: string;
	/** Where the note matched: its ID, its title (or first line) or its body */
	matchedIn: 'id' | 'title' | 'body';
	/** Match offsets inside `title` */
	titleMatches: MatchRange[];
	/** Excerpt of the body around the first body match (the start of the body otherwise) */
	snippet: SearchSnippet;
	updatedAt: Date;
};

export type TimeEntrySearchHit = HitContext & {
	id: string;
	/** YYYY-MM-DD */
	date: string;
	startTime: string | null;
	durationMinutes: number;
	snippet: SearchSnippet;
};

export type GlobalSearchResult = {
	query: string;
	notes: { hits: NoteSearchHit[]; total: number };
	timeEntries: { hits: TimeEntrySearchHit[]; total: number };
};

export const MINIMUM_QUERY_LENGTH = 2;

const MATCHED_IN_BY_RANK: Record<number, NoteSearchHit['matchedIn']> = {
	0: 'id',
	1: 'id',
	2: 'title',
	3: 'id',
	4: 'body'
};

function decryptContext(row: { clientId: string; clientName: string; clientShortCode: string; contractId: string; contractName: string }): HitContext {
	return {
		clientId: row.clientId,
		clientName: decryptText(row.clientName, 'clients.name'),
		clientShortCode: row.clientShortCode,
		contractId: row.contractId,
		contractName: decryptText(row.contractName, 'contracts.name')
	};
}

async function searchNotes(userId: string, needle: string, limit: number) {
	const rows = await database
		.select({
			id: notes.id,
			title: notes.title,
			content: notes.content,
			contentJson: notes.contentJson,
			updatedAt: notes.updatedAt,
			contractId: notes.contractId,
			contractName: contracts.name,
			clientId: clients.id,
			clientName: clients.name,
			clientShortCode: clients.shortCode
		})
		.from(notes)
		.innerJoin(contracts, eq(notes.contractId, contracts.id))
		.innerJoin(clients, eq(contracts.clientId, clients.id))
		.where(and(eq(notes.userId, userId), isNull(notes.deletedAt)))
		.orderBy(desc(notes.updatedAt));

	const ranked: Array<{ rank: number; order: number; hit: NoteSearchHit }> = [];
	rows.forEach((row, order) => {
		const title = decryptNullable(row.title, 'notes.title');
		const contentJson = decryptNullable(row.contentJson, 'notes.content_json');
		const displayTitle = noteDisplayTitle(title, contentJson) ?? row.id;
		const content = decryptNullable(row.content, 'notes.content') ?? '';
		const rank = rankNoteMatch(needle, row.id, displayTitle, content);
		if (rank === null) return;
		// The body usually opens with the title as a heading: the snippet starts after it
		const fullPlainBody = plainTextFromMarkdown(content);
		const plainBody = fullPlainBody.startsWith(displayTitle) ? fullPlainBody.slice(displayTitle.length).trim() : fullPlainBody;
		// A match only in the raw markdown (a link target, a marker) shows the raw text instead
		const matchesOnlyInMarkup = !fullPlainBody.toLowerCase().includes(needle) && content.toLowerCase().includes(needle);
		const snippetSource = matchesOnlyInMarkup ? content.replace(/\s+/g, ' ').trim() : plainBody;
		ranked.push({
			rank,
			order,
			hit: {
				id: row.id,
				title: displayTitle,
				matchedIn: MATCHED_IN_BY_RANK[rank],
				titleMatches: findMatchRanges(displayTitle, needle),
				snippet: buildSearchSnippet(snippetSource, needle),
				updatedAt: row.updatedAt,
				...decryptContext(row)
			}
		});
	});

	ranked.sort((left, right) => left.rank - right.rank || left.order - right.order);
	return { hits: ranked.slice(0, limit).map((entry) => entry.hit), total: ranked.length };
}

async function searchTimeEntries(userId: string, needle: string, limit: number) {
	const rows = await database
		.select({
			id: timeEntries.id,
			date: timeEntries.date,
			startTime: timeEntries.startTime,
			durationMinutes: timeEntries.durationMinutes,
			description: timeEntries.description,
			contractId: timeEntries.contractId,
			contractName: contracts.name,
			clientId: clients.id,
			clientName: clients.name,
			clientShortCode: clients.shortCode
		})
		.from(timeEntries)
		.innerJoin(contracts, eq(timeEntries.contractId, contracts.id))
		.innerJoin(clients, eq(contracts.clientId, clients.id))
		.where(eq(timeEntries.userId, userId))
		.orderBy(desc(timeEntries.date), desc(timeEntries.startTime), desc(timeEntries.createdAt));

	const hits: TimeEntrySearchHit[] = [];
	for (const row of rows) {
		const description = decryptNullable(row.description, 'time_entries.description');
		if (!description || !description.toLowerCase().includes(needle)) continue;
		hits.push({
			id: row.id,
			date: row.date,
			startTime: row.startTime,
			durationMinutes: row.durationMinutes,
			snippet: buildSearchSnippet(description.replace(/\s+/g, ' ').trim(), needle),
			...decryptContext(row)
		});
	}
	return { hits: hits.slice(0, limit), total: hits.length };
}

/**
 * Search a user's notes and time entries. Notes rank exact ID, ID prefix, title, ID substring,
 * then body (newest first within a rank); entries are newest first. `limit` applies per group and
 * `total` counts every match. A query shorter than two characters returns nothing.
 */
export async function searchEverythingForUser(userId: string, query: string, limit = 20): Promise<GlobalSearchResult> {
	const trimmedQuery = query.trim();
	const needle = trimmedQuery.toLowerCase();
	if (needle.length < MINIMUM_QUERY_LENGTH) {
		return { query: trimmedQuery, notes: { hits: [], total: 0 }, timeEntries: { hits: [], total: 0 } };
	}
	const [noteResults, entryResults] = await Promise.all([
		searchNotes(userId, needle, limit),
		searchTimeEntries(userId, needle, limit)
	]);
	return { query: trimmedQuery, notes: noteResults, timeEntries: entryResults };
}
