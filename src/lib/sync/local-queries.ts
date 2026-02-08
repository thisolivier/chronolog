/**
 * Local Query Helpers — Offline Data Joins
 *
 * Computes the same data shapes as the server APIs, but from local
 * storage. Used by SyncedDataService when the app is offline or
 * when a server request fails.
 *
 * Each function reads flat tables from the StorageAdapter and
 * performs client-side joins to produce the same result shape
 * as the corresponding API endpoint.
 */

import type { StorageAdapter } from '../storage/types';
import type {
	ContractsByClientResult,
	NoteSummary,
	NoteDetail,
	WeekData,
	DayData,
	TimeEntryDisplay
} from './data-types';
import { extractPreviewLines } from '$lib/utils/extract-preview-lines';
import { getWeekDates, getIsoWeekNumber, getIsoYear } from '$lib/utils/iso-week';

// ---------------------------------------------------------------------------
// Contracts by client
// ---------------------------------------------------------------------------

/**
 * Compute the same shape as GET /api/contracts-by-client from local storage.
 * Joins contracts with clients and counts notes per contract.
 */
export async function queryContractsByClient(
	storage: StorageAdapter
): Promise<ContractsByClientResult[]> {
	const [allContracts, allClients, allNotes] = await Promise.all([
		storage.getAll('contracts'),
		storage.getAll('clients'),
		storage.getAll('notes')
	]);

	// Build lookup maps
	const clientById = new Map(allClients.map((client) => [client.id, client]));

	// Count notes per contract
	const noteCountByContract = new Map<string, number>();
	for (const note of allNotes) {
		const currentCount = noteCountByContract.get(note.contractId) ?? 0;
		noteCountByContract.set(note.contractId, currentCount + 1);
	}

	// Build result with joins
	const results: ContractsByClientResult[] = [];
	for (const contract of allContracts) {
		const client = clientById.get(contract.clientId);
		if (!client) continue; // skip orphaned contracts

		results.push({
			id: contract.id,
			name: contract.name,
			isActive: contract.isActive,
			sortOrder: contract.sortOrder,
			clientId: client.id,
			clientName: client.name,
			clientShortCode: client.shortCode,
			noteCount: noteCountByContract.get(contract.id) ?? 0
		});
	}

	// Sort by sortOrder then name (matching server behavior)
	results.sort((contractA, contractB) => {
		const orderDiff = contractA.sortOrder - contractB.sortOrder;
		if (orderDiff !== 0) return orderDiff;
		return contractA.name.localeCompare(contractB.name);
	});

	return results;
}

// ---------------------------------------------------------------------------
// Notes for contract
// ---------------------------------------------------------------------------

/**
 * Compute the same shape as GET /api/notes?contractId=X from local storage.
 * Filters notes by contract, extracts preview lines, sorts by pinned then updatedAt.
 */
export async function queryNotesForContract(
	storage: StorageAdapter,
	contractId: string
): Promise<NoteSummary[]> {
	const contractNotes = await storage.query('notes', {
		contractId
	} as Partial<import('../storage/types').NoteRow>);

	const summaries: NoteSummary[] = contractNotes.map((note) => {
		const preview = extractPreviewLines(note.contentJson);
		return {
			id: note.id,
			contractId: note.contractId,
			isPinned: note.isPinned,
			createdAt: note.createdAt,
			updatedAt: note.updatedAt,
			firstLine: preview.firstLine,
			secondLine: preview.secondLine
		};
	});

	// Sort: pinned first, then by updatedAt descending
	summaries.sort((noteA, noteB) => {
		if (noteA.isPinned !== noteB.isPinned) {
			return noteA.isPinned ? -1 : 1;
		}
		return noteB.updatedAt.localeCompare(noteA.updatedAt);
	});

	return summaries;
}

// ---------------------------------------------------------------------------
// Single note
// ---------------------------------------------------------------------------

/**
 * Compute the same shape as GET /api/notes/[noteId] from local storage.
 */
export async function queryNoteById(
	storage: StorageAdapter,
	noteId: string
): Promise<NoteDetail | null> {
	const note = await storage.getById('notes', noteId);
	if (!note) return null;

	return {
		id: note.id,
		title: note.title,
		content: note.content,
		contentJson: note.contentJson,
		contractId: note.contractId,
		wordCount: note.wordCount,
		isPinned: note.isPinned,
		createdAt: note.createdAt,
		updatedAt: note.updatedAt
	};
}

// ---------------------------------------------------------------------------
// Weekly time entries
// ---------------------------------------------------------------------------

/**
 * Compute the same shape as GET /api/time-entries/weekly from local storage.
 * Joins time entries with contracts, clients, deliverables, and work types,
 * groups by week and day.
 */
export async function queryWeeklyTimeEntries(
	storage: StorageAdapter,
	weekStarts: string[]
): Promise<WeekData[]> {
	const [
		allTimeEntries,
		allContracts,
		allClients,
		allDeliverables,
		allWorkTypes,
		allWeeklyStatuses
	] = await Promise.all([
		storage.getAll('timeEntries'),
		storage.getAll('contracts'),
		storage.getAll('clients'),
		storage.getAll('deliverables'),
		storage.getAll('workTypes'),
		storage.getAll('weeklyStatuses')
	]);

	// Build lookup maps
	const contractById = new Map(allContracts.map((contract) => [contract.id, contract]));
	const clientById = new Map(allClients.map((client) => [client.id, client]));
	const deliverableById = new Map(allDeliverables.map((deliverable) => [deliverable.id, deliverable]));
	const workTypeById = new Map(allWorkTypes.map((workType) => [workType.id, workType]));

	// Build weekly status lookup
	const statusByKey = new Map(
		allWeeklyStatuses.map((status) => [`${status.year}-${status.weekNumber}`, status.status])
	);

	// Filter non-draft time entries and build a date-keyed map
	const entriesByDate = new Map<string, TimeEntryDisplay[]>();
	for (const entry of allTimeEntries) {
		if (entry.isDraft) continue;

		const contract = contractById.get(entry.contractId);
		const client = contract ? clientById.get(contract.clientId) : null;
		const deliverable = entry.deliverableId ? deliverableById.get(entry.deliverableId) : null;
		const workType = entry.workTypeId ? workTypeById.get(entry.workTypeId) : null;

		const display: TimeEntryDisplay = {
			id: entry.id,
			startTime: entry.startTime,
			endTime: entry.endTime,
			durationMinutes: entry.durationMinutes,
			contractId: entry.contractId,
			contractName: contract?.name ?? 'Unknown',
			clientName: client?.name ?? 'Unknown',
			clientShortCode: client?.shortCode ?? '??',
			deliverableName: deliverable?.name ?? null,
			workTypeName: workType?.name ?? null,
			description: entry.description,
			date: entry.date
		};

		const dateEntries = entriesByDate.get(entry.date) ?? [];
		dateEntries.push(display);
		entriesByDate.set(entry.date, dateEntries);
	}

	// Build week data for each requested week
	return weekStarts.map((weekStart) => {
		const weekDates = getWeekDates(weekStart);
		const year = getIsoYear(weekStart);
		const weekNumber = getIsoWeekNumber(weekStart);
		const status = statusByKey.get(`${year}-${weekNumber}`) ?? 'Unsubmitted';

		const days: DayData[] = weekDates.map((date) => {
			const entries = entriesByDate.get(date) ?? [];
			// Sort entries by start time
			entries.sort((entryA, entryB) => {
				const timeA = entryA.startTime ?? '';
				const timeB = entryB.startTime ?? '';
				return timeA.localeCompare(timeB);
			});
			const totalMinutes = entries.reduce(
				(sum, entry) => sum + entry.durationMinutes,
				0
			);
			return { date, entries, totalMinutes };
		});

		const weeklyTotalMinutes = days.reduce(
			(sum, day) => sum + day.totalMinutes,
			0
		);

		return { weekStart, days, weeklyTotalMinutes, status };
	});
}

// ---------------------------------------------------------------------------
// Note ID generation (offline)
// ---------------------------------------------------------------------------

/**
 * Generate a note ID locally when offline.
 * Mirrors the server logic in queries/notes.ts: CLIENT_SHORT_CODE.YYYYMMDD.SEQ
 */
export async function generateNoteIdLocally(
	storage: StorageAdapter,
	contractId: string
): Promise<string> {
	const contract = await storage.getById('contracts', contractId);
	if (!contract) throw new Error('Contract not found in local storage');

	const client = await storage.getById('clients', contract.clientId);
	if (!client) throw new Error('Client not found in local storage');

	const shortCode = client.shortCode;
	const today = new Date();
	const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
	const prefix = `${shortCode}.${dateStr}.`;

	// Find existing notes with this prefix
	const allNotes = await storage.getAll('notes');
	const matchingNotes = allNotes
		.filter((note) => note.id.startsWith(prefix))
		.sort((noteA, noteB) => noteB.id.localeCompare(noteA.id));

	let nextSequence = 1;
	if (matchingNotes.length > 0) {
		const lastId = matchingNotes[0].id;
		const lastSeqStr = lastId.split('.')[2];
		const lastSequence = parseInt(lastSeqStr, 10);
		nextSequence = lastSequence + 1;
	}

	const sequenceStr = nextSequence.toString().padStart(3, '0');
	return `${prefix}${sequenceStr}`;
}
