/**
 * The HTTP side of the outbox replay (sprint 045-CL): the same routes the app, the CLI and the
 * laptop secretary use, with reads that never answer from the cache.
 */
import { deleteRequest, fetchFreshJson, HttpError, isGatewayStatus, postJson, putJson, SessionExpiredError } from '$lib/services/fetch-helpers';
import type { CreateTimeEntryInput, NoteDetail, TimeEntryFields } from '$lib/services/types';
import type { ErrorKind, ReplayTransport } from './outbox-replay';
import type { ServerEntry, ServerNote } from './outbox-merge';

function isNotFound(error: unknown): boolean {
	return error instanceof HttpError && error.status === 404;
}

/** Offline-type failures: no answer at all, or the proxy saying the server is down */
export function isOfflineError(error: unknown): boolean {
	if (error instanceof HttpError) return isGatewayStatus(error.status);
	if (error instanceof SessionExpiredError) return false;
	if (error instanceof Error && error.name === 'AbortError') return false;
	return error instanceof TypeError;
}

export function classifyReplayError(error: unknown): ErrorKind {
	if (error instanceof SessionExpiredError) return 'session';
	if (isOfflineError(error)) return 'network';
	if (error instanceof HttpError && error.status === 409) return 'conflict';
	if (error instanceof HttpError) return 'refused';
	return 'network';
}

export const replayTransport: ReplayTransport = {
	async createNote(contractId, fields) {
		const data = await postJson<{ note: { id: string; updatedAt: string } }>('/api/notes', { contractId, ...fields });
		return { id: data.note.id, updatedAt: data.note.updatedAt };
	},
	async getNote(noteId): Promise<ServerNote | null> {
		try {
			const data = await fetchFreshJson<{ note: NoteDetail }>(`/api/notes/${encodeURIComponent(noteId)}`);
			return data.note;
		} catch (error) {
			if (isNotFound(error)) return null;
			throw error;
		}
	},
	async putNote(noteId, body) {
		const data = await putJson<{ note: NoteDetail }>(`/api/notes/${encodeURIComponent(noteId)}`, body);
		return { updatedAt: data.note.updatedAt };
	},
	async createEntry(input: CreateTimeEntryInput) {
		const data = await postJson<{ entry: { id: string } }>('/api/time-entries', input);
		return { id: data.entry.id };
	},
	async getEntry(entryId): Promise<ServerEntry | null> {
		try {
			const data = await fetchFreshJson<{ entry: ServerEntry }>(`/api/time-entries/${encodeURIComponent(entryId)}`);
			return data.entry;
		} catch (error) {
			if (isNotFound(error)) return null;
			throw error;
		}
	},
	async putEntry(entryId, body: Partial<TimeEntryFields>) {
		await putJson(`/api/time-entries/${encodeURIComponent(entryId)}`, body);
	},
	async deleteEntry(entryId) {
		try {
			await deleteRequest(`/api/time-entries/${encodeURIComponent(entryId)}`);
		} catch (error) {
			if (!isNotFound(error)) throw error;
		}
	}
};
