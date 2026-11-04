import { eq, and, desc, inArray, isNull } from 'drizzle-orm';
import { database, notes, contracts, clients } from '$lib/server/db';
import { extractPreviewLines } from '$lib/utils/extract-preview-lines';
import { extractMarkdownPreviewLines } from '$lib/utils/markdown-preview-lines';
import { noteDisplayTitle } from '$lib/utils/note-display-title';
import { decryptNullable, decryptText } from '$lib/server/crypto/server-cipher';
import { wikiLinkPreviewOptions } from './wiki-link-titles';

/**
 * Note search, `[[` autocomplete and title lookup.
 *
 * `notes.title`, `notes.content` and `notes.content_json` (and the contract/client names)
 * are encrypted at rest, so every match is done in memory after decrypting the user's
 * notes. Never filter these columns with SQL `ILIKE`: it would only ever see ciphertext.
 */

export type NoteSearchResult = {
	id: string;
	title: string | null;
	/** Stored title, else first content line, else null (callers fall back to the ID) */
	displayTitle: string | null;
	contractId: string;
	contractName: string;
	clientId: string;
	clientName: string;
	clientShortCode: string;
	firstLine: string;
	secondLine: string;
	updatedAt: Date;
};

export type NoteSearchOptions = {
	limit?: number;
	/** The note being edited; never offered as its own link target */
	excludeNoteId?: string;
};

/** Lower rank sorts first. Ties keep the newest-first order of the query. */
const RANK_EXACT_ID = 0;
const RANK_ID_PREFIX = 1;
const RANK_TITLE = 2;
const RANK_ID_CONTAINS = 3;
const RANK_BODY = 4;

/**
 * Rank how well a note matches `needle` (already lower-cased), or `null` for no match.
 * Exported for unit tests.
 */
export function rankNoteMatch(
	needle: string,
	noteId: string,
	displayTitle: string | null,
	content: string | null
): number | null {
	const lowerId = noteId.toLowerCase();
	if (lowerId === needle) return RANK_EXACT_ID;
	if (lowerId.startsWith(needle)) return RANK_ID_PREFIX;
	if (displayTitle && displayTitle.toLowerCase().includes(needle)) return RANK_TITLE;
	if (lowerId.includes(needle)) return RANK_ID_CONTAINS;
	if (content && content.toLowerCase().includes(needle)) return RANK_BODY;
	return null;
}

function selectNotesWithContract() {
	return database
		.select({
			id: notes.id,
			title: notes.title,
			content: notes.content,
			contentJson: notes.contentJson,
			contractId: notes.contractId,
			updatedAt: notes.updatedAt,
			deletedAt: notes.deletedAt,
			contractName: contracts.name,
			clientId: clients.id,
			clientName: clients.name,
			clientShortCode: clients.shortCode
		})
		.from(notes)
		.innerJoin(contracts, eq(notes.contractId, contracts.id))
		.innerJoin(clients, eq(contracts.clientId, clients.id));
}

type JoinedNoteRow = Awaited<ReturnType<typeof selectNotesWithContract>>[number];

function toSearchResult(row: JoinedNoteRow, title: string | null, contentJson: string | null): NoteSearchResult {
	const preview = extractPreviewLines(contentJson);
	return {
		id: row.id,
		title,
		displayTitle: noteDisplayTitle(title, contentJson),
		contractId: row.contractId,
		contractName: decryptText(row.contractName, 'contracts.name'),
		clientId: row.clientId,
		clientName: decryptText(row.clientName, 'clients.name'),
		clientShortCode: row.clientShortCode,
		firstLine: preview.firstLine,
		secondLine: preview.secondLine,
		updatedAt: row.updatedAt
	};
}

/**
 * Search a user's notes by ID, title/first line or markdown body (case-insensitive substring).
 * Ranked: exact ID, ID prefix, title, ID substring, body; newest first within a rank.
 * An empty query returns the most recently edited notes.
 */
export async function searchNotesForUser(
	userId: string,
	query: string,
	limitOrOptions: number | NoteSearchOptions = {}
): Promise<NoteSearchResult[]> {
	const options = typeof limitOrOptions === 'number' ? { limit: limitOrOptions } : limitOrOptions;
	const limit = options.limit ?? 10;
	const needle = query.trim().toLowerCase();

	const rows = await selectNotesWithContract()
		.where(and(eq(notes.userId, userId), isNull(notes.deletedAt)))
		.orderBy(desc(notes.updatedAt));

	const ranked: Array<{ rank: number; order: number; result: NoteSearchResult }> = [];
	rows.forEach((row, order) => {
		if (row.id === options.excludeNoteId) return;
		const title = decryptNullable(row.title, 'notes.title');
		const contentJson = decryptNullable(row.contentJson, 'notes.content_json');
		const displayTitle = noteDisplayTitle(title, contentJson);

		let rank: number | null = 0;
		if (needle) {
			rank = rankNoteMatch(needle, row.id, displayTitle, null);
			if (rank === null) {
				const content = decryptNullable(row.content, 'notes.content');
				rank = rankNoteMatch(needle, row.id, displayTitle, content);
			}
		}
		if (rank === null) return;
		ranked.push({ rank, order, result: toSearchResult(row, title, contentJson) });
	});

	ranked.sort((left, right) => left.rank - right.rank || left.order - right.order);
	return ranked.slice(0, limit).map((entry) => entry.result);
}

/**
 * Display titles (plus contract and client IDs, for cross-contract navigation) for a set
 * of note IDs owned by the user. Unknown or foreign IDs are simply absent from the result, and so
 * are trashed notes unless `includeDeleted`, which returns them with their `deletedAt` (the
 * wiki-link renderer shows those as "deleted" links that offer a restore, sprint 037-CL).
 */
export async function getNoteTitlesForUser(
	userId: string,
	noteIds: string[],
	options: { includeDeleted?: boolean } = {}
) {
	if (noteIds.length === 0) return [];
	const owned = and(eq(notes.userId, userId), inArray(notes.id, noteIds));
	const rows = await selectNotesWithContract().where(
		options.includeDeleted ? owned : and(owned, isNull(notes.deletedAt))
	);
	const decrypted = rows.map((row) => ({
		row,
		title: decryptNullable(row.title, 'notes.title'),
		content: decryptNullable(row.content, 'notes.content'),
		contentJson: decryptNullable(row.contentJson, 'notes.content_json')
	}));
	const previewOptions = await wikiLinkPreviewOptions(userId, decrypted);
	return decrypted.map(({ row, title, content, contentJson }) => {
		return {
			id: row.id,
			// A note created over the API (no JSON yet) is named by its markdown's first line (043)
			displayTitle:
				noteDisplayTitle(title, contentJson, previewOptions) ??
				(contentJson ? null : extractMarkdownPreviewLines(content, previewOptions).firstLine || null),
			contractId: row.contractId,
			clientId: row.clientId,
			...(options.includeDeleted ? { deletedAt: row.deletedAt } : {})
		};
	});
}
