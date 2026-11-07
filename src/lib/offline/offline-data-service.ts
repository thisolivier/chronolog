/**
 * The DataService the app uses (sprint 045-CL): `FetchDataService` plus the offline outbox.
 *
 * Writes in scope (note create and edit, time entry create, edit and delete) go to the server
 * when they can. They are queued instead when the server is unreachable, when the same note or
 * entry already waits in the queue (so nothing overtakes it), or when they link a note made
 * offline that has no real ID yet. Reads lay the queue over the server copy, fresh or cached.
 * Note moves, pins, trash and attachments are not queued: offline they fail as before. Timer
 * requests are not queued either; timer split and resume (sprint 056-DR) fail offline with a
 * clear "not available offline" error (`online-only.ts`).
 */
import { FetchDataService } from '$lib/services/fetch-data-service';
import { cachedReadsStartingWith, peekCachedRead } from '$lib/services/fetch-helpers';
import { connectivity } from '$lib/stores/connectivity.svelte';
import type {
	CreateNoteInput,
	CreateTimeEntryInput,
	NoteDetail,
	ResumeTimerOptions,
	SplitTimerInput,
	SplitTimerResult,
	TimerEntry,
	NoteSearchOptions,
	NoteSearchResult,
	NoteSummary,
	NoteTitleInfo,
	TimeEntryDisplay,
	TimeEntryFields,
	UpdateNoteInput,
	UpdateNoteOptions,
	WeekData
} from '$lib/services/types';
import { outbox } from './outbox-store.svelte';
import {
	newTempId,
	queueEntryCreate,
	queueEntryDelete,
	queueEntryUpdate,
	queueNoteCreate,
	queueNoteUpdate,
	replaceTempIds,
	tempIdsIn
} from './outbox-queue';
import { isTempId, type NoteCreateItem, type NoteFieldValues } from './outbox-types';
import { findQueuedNoteCreate, noteDetailFromCreate, previewLines, projectNoteDetail, projectNoteSummaries, projectWeeks } from './outbox-projection';
import { cachedEntry, entryDisplayNames, knownNotes, searchCachedNotes, titlesFromCache, weeksFromCache, type CachedRead } from './offline-reads';
import { isOfflineError } from './replay-transport';
import { compareRanked, matchNote, parseSearchQuery } from '$lib/search/record-matcher';
import { scheduleReplay, substituteExpectedUpdatedAt } from './offline-session.svelte';
import { runOnlineOnly } from './online-only';

const NOTE_FIELDS = ['title', 'content', 'contentJson'] as const;
const ENTRY_FIELDS = ['contractId', 'deliverableId', 'workTypeId', 'date', 'startTime', 'endTime', 'durationMinutes', 'description'] as const;

function now(): string {
	return new Date().toISOString();
}

function pickNoteFields(source: Partial<Record<(typeof NOTE_FIELDS)[number], unknown>>, idMap: Record<string, string>): NoteFieldValues {
	const fields: NoteFieldValues = {};
	for (const field of NOTE_FIELDS) {
		const value = source[field];
		if (typeof value === 'string') fields[field] = replaceTempIds(value, idMap);
	}
	return fields;
}

function entryBase(entry: TimeEntryDisplay | null): Partial<TimeEntryFields> | null {
	if (!entry) return null;
	const base: Partial<TimeEntryFields> = {};
	for (const field of ENTRY_FIELDS) {
		if (entry[field] !== undefined) Object.assign(base, { [field]: entry[field] });
	}
	return base;
}

function contractReads(): CachedRead[] {
	return [...cachedReadsStartingWith('/api/contracts'), ...cachedReadsStartingWith('/api/deliverables'), ...cachedReadsStartingWith('/api/work-types')];
}

function weeklyReads(): CachedRead[] {
	return cachedReadsStartingWith('/api/time-entries/weekly');
}

export class OfflineDataService extends FetchDataService {
	private items() {
		return outbox.isOpen ? outbox.read().items : [];
	}

	private idMap(): Record<string, string> {
		return outbox.isOpen ? outbox.idMap() : {};
	}

	/** Queue without trying the server: offline, behind a queued item, or linking an unsent note */
	private mustQueue(resourceKey: string | null, text: string | null | undefined): boolean {
		if (!outbox.isOpen) return false;
		if (connectivity.isOffline) return true;
		if (resourceKey && outbox.hasItemFor(resourceKey)) return true;
		const state = outbox.read();
		return tempIdsIn(text).some(
			(tempId) => !state.idMap[tempId] && state.items.some((item) => item.kind === 'note-create' && item.tempId === tempId)
		);
	}

	/**
	 * A server row that is also still a queued create (its create reached the server but the answer
	 * was lost): edits go into that create, under its temp ID, so they are sent after it and are
	 * not overwritten by its older values when it is replayed.
	 */
	private queuedCreateAlias(type: 'note' | 'entry', id: string): string {
		if (isTempId(id) || !outbox.isOpen) return id;
		const requestId =
			type === 'note'
				? peekCachedRead<{ note: { clientRequestId?: string | null } }>(`/api/notes/${id}`)?.note?.clientRequestId
				: cachedEntry(weeklyReads(), id)?.clientRequestId;
		if (!requestId) return id;
		const queued = this.items().some(
			(item) => (item.kind === 'note-create' && item.tempId === requestId && !item.realId) || (item.kind === 'entry-create' && item.tempId === requestId)
		);
		return queued ? requestId : id;
	}

	private canQueueAfter(error: unknown): boolean {
		return outbox.isOpen && isOfflineError(error);
	}

	// -- Notes --

	async getNoteById(noteId: string): Promise<NoteDetail> {
		const resolvedId = this.idMap()[noteId] ?? noteId;
		const items = this.items();
		const queuedCreate = findQueuedNoteCreate(items, resolvedId);
		if (queuedCreate && !queuedCreate.realId) return noteDetailFromCreate(queuedCreate);
		try {
			return projectNoteDetail(await super.getNoteById(resolvedId), items);
		} catch (error) {
			if (queuedCreate) return noteDetailFromCreate(queuedCreate);
			throw error;
		}
	}

	async createNote(contractId: string, initial?: CreateNoteInput): Promise<NoteSummary> {
		const fields = pickNoteFields(initial ?? {}, this.idMap());
		// One ID for the online try and, if it fails, the queued create: the server makes the note
		// once even if the first request got there and only its answer was lost (review fix 1)
		const tempId = initial?.clientRequestId ?? newTempId();
		if (this.mustQueue(null, JSON.stringify(fields))) return this.queueCreatedNote(contractId, fields, tempId);
		try {
			return await super.createNote(contractId, { ...initial, ...fields, clientRequestId: tempId });
		} catch (error) {
			if (this.canQueueAfter(error)) return this.queueCreatedNote(contractId, fields, tempId);
			throw error;
		}
	}

	private queueCreatedNote(contractId: string, fields: NoteFieldValues, tempId: string): NoteSummary {
		let created: NoteCreateItem | null = null;
		outbox.update((state) => {
			created = queueNoteCreate(state, { tempId, contractId, fields, now: now() });
		});
		scheduleReplay();
		const item = created as unknown as NoteCreateItem;
		return {
			id: item.tempId,
			contractId,
			isPinned: false,
			pinnedAt: null,
			createdAt: item.queuedAt,
			updatedAt: item.queuedAt,
			...previewLines(fields)
		};
	}

	async updateNote(noteId: string, data: UpdateNoteInput, options?: UpdateNoteOptions): Promise<NoteDetail> {
		const idMap = this.idMap();
		const resolvedId = this.queuedCreateAlias('note', idMap[noteId] ?? noteId);
		// A move changes the note's place, not its text: it is never queued
		if (data.contractId) return super.updateNote(resolvedId, data, options);
		const outgoing: UpdateNoteInput = {
			...data,
			...pickNoteFields(data, idMap),
			expectedUpdatedAt: substituteExpectedUpdatedAt(resolvedId, data.expectedUpdatedAt)
		};
		if (isTempId(resolvedId) || this.mustQueue(`note:${resolvedId}`, JSON.stringify(pickNoteFields(outgoing, {})))) {
			return this.queueNoteEdit(resolvedId, outgoing);
		}
		try {
			return await super.updateNote(resolvedId, outgoing, options);
		} catch (error) {
			if (this.canQueueAfter(error)) return this.queueNoteEdit(resolvedId, outgoing);
			throw error;
		}
	}

	private queueNoteEdit(noteId: string, data: UpdateNoteInput): NoteDetail {
		const changes = pickNoteFields(data, {});
		const cached = peekCachedRead<{ note: NoteDetail }>(`/api/notes/${noteId}`)?.note;
		const cacheIsBase = Boolean(cached) && (!data.expectedUpdatedAt || cached?.updatedAt === data.expectedUpdatedAt);
		const base = cacheIsBase && cached ? pickNoteFields(cached as unknown as Record<string, unknown>, {}) : null;
		outbox.update((state) => {
			queueNoteUpdate(state, {
				noteId,
				baseUpdatedAt: data.expectedUpdatedAt ?? cached?.updatedAt ?? null,
				base,
				changes,
				now: now()
			});
		});
		scheduleReplay();
		const items = outbox.items;
		const queuedCreate = findQueuedNoteCreate(items, noteId);
		if (queuedCreate) return noteDetailFromCreate(queuedCreate);
		const shown = projectNoteDetail(
			cached ?? {
				id: noteId,
				title: null,
				content: null,
				contentJson: null,
				contractId: '',
				wordCount: 0,
				isPinned: false,
				createdAt: '',
				updatedAt: ''
			},
			items
		);
		// The editor keeps the copy it was based on as its conflict check
		return { ...shown, updatedAt: data.expectedUpdatedAt ?? shown.updatedAt };
	}

	async getNotesForContract(contractId: string): Promise<NoteSummary[]> {
		return this.projectedList(() => super.getNotesForContract(contractId), (candidate) => candidate === contractId);
	}

	async getNotesForClient(clientId: string): Promise<NoteSummary[]> {
		const clientContracts = new Set(
			cachedReadsStartingWith('/api/contracts')
				.flatMap(([, body]) => (Array.isArray(body) ? body : ((body as { contracts?: unknown[] })?.contracts ?? [])))
				.filter((contract) => (contract as { clientId?: string }).clientId === clientId)
				.map((contract) => (contract as { id: string }).id)
		);
		return this.projectedList(() => super.getNotesForClient(clientId), (contractId) => clientContracts.has(contractId));
	}

	async getAllNotes(): Promise<NoteSummary[]> {
		return this.projectedList(() => super.getAllNotes(), () => true);
	}

	private async projectedList(
		load: () => Promise<NoteSummary[]>,
		includesContract: (contractId: string) => boolean
	): Promise<NoteSummary[]> {
		const items = this.items();
		try {
			return projectNoteSummaries(await load(), items, includesContract);
		} catch (error) {
			const queuedHere = items.some((item) => item.kind === 'note-create' && includesContract(item.contractId));
			if (queuedHere && isOfflineError(error)) return projectNoteSummaries([], items, includesContract);
			throw error;
		}
	}

	async searchNotes(query: string, options: NoteSearchOptions = {}): Promise<NoteSearchResult[]> {
		let results: NoteSearchResult[];
		try {
			results = await super.searchNotes(query, options);
		} catch (error) {
			if (!isOfflineError(error)) throw error;
			const reads = contractReads();
			results = searchCachedNotes(query, options, knownNotes(cachedReadsStartingWith('/api/notes')), reads);
		}
		// Notes still waiting in the outbox, matched and ranked like the server's (058-DR shared matcher)
		const parsed = parseSearchQuery(query);
		const queued = this.items()
			.filter((item): item is NoteCreateItem => item.kind === 'note-create' && !item.realId)
			.map((item) => noteDetailFromCreate(item))
			.filter((note) => note.id !== options.excludeNoteId)
			.flatMap((note): NoteSearchResult[] => {
				const result = this.searchResultFor(note);
				if (parsed.terms.length === 0) return options.recent ? [{ ...result, rank: null, matchedIn: null, matchedContext: [] }] : [];
				const match = matchNote(parsed, { ...result, title: result.displayTitle, body: note.content });
				return match ? [{ ...result, ...match }] : [];
			});
		if (queued.length === 0) return results;
		// One list in shared rank order (the recent list has no rank: recency alone), then the limit
		const merged = [...queued, ...results]
			.map((result) => ({ result, rank: result.rank ?? 0, recency: result.updatedAt, id: result.id }))
			.sort(compareRanked)
			.map(({ result }) => result);
		return options.limit ? merged.slice(0, options.limit) : merged;
	}

	private searchResultFor(note: NoteDetail): NoteSearchResult {
		const lines = previewLines({ content: note.content ?? undefined, contentJson: note.contentJson ?? undefined });
		const names = entryDisplayNames(contractReads(), { contractId: note.contractId });
		return {
			id: note.id,
			title: note.title,
			displayTitle: note.title || lines.firstLine || null,
			contractId: note.contractId,
			contractName: names.contractName ?? '',
			clientId: names.clientId ?? '',
			clientName: names.clientName ?? '',
			clientShortCode: names.clientShortCode ?? '',
			updatedAt: note.updatedAt,
			...lines
		};
	}

	async getNoteTitles(noteIds: string[]): Promise<NoteTitleInfo[]> {
		const idMap = this.idMap();
		const items = this.items();
		const fromQueue: NoteTitleInfo[] = [];
		const askServer = new Map<string, string>();
		for (const requestedId of noteIds) {
			const resolvedId = idMap[requestedId] ?? requestedId;
			const queuedCreate = findQueuedNoteCreate(items, resolvedId);
			if (queuedCreate && !queuedCreate.realId) {
				const result = this.searchResultFor(noteDetailFromCreate(queuedCreate));
				fromQueue.push({ id: requestedId, displayTitle: result.displayTitle, contractId: result.contractId, clientId: result.clientId });
			} else {
				askServer.set(resolvedId, requestedId);
			}
		}
		let titles: NoteTitleInfo[];
		try {
			titles = await super.getNoteTitles([...askServer.keys()]);
		} catch (error) {
			if (!isOfflineError(error)) throw error;
			titles = titlesFromCache([...askServer.keys()], knownNotes(cachedReadsStartingWith('/api/notes')), contractReads());
		}
		return [...fromQueue, ...titles.map((title) => ({ ...title, id: askServer.get(title.id) ?? title.id }))];
	}

	// -- Time entries --

	async getWeeklyTimeEntries(weekStarts: string[]): Promise<WeekData[]> {
		let weeks: WeekData[];
		try {
			weeks = await super.getWeeklyTimeEntries(weekStarts);
		} catch (error) {
			const cachedWeeks = isOfflineError(error) ? weeksFromCache(weekStarts, weeklyReads()) : null;
			if (!cachedWeeks) throw error;
			weeks = cachedWeeks;
		}
		return projectWeeks(weeks, this.items());
	}

	async createTimeEntry(data: CreateTimeEntryInput): Promise<{ id: string }> {
		const { clientRequestId, ...fields } = data;
		const outgoing = { ...fields, ...(fields.description ? { description: replaceTempIds(fields.description, this.idMap()) } : {}) };
		// Same ID online and in the queue: never a second entry for one save (review fix 1)
		const tempId = clientRequestId ?? newTempId();
		if (this.mustQueue(null, outgoing.description)) return this.queueCreatedEntry(outgoing, tempId);
		try {
			return await super.createTimeEntry({ ...outgoing, clientRequestId: tempId });
		} catch (error) {
			if (this.canQueueAfter(error)) return this.queueCreatedEntry(outgoing, tempId);
			throw error;
		}
	}

	private queueCreatedEntry(input: CreateTimeEntryInput, tempId: string): { id: string } {
		const display: TimeEntryDisplay = {
			id: tempId,
			startTime: input.startTime ?? null,
			endTime: input.endTime ?? null,
			durationMinutes: input.durationMinutes,
			contractId: input.contractId,
			contractName: '',
			clientName: '',
			clientShortCode: '',
			clientColorIndex: 0,
			deliverableId: input.deliverableId ?? null,
			deliverableName: null,
			workTypeId: input.workTypeId ?? null,
			workTypeName: null,
			description: input.description ?? null,
			date: input.date,
			...entryDisplayNames(contractReads(), input)
		};
		outbox.update((state) => {
			queueEntryCreate(state, { tempId, input, display, now: now() });
		});
		scheduleReplay();
		return { id: tempId };
	}

	async updateTimeEntry(entryId: string, data: Partial<TimeEntryFields>): Promise<void> {
		const idMap = this.idMap();
		const resolvedId = this.queuedCreateAlias('entry', idMap[entryId] ?? entryId);
		const outgoing = { ...data };
		if (typeof outgoing.description === 'string') outgoing.description = replaceTempIds(outgoing.description, idMap);
		if (isTempId(resolvedId) || this.mustQueue(`entry:${resolvedId}`, outgoing.description)) {
			return this.queueEntryEdit(resolvedId, outgoing);
		}
		try {
			await super.updateTimeEntry(resolvedId, outgoing);
		} catch (error) {
			if (this.canQueueAfter(error)) return this.queueEntryEdit(resolvedId, outgoing);
			throw error;
		}
	}

	private queueEntryEdit(entryId: string, changes: Partial<TimeEntryFields>): void {
		const displayPatch = { ...changes, ...entryDisplayNames(contractReads(), changes) };
		outbox.update((state) => {
			queueEntryUpdate(state, { entryId, base: entryBase(cachedEntry(weeklyReads(), entryId)), changes, displayPatch, now: now() });
		});
		scheduleReplay();
	}

	async deleteTimeEntry(entryId: string): Promise<void> {
		const resolvedId = this.queuedCreateAlias('entry', this.idMap()[entryId] ?? entryId);
		if (isTempId(resolvedId) || this.mustQueue(`entry:${resolvedId}`, null)) return this.queueEntryRemoval(resolvedId);
		try {
			await super.deleteTimeEntry(resolvedId);
		} catch (error) {
			if (this.canQueueAfter(error)) return this.queueEntryRemoval(resolvedId);
			throw error;
		}
	}

	// -- Timer: online only, never queued --

	async splitTimer(input: SplitTimerInput): Promise<SplitTimerResult> {
		return runOnlineOnly('Splitting the timer', () => super.splitTimer(input));
	}

	async resumeTimer(options?: ResumeTimerOptions): Promise<TimerEntry> {
		return runOnlineOnly('Resuming the timer', () => super.resumeTimer(options));
	}

	private queueEntryRemoval(entryId: string): void {
		const entry = cachedEntry(weeklyReads(), entryId);
		outbox.update((state) => {
			queueEntryDelete(state, { entryId, base: entryBase(entry), date: entry?.date ?? null, now: now() });
		});
		scheduleReplay();
	}
}
