import type { DataService } from './data-service';
import { localDateString, localTimeString } from '$lib/components/timer/local-date';
import type { TimerLocalStart,
	ContractsByClientResult,
	ContractOption,
	CreateContractInput,
	ClientSummary,
	NoteSummary,
	NoteDetail,
	NotePinState,
	UpdateNoteInput,
	UpdateNoteOptions,
	CreateNoteInput,
	NoteSearchOptions,
	NoteSearchResult,
	NoteTitleInfo,
	RestoredNote,
	Backlink,
	AttachmentSummary,
	LinkedTimeEntryDisplay,
	TimeEntryFields,
	CreateTimeEntryInput,
	WeekData,
	TimerStatus,
	TimerEntry,
	SaveTimerInput,
	SplitTimerInput,
	SplitTimerResult,
	ResumeTimerOptions,
	DeliverableOption,
	WorkTypeOption
} from './types';
import { fetchJson, postJson, putJson, patchJson, deleteRequest } from './fetch-helpers';

/** Stay safely under the browser's 64 KB limit for keepalive request bodies */
const KEEPALIVE_BODY_LIMIT_BYTES = 60_000;

/**
 * DataService implementation backed by fetch() calls to SvelteKit API routes.
 * This replicates the same HTTP calls that components currently make directly.
 */
export class FetchDataService implements DataService {
	// -- Contracts --

	async getContractsByClient(): Promise<ContractsByClientResult[]> {
		// Archived ones included: the sidebar folds them under its Archived item (sprint 033-CL)
		const data = await fetchJson<{ contracts: ContractsByClientResult[] }>(
			'/api/contracts-by-client?includeArchived=true'
		);
		return data.contracts;
	}

	async getContracts(): Promise<ContractOption[]> {
		return fetchJson<ContractOption[]>('/api/contracts');
	}

	async createContract(data: CreateContractInput): Promise<{ id: string; clientId: string }> {
		return postJson<{ id: string; clientId: string }>('/api/contracts', data);
	}

	// -- Clients --

	async getClients(): Promise<ClientSummary[]> {
		const data = await fetchJson<{ clients: ClientSummary[] }>('/api/clients');
		return data.clients;
	}

	async reorderClients(orderedClientIds: string[]): Promise<void> {
		await patchJson('/api/clients/reorder', { orderedIds: orderedClientIds });
	}

	// -- Notes --

	async getNotesForContract(contractId: string): Promise<NoteSummary[]> {
		const data = await fetchJson<{ notes: NoteSummary[] }>(
			`/api/notes?contractId=${encodeURIComponent(contractId)}`
		);
		return data.notes;
	}

	async getNotesForClient(clientId: string): Promise<NoteSummary[]> {
		const data = await fetchJson<{ notes: NoteSummary[] }>(`/api/notes?clientId=${encodeURIComponent(clientId)}`);
		return data.notes;
	}

	async getAllNotes(): Promise<NoteSummary[]> {
		const data = await fetchJson<{ notes: NoteSummary[] }>('/api/notes?all=true');
		return data.notes;
	}

	async setNotePinned(noteId: string, pinned: boolean): Promise<NotePinState> {
		const data = await putJson<{ note: NotePinState }>(`/api/notes/${encodeURIComponent(noteId)}/pin`, { pinned });
		return data.note;
	}

	async getNoteById(noteId: string): Promise<NoteDetail> {
		const data = await fetchJson<{ note: NoteDetail }>(`/api/notes/${noteId}`);
		return data.note;
	}

	async createNote(contractId: string, initial?: CreateNoteInput): Promise<NoteSummary> {
		const data = await postJson<{ note: NoteSummary }>('/api/notes', { contractId, ...initial });
		return data.note;
	}

	async updateNote(
		noteId: string,
		updateData: UpdateNoteInput,
		options?: UpdateNoteOptions
	): Promise<NoteDetail> {
		// Browsers cap keepalive bodies at 64 KB; a larger note is sent normally instead
		const fitsKeepalive = JSON.stringify(updateData).length < KEEPALIVE_BODY_LIMIT_BYTES;
		const data = await putJson<{ note: NoteDetail }>(`/api/notes/${noteId}`, updateData, {
			keepalive: Boolean(options?.keepalive) && fitsKeepalive
		});
		return data.note;
	}

	async searchNotes(query: string, options?: NoteSearchOptions): Promise<NoteSearchResult[]> {
		const parameters = new URLSearchParams({ q: query });
		if (options?.excludeNoteId) parameters.set('exclude', options.excludeNoteId);
		if (options?.limit) parameters.set('limit', String(options.limit));
		if (options?.recent) parameters.set('recent', '1');
		const data = await fetchJson<{ notes: NoteSearchResult[] }>(`/api/notes/search?${parameters}`);
		return data.notes;
	}

	async getNoteTitles(noteIds: string[]): Promise<NoteTitleInfo[]> {
		if (noteIds.length === 0) return [];
		const parameters = new URLSearchParams({ ids: noteIds.join(',') });
		const data = await fetchJson<{ titles: NoteTitleInfo[] }>(`/api/notes/titles?${parameters}`);
		return data.titles;
	}

	async deleteNote(noteId: string): Promise<void> {
		await deleteRequest(`/api/notes/${noteId}`);
	}

	async restoreNote(noteId: string): Promise<RestoredNote> {
		return postJson<RestoredNote>(`/api/notes/${encodeURIComponent(noteId)}/restore`, {});
	}

	async getNoteBacklinks(noteId: string): Promise<Backlink[]> {
		const data = await fetchJson<{ backlinks: Backlink[] }>(`/api/notes/${noteId}/backlinks`);
		return data.backlinks;
	}

	// -- Attachments --

	async getNoteAttachments(noteId: string): Promise<AttachmentSummary[]> {
		const data = await fetchJson<{ attachments: AttachmentSummary[] }>(
			`/api/notes/${noteId}/attachments`
		);
		return data.attachments;
	}

	async uploadAttachment(noteId: string, file: File): Promise<{ id: string }> {
		const formData = new FormData();
		formData.append('file', file);
		const response = await fetch(`/api/notes/${noteId}/attachments`, {
			method: 'POST',
			body: formData
		});
		if (!response.ok) {
			const errorText = await response.text().catch(() => 'Unknown error');
			throw new Error(`Upload attachment failed (${response.status}): ${errorText}`);
		}
		// The route answers `{ attachment: { id, filename, ... } }`
		const data = (await response.json()) as { attachment: { id: string } };
		return { id: data.attachment.id };
	}

	async deleteAttachment(attachmentId: string): Promise<void> {
		await deleteRequest(`/api/attachments/${attachmentId}`);
	}

	// -- Note-Time Entry Links --

	async getNoteTimeEntries(noteId: string): Promise<LinkedTimeEntryDisplay[]> {
		const data = await fetchJson<{ timeEntries: LinkedTimeEntryDisplay[] }>(
			`/api/notes/${noteId}/time-entries`
		);
		return data.timeEntries;
	}

	async linkNoteTimeEntry(noteId: string, timeEntryId: string, headingAnchor?: string): Promise<void> {
		await postJson(`/api/notes/${noteId}/time-entries`, { timeEntryId, headingAnchor });
	}

	async unlinkNoteTimeEntry(noteId: string, timeEntryId: string): Promise<void> {
		await deleteRequest(`/api/notes/${noteId}/time-entries`, { timeEntryId });
	}

	// -- Time Entries --

	async getWeeklyTimeEntries(weekStarts: string[]): Promise<WeekData[]> {
		const weeksParam = weekStarts.map(encodeURIComponent).join(',');
		const data = await fetchJson<{ weeks: WeekData[] }>(
			`/api/time-entries/weekly?weeks=${weeksParam}`
		);
		return data.weeks;
	}

	async createTimeEntry(data: CreateTimeEntryInput): Promise<{ id: string }> {
		const responseData = await postJson<{ entry: { id: string } }>('/api/time-entries', data);
		return { id: responseData.entry.id };
	}

	async updateTimeEntry(entryId: string, data: Partial<TimeEntryFields>): Promise<void> {
		await putJson(`/api/time-entries/${entryId}`, data);
	}

	async deleteTimeEntry(entryId: string): Promise<void> {
		await deleteRequest(`/api/time-entries/${entryId}`);
	}

	async updateWeeklyStatus(year: number, weekNumber: number, status: string): Promise<void> {
		await postJson('/api/time-entries/weekly-statuses', { year, weekNumber, status });
	}

	// -- Timer --

	async getTimerStatus(): Promise<TimerStatus> {
		return fetchJson<TimerStatus>('/api/timer/status');
	}

	async startTimer(contractId: string, localStart?: TimerLocalStart): Promise<TimerEntry> {
		// Never guess a contract: hours bound to the wrong client are worse than no timer
		if (!contractId) {
			throw new Error('Pick a contract before the timer is saved to the server');
		}
		// The browser's local date and time, so an evening timer is never dated tomorrow (UTC)
		return postJson<TimerEntry>('/api/timer/start', {
			contractId,
			date: localStart?.date ?? localDateString(),
			startTime: localStart?.startTime ?? localTimeString(),
			// The start is now, or a timer already running in this page: no overlap question
			confirmed: true
		});
	}

	async adjustTimerStart(
		start: TimerLocalStart,
		options: { confirmed?: boolean; expectedStartedAt?: string } = {}
	): Promise<TimerEntry> {
		return patchJson<TimerEntry>('/api/timer', {
			date: start.date,
			startTime: start.startTime,
			confirmed: options.confirmed === true,
			// The start the caller shows: a draft moved or split elsewhere answers 409 timer_changed
			...(options.expectedStartedAt ? { expectedStartedAt: options.expectedStartedAt } : {})
		});
	}

	async stopTimer(): Promise<TimerEntry> {
		return postJson<TimerEntry>('/api/timer/stop', { endTime: localTimeString() });
	}

	async saveTimer(data: SaveTimerInput): Promise<void> {
		await postJson('/api/timer/save', data);
	}

	async discardTimer(entryId: string, options: { expectedStartedAt?: string } = {}): Promise<void> {
		await postJson('/api/timer/discard', { entryId, ...options });
	}

	async splitTimer(input: SplitTimerInput): Promise<SplitTimerResult> {
		return postJson<SplitTimerResult>('/api/timer/split', input);
	}

	async resumeTimer(options: ResumeTimerOptions = {}): Promise<TimerEntry> {
		return patchJson<TimerEntry>('/api/timer', {
			resume: true,
			...(options.start ? { date: options.start.date, startTime: options.start.startTime } : {}),
			confirmed: options.confirmed === true,
			...(options.expectedStartedAt ? { expectedStartedAt: options.expectedStartedAt } : {})
		});
	}

	// -- Deliverables & Work Types --
	// `includeArchived=true`: an old entry on an archived contract still shows its deliverable and
	// work type (sprint 031-CL made the API lists hide archived parents by default).

	async getDeliverables(contractId: string): Promise<DeliverableOption[]> {
		return fetchJson<DeliverableOption[]>(
			`/api/deliverables?contractId=${encodeURIComponent(contractId)}&includeArchived=true`
		);
	}

	async getWorkTypes(deliverableId: string): Promise<WorkTypeOption[]> {
		return fetchJson<WorkTypeOption[]>(
			`/api/work-types?deliverableId=${encodeURIComponent(deliverableId)}&includeArchived=true`
		);
	}
}
