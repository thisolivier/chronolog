import type { DataService } from './data-service';
import type {
	ContractsByClientResult,
	ContractOption,
	CreateContractInput,
	ClientSummary,
	NoteSummary,
	NoteDetail,
	UpdateNoteInput,
	Backlink,
	AttachmentSummary,
	NoteTimeEntryLink,
	TimeEntryFields,
	CreateTimeEntryInput,
	WeekData,
	WeekSummary,
	TimerStatus,
	TimerEntry,
	SaveTimerInput,
	DeliverableOption,
	WorkTypeOption
} from './types';
import { fetchJson, postJson, putJson, deleteRequest } from './fetch-helpers';

/**
 * DataService implementation backed by fetch() calls to SvelteKit API routes.
 * This replicates the same HTTP calls that components currently make directly.
 */
export class FetchDataService implements DataService {
	// -- Contracts --

	async getContractsByClient(): Promise<ContractsByClientResult[]> {
		const data = await fetchJson<{ contracts: ContractsByClientResult[] }>(
			'/api/contracts-by-client'
		);
		return data.contracts;
	}

	async getContracts(): Promise<ContractOption[]> {
		return fetchJson<ContractOption[]>('/api/contracts');
	}

	async createContract(data: CreateContractInput): Promise<{ id: string }> {
		return postJson<{ id: string }>('/api/contracts', data);
	}

	// -- Clients --

	async getClients(): Promise<ClientSummary[]> {
		const data = await fetchJson<{ clients: ClientSummary[] }>('/api/clients');
		return data.clients;
	}

	// -- Notes --

	async getNotesForContract(contractId: string): Promise<NoteSummary[]> {
		const data = await fetchJson<{ notes: NoteSummary[] }>(
			`/api/notes?contractId=${encodeURIComponent(contractId)}`
		);
		return data.notes;
	}

	async getNoteById(noteId: string): Promise<NoteDetail> {
		const data = await fetchJson<{ note: NoteDetail }>(`/api/notes/${noteId}`);
		return data.note;
	}

	async createNote(contractId: string): Promise<NoteSummary> {
		const data = await postJson<{ note: NoteSummary }>('/api/notes', { contractId });
		return data.note;
	}

	async updateNote(noteId: string, updateData: UpdateNoteInput): Promise<NoteDetail> {
		const data = await putJson<{ note: NoteDetail }>(`/api/notes/${noteId}`, updateData);
		return data.note;
	}

	async deleteNote(noteId: string): Promise<void> {
		await deleteRequest(`/api/notes/${noteId}`);
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
		return response.json() as Promise<{ id: string }>;
	}

	async deleteAttachment(attachmentId: string): Promise<void> {
		await deleteRequest(`/api/attachments/${attachmentId}`);
	}

	// -- Note-Time Entry Links --

	async getNoteTimeEntries(noteId: string): Promise<NoteTimeEntryLink[]> {
		const data = await fetchJson<{ timeEntries: NoteTimeEntryLink[] }>(
			`/api/notes/${noteId}/time-entries`
		);
		return data.timeEntries;
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

	async getWeekSummaries(count: number, before?: string): Promise<WeekSummary[]> {
		let url = `/api/weeks?count=${count}`;
		if (before) {
			url += `&before=${encodeURIComponent(before)}`;
		}
		const data = await fetchJson<{ weeks: WeekSummary[] }>(url);
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

	async startTimer(contractId?: string): Promise<TimerEntry> {
		let resolvedContractId = contractId;
		if (!resolvedContractId) {
			const contracts = await this.getContracts();
			const firstActive = contracts.find((contract) => contract.isActive);
			if (!firstActive) {
				throw new Error('No active contracts available to start timer');
			}
			resolvedContractId = firstActive.id;
		}
		return postJson<TimerEntry>('/api/timer/start', { contractId: resolvedContractId });
	}

	async stopTimer(): Promise<TimerEntry> {
		return postJson<TimerEntry>('/api/timer/stop', {});
	}

	async saveTimer(data: SaveTimerInput): Promise<void> {
		await postJson('/api/timer/save', data);
	}

	async discardTimer(entryId: string): Promise<void> {
		await postJson('/api/timer/discard', { entryId });
	}

	// -- Deliverables & Work Types --

	async getDeliverables(contractId: string): Promise<DeliverableOption[]> {
		return fetchJson<DeliverableOption[]>(
			`/api/deliverables?contractId=${encodeURIComponent(contractId)}`
		);
	}

	async getWorkTypes(deliverableId: string): Promise<WorkTypeOption[]> {
		return fetchJson<WorkTypeOption[]>(
			`/api/work-types?deliverableId=${encodeURIComponent(deliverableId)}`
		);
	}
}
