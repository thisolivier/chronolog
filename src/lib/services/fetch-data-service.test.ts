/**
 * Tests for FetchDataService, DelegatingDataService, and DataService interface.
 *
 * Mocks the global fetch() to verify that each DataService method makes the
 * correct HTTP call (URL, method, body) and unpacks the response properly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FetchDataService } from './fetch-data-service';
import { DelegatingDataService } from './delegating-data-service';
import type { DataService } from './data-service';
import type {
	ContractsByClientResult,
	ContractOption,
	ClientSummary,
	NoteSummary,
	NoteDetail,
	Backlink,
	AttachmentSummary,
	LinkedTimeEntryDisplay,
	WeekData,
	TimerStatus,
	TimerEntry,
	DeliverableOption,
	WorkTypeOption
} from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a mock Response that returns the given JSON body with status 200.
 */
function mockJsonResponse(body: unknown): Response {
	return {
		ok: true,
		status: 200,
		json: () => Promise.resolve(body),
		text: () => Promise.resolve(JSON.stringify(body))
	} as unknown as Response;
}

/**
 * Creates a mock Response that represents an HTTP error.
 */
function mockErrorResponse(status: number, errorText: string): Response {
	return {
		ok: false,
		status,
		json: () => Promise.reject(new Error('not json')),
		text: () => Promise.resolve(errorText)
	} as unknown as Response;
}

/**
 * Extracts the parsed JSON body from the most recent fetch call.
 */
function getLastFetchBody(mockFetch: ReturnType<typeof vi.fn>): unknown {
	const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
	const options = lastCall[1] as RequestInit | undefined;
	if (options?.body && typeof options.body === 'string') {
		return JSON.parse(options.body);
	}
	return undefined;
}

/**
 * Returns [url, options] from the last fetch call.
 */
function getLastFetchCall(
	mockFetch: ReturnType<typeof vi.fn>
): [string, RequestInit | undefined] {
	const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
	return [lastCall[0] as string, lastCall[1] as RequestInit | undefined];
}

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

let mockFetch: ReturnType<typeof vi.fn>;
let service: FetchDataService;

beforeEach(() => {
	mockFetch = vi.fn();
	vi.stubGlobal('fetch', mockFetch);
	service = new FetchDataService();
});

afterEach(() => {
	vi.restoreAllMocks();
});

// ===========================================================================
// FetchDataService
// ===========================================================================

describe('FetchDataService', () => {
	// ── Contracts ─────────────────────────────────────────────

	describe('getContractsByClient', () => {
		it('calls GET /api/contracts-by-client with archived ones and unwraps .contracts', async () => {
			const contracts: ContractsByClientResult[] = [
				{
					id: 'c1',
					name: 'Contract A',
					isActive: true,
					clientId: 'cl1',
					clientName: 'Client A',
					clientShortCode: 'CA',
					clientEmoji: null,
					clientColorIndex: 0,
					noteCount: 3
				}
			];
			mockFetch.mockResolvedValueOnce(mockJsonResponse({ contracts }));

			const result = await service.getContractsByClient();

			const [url, options] = getLastFetchCall(mockFetch);
			expect(url).toBe('/api/contracts-by-client?includeArchived=true');
			expect(options?.method).toBeUndefined(); // GET is the default
			expect(result).toEqual(contracts);
		});
	});

	describe('getContracts', () => {
		it('calls GET /api/contracts and returns the array directly', async () => {
			const contracts: ContractOption[] = [
				{
					id: 'c1',
					name: 'Contract A',
					isActive: true,
					clientId: 'cl1',
					clientName: 'Client A',
					clientShortCode: 'CA',
					clientColorIndex: 0
				}
			];
			mockFetch.mockResolvedValueOnce(mockJsonResponse(contracts));

			const result = await service.getContracts();

			const [url] = getLastFetchCall(mockFetch);
			expect(url).toBe('/api/contracts');
			expect(result).toEqual(contracts);
		});
	});

	describe('createContract', () => {
		it('calls POST /api/contracts with the input data', async () => {
			const input = { clientId: 'cl1', name: 'New Contract' };
			mockFetch.mockResolvedValueOnce(mockJsonResponse({ id: 'c-new' }));

			const result = await service.createContract(input);

			const [url, options] = getLastFetchCall(mockFetch);
			expect(url).toBe('/api/contracts');
			expect(options?.method).toBe('POST');
			expect(getLastFetchBody(mockFetch)).toEqual(input);
			expect(result).toEqual({ id: 'c-new' });
		});
	});

	// ── Clients ───────────────────────────────────────────────

	describe('getClients', () => {
		it('calls GET /api/clients and unwraps .clients', async () => {
			const clients: ClientSummary[] = [
				{ id: 'cl1', name: 'Client A', shortCode: 'CA' }
			];
			mockFetch.mockResolvedValueOnce(mockJsonResponse({ clients }));

			const result = await service.getClients();

			const [url] = getLastFetchCall(mockFetch);
			expect(url).toBe('/api/clients');
			expect(result).toEqual(clients);
		});
	});

	// ── Notes ─────────────────────────────────────────────────

	describe('getNotesForContract', () => {
		it('calls GET /api/notes?contractId=... and unwraps .notes', async () => {
			const notes: NoteSummary[] = [
				{
					id: 'n1',
					contractId: 'c1',
					isPinned: false,
					createdAt: '2026-01-01T00:00:00Z',
					updatedAt: '2026-01-01T00:00:00Z',
					firstLine: 'Hello',
					secondLine: 'World'
				}
			];
			mockFetch.mockResolvedValueOnce(mockJsonResponse({ notes }));

			const result = await service.getNotesForContract('c1');

			const [url] = getLastFetchCall(mockFetch);
			expect(url).toBe('/api/notes?contractId=c1');
			expect(result).toEqual(notes);
		});

		it('encodes the contractId in the URL', async () => {
			mockFetch.mockResolvedValueOnce(mockJsonResponse({ notes: [] }));

			await service.getNotesForContract('id with spaces');

			const [url] = getLastFetchCall(mockFetch);
			expect(url).toBe('/api/notes?contractId=id%20with%20spaces');
		});
	});

	describe('getNoteById', () => {
		it('calls GET /api/notes/:id and unwraps .note', async () => {
			const note: NoteDetail = {
				id: 'n1',
				title: 'My Note',
				content: 'Content here',
				contentJson: null,
				contractId: 'c1',
				wordCount: 2,
				isPinned: false,
				createdAt: '2026-01-01T00:00:00Z',
				updatedAt: '2026-01-01T00:00:00Z'
			};
			mockFetch.mockResolvedValueOnce(mockJsonResponse({ note }));

			const result = await service.getNoteById('n1');

			const [url] = getLastFetchCall(mockFetch);
			expect(url).toBe('/api/notes/n1');
			expect(result).toEqual(note);
		});
	});

	describe('createNote', () => {
		it('calls POST /api/notes with contractId and unwraps .note', async () => {
			const note: NoteSummary = {
				id: 'n-new',
				contractId: 'c1',
				isPinned: false,
				createdAt: '2026-01-01T00:00:00Z',
				updatedAt: '2026-01-01T00:00:00Z',
				firstLine: '',
				secondLine: ''
			};
			mockFetch.mockResolvedValueOnce(mockJsonResponse({ note }));

			const result = await service.createNote('c1');

			const [url, options] = getLastFetchCall(mockFetch);
			expect(url).toBe('/api/notes');
			expect(options?.method).toBe('POST');
			expect(getLastFetchBody(mockFetch)).toMatchObject({ contractId: 'c1' });
			expect(result).toEqual(note);
		});
	});

	describe('updateNote', () => {
		it('calls PUT /api/notes/:id with update data and unwraps .note', async () => {
			const updatedNote: NoteDetail = {
				id: 'n1',
				title: 'Updated',
				content: 'New content',
				contentJson: null,
				contractId: 'c1',
				wordCount: 2,
				isPinned: true,
				createdAt: '2026-01-01T00:00:00Z',
				updatedAt: '2026-01-02T00:00:00Z'
			};
			mockFetch.mockResolvedValueOnce(mockJsonResponse({ note: updatedNote }));

			const result = await service.updateNote('n1', { title: 'Updated', isPinned: true });

			const [url, options] = getLastFetchCall(mockFetch);
			expect(url).toBe('/api/notes/n1');
			expect(options?.method).toBe('PUT');
			expect(getLastFetchBody(mockFetch)).toEqual({ title: 'Updated', isPinned: true });
			expect(result).toEqual(updatedNote);
		});
	});

	describe('updateNote keepalive', () => {
		it('passes keepalive through to fetch for saves during page unload', async () => {
			mockFetch.mockResolvedValueOnce(mockJsonResponse({ note: { id: 'n1' } }));
			await service.updateNote('n1', { content: 'x' }, { keepalive: true });
			const [, options] = getLastFetchCall(mockFetch);
			expect(options?.keepalive).toBe(true);
		});
	});

	describe('searchNotes', () => {
		it('calls GET /api/notes/search with query, exclude and limit', async () => {
			mockFetch.mockResolvedValueOnce(mockJsonResponse({ notes: [{ id: 'n2' }] }));
			const results = await service.searchNotes('kick off', { excludeNoteId: 'n1', limit: 5 });
			const [url] = getLastFetchCall(mockFetch);
			expect(url).toBe('/api/notes/search?q=kick+off&exclude=n1&limit=5');
			expect(results).toEqual([{ id: 'n2' }]);
		});
	});

	describe('getNoteTitles', () => {
		it('calls GET /api/notes/titles with comma-separated ids', async () => {
			mockFetch.mockResolvedValueOnce(mockJsonResponse({ titles: [{ id: 'A' }] }));
			const titles = await service.getNoteTitles(['A', 'B']);
			const [url] = getLastFetchCall(mockFetch);
			expect(url).toBe('/api/notes/titles?ids=A%2CB');
			expect(titles).toEqual([{ id: 'A' }]);
		});

		it('skips the request for an empty list', async () => {
			mockFetch.mockClear();
			expect(await service.getNoteTitles([])).toEqual([]);
			expect(mockFetch).not.toHaveBeenCalled();
		});
	});

	describe('deleteNote', () => {
		it('calls DELETE /api/notes/:id', async () => {
			mockFetch.mockResolvedValueOnce(mockJsonResponse(undefined));

			await service.deleteNote('n1');

			const [url, options] = getLastFetchCall(mockFetch);
			expect(url).toBe('/api/notes/n1');
			expect(options?.method).toBe('DELETE');
		});
	});

	describe('restoreNote', () => {
		it('calls POST /api/notes/:id/restore and returns { note, contract }', async () => {
			const restored = { note: { id: 'n1' }, contract: { id: 'c1', name: 'Work', clientShortCode: 'A', archived: false, isSystem: false } };
			mockFetch.mockResolvedValueOnce(mockJsonResponse(restored));

			expect(await service.restoreNote('n1')).toEqual(restored);
			const [url, options] = getLastFetchCall(mockFetch);
			expect(url).toBe('/api/notes/n1/restore');
			expect(options?.method).toBe('POST');
		});
	});

	describe('sprint 039-CL: client view, pins and client order', () => {
		it('getNotesForClient calls GET /api/notes?clientId= and unwraps .notes', async () => {
			mockFetch.mockResolvedValueOnce(mockJsonResponse({ notes: [{ id: 'n1' }] }));
			expect(await service.getNotesForClient('client 1')).toEqual([{ id: 'n1' }]);
			expect(getLastFetchCall(mockFetch)[0]).toBe('/api/notes?clientId=client%201');
		});

		it('getAllNotes calls GET /api/notes?all=true and unwraps .notes', async () => {
			mockFetch.mockResolvedValueOnce(mockJsonResponse({ notes: [{ id: 'n1' }] }));
			expect(await service.getAllNotes()).toEqual([{ id: 'n1' }]);
			expect(getLastFetchCall(mockFetch)[0]).toBe('/api/notes?all=true');
		});

		it('setNotePinned calls PUT /api/notes/:id/pin with { pinned }', async () => {
			const pinState = { id: 'n1', contractId: 'c1', isPinned: true, pinnedAt: '2026-11-04T10:00:00Z' };
			mockFetch.mockResolvedValueOnce(mockJsonResponse({ note: pinState }));
			expect(await service.setNotePinned('n1', true)).toEqual(pinState);
			const [url, options] = getLastFetchCall(mockFetch);
			expect(url).toBe('/api/notes/n1/pin');
			expect(options?.method).toBe('PUT');
			expect(getLastFetchBody(mockFetch)).toEqual({ pinned: true });
		});

		it('reorderClients calls PATCH /api/clients/reorder with { orderedIds }', async () => {
			mockFetch.mockResolvedValueOnce(mockJsonResponse({ ok: true }));
			await service.reorderClients(['b', 'a']);
			const [url, options] = getLastFetchCall(mockFetch);
			expect(url).toBe('/api/clients/reorder');
			expect(options?.method).toBe('PATCH');
			expect(getLastFetchBody(mockFetch)).toEqual({ orderedIds: ['b', 'a'] });
		});
	});

	describe('getNoteBacklinks', () => {
		it('calls GET /api/notes/:id/backlinks and unwraps .backlinks', async () => {
			const backlinks: Backlink[] = [
				{ sourceNoteId: 'n2', noteTitle: 'Other Note', headingAnchor: null }
			];
			mockFetch.mockResolvedValueOnce(mockJsonResponse({ backlinks }));

			const result = await service.getNoteBacklinks('n1');

			const [url] = getLastFetchCall(mockFetch);
			expect(url).toBe('/api/notes/n1/backlinks');
			expect(result).toEqual(backlinks);
		});
	});

	// ── Attachments ───────────────────────────────────────────

	describe('getNoteAttachments', () => {
		it('calls GET /api/notes/:id/attachments and unwraps .attachments', async () => {
			const attachments: AttachmentSummary[] = [
				{
					id: 'a1',
					filename: 'photo.png',
					mimeType: 'image/png',
					sizeBytes: 1024,
					createdAt: '2026-01-01T00:00:00Z'
				}
			];
			mockFetch.mockResolvedValueOnce(mockJsonResponse({ attachments }));

			const result = await service.getNoteAttachments('n1');

			const [url] = getLastFetchCall(mockFetch);
			expect(url).toBe('/api/notes/n1/attachments');
			expect(result).toEqual(attachments);
		});
	});

	describe('uploadAttachment', () => {
		it('calls POST /api/notes/:id/attachments with FormData', async () => {
			mockFetch.mockResolvedValueOnce(
				mockJsonResponse({ attachment: { id: 'a-new', filename: 'test.txt' } })
			);

			const file = new File(['hello'], 'test.txt', { type: 'text/plain' });
			const result = await service.uploadAttachment('n1', file);

			const [url, options] = getLastFetchCall(mockFetch);
			expect(url).toBe('/api/notes/n1/attachments');
			expect(options?.method).toBe('POST');
			expect(options?.body).toBeInstanceOf(FormData);
			expect(result).toEqual({ id: 'a-new' });
		});

		it('throws on non-OK response', async () => {
			mockFetch.mockResolvedValueOnce(mockErrorResponse(413, 'File too large'));

			const file = new File(['data'], 'big.bin', { type: 'application/octet-stream' });
			await expect(service.uploadAttachment('n1', file)).rejects.toThrow(
				/Upload attachment failed \(413\)/
			);
		});
	});

	describe('deleteAttachment', () => {
		it('calls DELETE /api/attachments/:id', async () => {
			mockFetch.mockResolvedValueOnce(mockJsonResponse(undefined));

			await service.deleteAttachment('a1');

			const [url, options] = getLastFetchCall(mockFetch);
			expect(url).toBe('/api/attachments/a1');
			expect(options?.method).toBe('DELETE');
		});
	});

	// ── Note-Time Entry Links ─────────────────────────────────

	describe('getNoteTimeEntries', () => {
		it('calls GET /api/notes/:id/time-entries and unwraps .timeEntries', async () => {
			const timeEntries: LinkedTimeEntryDisplay[] = [
				{
					noteId: 'n1',
					timeEntryId: 'te1',
					headingAnchor: null,
					date: '2026-02-03',
					description: 'Some work',
					durationMinutes: 60,
					contractName: 'Contract A',
					clientName: 'Client A',
					clientColorIndex: 0
				}
			];
			mockFetch.mockResolvedValueOnce(mockJsonResponse({ timeEntries }));

			const result = await service.getNoteTimeEntries('n1');

			const [url] = getLastFetchCall(mockFetch);
			expect(url).toBe('/api/notes/n1/time-entries');
			expect(result).toEqual(timeEntries);
		});
	});

	describe('unlinkNoteTimeEntry', () => {
		it('calls DELETE /api/notes/:id/time-entries with body', async () => {
			mockFetch.mockResolvedValueOnce(mockJsonResponse(undefined));

			await service.unlinkNoteTimeEntry('n1', 'te1');

			const [url, options] = getLastFetchCall(mockFetch);
			expect(url).toBe('/api/notes/n1/time-entries');
			expect(options?.method).toBe('DELETE');
			expect(getLastFetchBody(mockFetch)).toEqual({ timeEntryId: 'te1' });
		});
	});

	// ── Time Entries ──────────────────────────────────────────

	describe('getWeeklyTimeEntries', () => {
		it('calls GET /api/time-entries/weekly?weeks=... and unwraps .weeks', async () => {
			const weeks: WeekData[] = [
				{
					weekStart: '2026-02-02',
					days: [],
					weeklyTotalMinutes: 0,
					status: 'draft'
				}
			];
			mockFetch.mockResolvedValueOnce(mockJsonResponse({ weeks }));

			const result = await service.getWeeklyTimeEntries(['2026-02-02']);

			const [url] = getLastFetchCall(mockFetch);
			expect(url).toBe('/api/time-entries/weekly?weeks=2026-02-02');
			expect(result).toEqual(weeks);
		});

		it('joins multiple week starts with commas', async () => {
			mockFetch.mockResolvedValueOnce(mockJsonResponse({ weeks: [] }));

			await service.getWeeklyTimeEntries(['2026-02-02', '2026-02-09']);

			const [url] = getLastFetchCall(mockFetch);
			expect(url).toBe('/api/time-entries/weekly?weeks=2026-02-02,2026-02-09');
		});
	});

	describe('createTimeEntry', () => {
		it('calls POST /api/time-entries and extracts entry.id', async () => {
			mockFetch.mockResolvedValueOnce(
				mockJsonResponse({ entry: { id: 'te-new' } })
			);

			const input = {
				date: '2026-02-03',
				durationMinutes: 60,
				contractId: 'c1',
				description: 'Working on tests'
			};
			const result = await service.createTimeEntry(input);

			const [url, options] = getLastFetchCall(mockFetch);
			expect(url).toBe('/api/time-entries');
			expect(options?.method).toBe('POST');
			expect(getLastFetchBody(mockFetch)).toEqual(input);
			expect(result).toEqual({ id: 'te-new' });
		});
	});

	describe('updateTimeEntry', () => {
		it('calls PUT /api/time-entries/:id with partial data', async () => {
			mockFetch.mockResolvedValueOnce(mockJsonResponse({}));

			await service.updateTimeEntry('te1', { durationMinutes: 90 });

			const [url, options] = getLastFetchCall(mockFetch);
			expect(url).toBe('/api/time-entries/te1');
			expect(options?.method).toBe('PUT');
			expect(getLastFetchBody(mockFetch)).toEqual({ durationMinutes: 90 });
		});
	});

	describe('deleteTimeEntry', () => {
		it('calls DELETE /api/time-entries/:id', async () => {
			mockFetch.mockResolvedValueOnce(mockJsonResponse(undefined));

			await service.deleteTimeEntry('te1');

			const [url, options] = getLastFetchCall(mockFetch);
			expect(url).toBe('/api/time-entries/te1');
			expect(options?.method).toBe('DELETE');
		});
	});

	describe('updateWeeklyStatus', () => {
		it('calls POST /api/time-entries/weekly-statuses', async () => {
			mockFetch.mockResolvedValueOnce(mockJsonResponse({}));

			await service.updateWeeklyStatus(2026, 6, 'submitted');

			const [url, options] = getLastFetchCall(mockFetch);
			expect(url).toBe('/api/time-entries/weekly-statuses');
			expect(options?.method).toBe('POST');
			expect(getLastFetchBody(mockFetch)).toEqual({
				year: 2026,
				weekNumber: 6,
				status: 'submitted'
			});
		});
	});

	// ── Timer ─────────────────────────────────────────────────

	describe('getTimerStatus', () => {
		it('calls GET /api/timer/status and returns the full object', async () => {
			const timerStatus: TimerStatus = { timer: null };
			mockFetch.mockResolvedValueOnce(mockJsonResponse(timerStatus));

			const result = await service.getTimerStatus();

			const [url] = getLastFetchCall(mockFetch);
			expect(url).toBe('/api/timer/status');
			expect(result).toEqual(timerStatus);
		});
	});

	describe('startTimer', () => {
		it('calls POST /api/timer/start with provided contractId', async () => {
			const timerEntry: TimerEntry = {
				id: 'timer-1',
				startTime: '2026-02-03T10:00:00Z',
				endTime: null,
				durationMinutes: 0
			};
			mockFetch.mockResolvedValueOnce(mockJsonResponse(timerEntry));

			const result = await service.startTimer('c1');

			const [url, options] = getLastFetchCall(mockFetch);
			expect(url).toBe('/api/timer/start');
			expect(options?.method).toBe('POST');
			expect(getLastFetchBody(mockFetch)).toMatchObject({ contractId: 'c1' });
			expect(result).toEqual(timerEntry);
		});

		it('never picks a contract on its own', async () => {
			await expect(service.startTimer('')).rejects.toThrow('Pick a contract');
			expect(mockFetch).not.toHaveBeenCalled();
		});

		it('sends the original local start when the draft is created later', async () => {
			mockFetch.mockResolvedValueOnce(
				mockJsonResponse({ id: 't3', startTime: '09:05:00', endTime: null, durationMinutes: 0 })
			);
			await service.startTimer('c1', { date: '2026-11-03', startTime: '09:05:00' });
			expect(getLastFetchBody(mockFetch)).toEqual({
				contractId: 'c1',
				date: '2026-11-03',
				startTime: '09:05:00',
				confirmed: true
			});
		});
	});

	describe('adjustTimerStart', () => {
		it('calls PATCH /api/timer with the start, the browser timezone and the confirmation', async () => {
			mockFetch.mockResolvedValueOnce(
				mockJsonResponse({ id: 't3', date: '2026-11-03', startTime: '08:30:00', endTime: null, durationMinutes: 0 })
			);
			const result = await service.adjustTimerStart({ date: '2026-11-03', startTime: '08:30:00' }, { confirmed: true });
			const [url, options] = getLastFetchCall(mockFetch);
			expect(url).toBe('/api/timer');
			expect(options?.method).toBe('PATCH');
			expect(new Headers(options?.headers).has('X-Timezone')).toBe(true);
			expect(getLastFetchBody(mockFetch)).toEqual({ date: '2026-11-03', startTime: '08:30:00', confirmed: true });
			expect(result.startTime).toBe('08:30:00');
		});
	});

	describe('stopTimer', () => {
		it('calls POST /api/timer/stop with the local end time', async () => {
			const timerEntry: TimerEntry = {
				id: 'timer-1',
				startTime: '2026-02-03T10:00:00Z',
				endTime: '2026-02-03T11:00:00Z',
				durationMinutes: 60
			};
			mockFetch.mockResolvedValueOnce(mockJsonResponse(timerEntry));

			const result = await service.stopTimer();

			const [url, options] = getLastFetchCall(mockFetch);
			expect(url).toBe('/api/timer/stop');
			expect(options?.method).toBe('POST');
			expect(getLastFetchBody(mockFetch)).toEqual({ endTime: expect.stringMatching(/^\d{2}:\d{2}:\d{2}$/) });
			expect(result).toEqual(timerEntry);
		});
	});

	describe('saveTimer', () => {
		it('calls POST /api/timer/save with save data', async () => {
			mockFetch.mockResolvedValueOnce(mockJsonResponse({}));

			const saveInput = {
				entryId: 'timer-1',
				contractId: 'c1',
				deliverableId: 'd1',
				workTypeId: 'wt1',
				description: 'Timer work'
			};
			await service.saveTimer(saveInput);

			const [url, options] = getLastFetchCall(mockFetch);
			expect(url).toBe('/api/timer/save');
			expect(options?.method).toBe('POST');
			expect(getLastFetchBody(mockFetch)).toEqual(saveInput);
		});
	});

	describe('discardTimer', () => {
		it('calls POST /api/timer/discard with entryId', async () => {
			mockFetch.mockResolvedValueOnce(mockJsonResponse({}));

			await service.discardTimer('timer-1');

			const [url, options] = getLastFetchCall(mockFetch);
			expect(url).toBe('/api/timer/discard');
			expect(options?.method).toBe('POST');
			expect(getLastFetchBody(mockFetch)).toEqual({ entryId: 'timer-1' });
		});
	});

	describe('splitTimer and resumeTimer (sprint 056-DR)', () => {
		it('splitTimer posts the split as given and returns both outcomes', async () => {
			const answer = { replayed: false, left: { action: 'discarded', date: '2026-11-07', startTime: '09:00:00', endTime: '09:50:00' }, remainder: { kind: 'gone' } };
			mockFetch.mockResolvedValueOnce(mockJsonResponse(answer));
			const input = {
				entryId: 'timer-1',
				expectedStartedAt: '2026-11-07T09:00:00',
				boundary: '2026-11-07T09:50:00',
				clientRequestId: 'split-1',
				left: { action: 'discard' as const }
			};
			const result = await service.splitTimer(input);
			const [url, options] = getLastFetchCall(mockFetch);
			expect(url).toBe('/api/timer/split');
			expect(options?.method).toBe('POST');
			expect(getLastFetchBody(mockFetch)).toEqual(input);
			expect(result).toEqual(answer);
		});

		it('resumeTimer sends PATCH /api/timer with resume, and a new start only when given', async () => {
			mockFetch.mockResolvedValue(mockJsonResponse({ id: 't1', startTime: '09:50:00', endTime: null, durationMinutes: 0 }));
			await service.resumeTimer();
			expect(getLastFetchCall(mockFetch)[1]?.method).toBe('PATCH');
			expect(getLastFetchBody(mockFetch)).toEqual({ resume: true, confirmed: false });
			await service.resumeTimer({ start: { date: '2026-11-07', startTime: '09:40:00' }, confirmed: true, expectedStartedAt: '2026-11-07T09:50:00' });
			expect(getLastFetchBody(mockFetch)).toEqual({
				resume: true,
				date: '2026-11-07',
				startTime: '09:40:00',
				confirmed: true,
				expectedStartedAt: '2026-11-07T09:50:00'
			});
		});

		it('discardTimer passes expectedStartedAt when given', async () => {
			mockFetch.mockResolvedValueOnce(mockJsonResponse({}));
			await service.discardTimer('timer-1', { expectedStartedAt: '2026-11-07T09:00:00' });
			expect(getLastFetchBody(mockFetch)).toEqual({ entryId: 'timer-1', expectedStartedAt: '2026-11-07T09:00:00' });
		});
	});

	// ── Deliverables & Work Types ─────────────────────────────

	describe('getDeliverables', () => {
		it('calls GET /api/deliverables?contractId=... and returns the array', async () => {
			const deliverables: DeliverableOption[] = [
				{ id: 'd1', name: 'Deliverable A' }
			];
			mockFetch.mockResolvedValueOnce(mockJsonResponse(deliverables));

			const result = await service.getDeliverables('c1');

			const [url] = getLastFetchCall(mockFetch);
			expect(url).toBe('/api/deliverables?contractId=c1&includeArchived=true');
			expect(result).toEqual(deliverables);
		});
	});

	describe('getWorkTypes', () => {
		it('calls GET /api/work-types?deliverableId=... and returns the array', async () => {
			const workTypes: WorkTypeOption[] = [{ id: 'wt1', name: 'Development' }];
			mockFetch.mockResolvedValueOnce(mockJsonResponse(workTypes));

			const result = await service.getWorkTypes('d1');

			const [url] = getLastFetchCall(mockFetch);
			expect(url).toBe('/api/work-types?deliverableId=d1&includeArchived=true');
			expect(result).toEqual(workTypes);
		});
	});

	// ── Error handling ────────────────────────────────────────

	describe('error handling', () => {
		it('throws on non-OK response for GET requests', async () => {
			mockFetch.mockResolvedValueOnce(mockErrorResponse(404, 'Not Found'));

			await expect(service.getClients()).rejects.toThrow(/GET.*\/api\/clients.*failed.*404/);
		});

		it('throws on non-OK response for POST requests', async () => {
			mockFetch.mockResolvedValueOnce(mockErrorResponse(500, 'Internal Server Error'));

			await expect(service.createContract({ clientId: 'cl1', name: 'Test' })).rejects.toThrow(
				/POST.*\/api\/contracts.*failed.*500/
			);
		});

		it('throws on non-OK response for PUT requests', async () => {
			mockFetch.mockResolvedValueOnce(mockErrorResponse(400, 'Bad Request'));

			await expect(
				service.updateNote('n1', { title: 'Invalid' })
			).rejects.toThrow(/PUT.*\/api\/notes\/n1.*failed.*400/);
		});

		it('throws on non-OK response for DELETE requests', async () => {
			mockFetch.mockResolvedValueOnce(mockErrorResponse(403, 'Forbidden'));

			await expect(service.deleteNote('n1')).rejects.toThrow(
				/DELETE.*\/api\/notes\/n1.*failed.*403/
			);
		});
	});
});

// ===========================================================================
// DelegatingDataService
// ===========================================================================

describe('DelegatingDataService', () => {
	/**
	 * Creates a mock DataService where every method is a vi.fn()
	 * that resolves to a predictable value.
	 */
	function createMockDataService(label: string): DataService & Record<string, ReturnType<typeof vi.fn>> {
		return {
			getContractsByClient: vi.fn().mockResolvedValue([{ id: `${label}-c1` }]),
			getContracts: vi.fn().mockResolvedValue([]),
			createContract: vi.fn().mockResolvedValue({ id: `${label}-new` }),
			getClients: vi.fn().mockResolvedValue([]),
			getNotesForContract: vi.fn().mockResolvedValue([]),
			getNoteById: vi.fn().mockResolvedValue({ id: `${label}-n1` }),
			createNote: vi.fn().mockResolvedValue({ id: `${label}-note` }),
			updateNote: vi.fn().mockResolvedValue({ id: `${label}-updated` }),
			deleteNote: vi.fn().mockResolvedValue(undefined),
			getNoteBacklinks: vi.fn().mockResolvedValue([]),
			getNoteAttachments: vi.fn().mockResolvedValue([]),
			uploadAttachment: vi.fn().mockResolvedValue({ id: `${label}-att` }),
			deleteAttachment: vi.fn().mockResolvedValue(undefined),
			getNoteTimeEntries: vi.fn().mockResolvedValue([]),
			linkNoteTimeEntry: vi.fn().mockResolvedValue(undefined),
			unlinkNoteTimeEntry: vi.fn().mockResolvedValue(undefined),
			getWeeklyTimeEntries: vi.fn().mockResolvedValue([]),
			createTimeEntry: vi.fn().mockResolvedValue({ id: `${label}-te` }),
			updateTimeEntry: vi.fn().mockResolvedValue(undefined),
			deleteTimeEntry: vi.fn().mockResolvedValue(undefined),
			updateWeeklyStatus: vi.fn().mockResolvedValue(undefined),
			getTimerStatus: vi.fn().mockResolvedValue({ timer: null }),
			startTimer: vi.fn().mockResolvedValue({ id: `${label}-timer` }),
			stopTimer: vi.fn().mockResolvedValue({ id: `${label}-timer-stop` }),
			saveTimer: vi.fn().mockResolvedValue(undefined),
			discardTimer: vi.fn().mockResolvedValue(undefined),
			splitTimer: vi.fn().mockResolvedValue(undefined),
			resumeTimer: vi.fn().mockResolvedValue(undefined),
			getDeliverables: vi.fn().mockResolvedValue([]),
			getWorkTypes: vi.fn().mockResolvedValue([])
		} as unknown as DataService & Record<string, ReturnType<typeof vi.fn>>;
	}

	it('delegates all calls to the initial delegate', async () => {
		const inner = createMockDataService('inner');
		const delegator = new DelegatingDataService(inner);

		await delegator.getContractsByClient();
		expect(inner.getContractsByClient).toHaveBeenCalledOnce();

		await delegator.getContracts();
		expect(inner.getContracts).toHaveBeenCalledOnce();

		await delegator.createContract({ clientId: 'cl1', name: 'Test' });
		expect(inner.createContract).toHaveBeenCalledWith({ clientId: 'cl1', name: 'Test' });

		await delegator.getClients();
		expect(inner.getClients).toHaveBeenCalledOnce();

		await delegator.getNotesForContract('c1');
		expect(inner.getNotesForContract).toHaveBeenCalledWith('c1');

		await delegator.getNoteById('n1');
		expect(inner.getNoteById).toHaveBeenCalledWith('n1');

		await delegator.createNote('c1');
		expect(inner.createNote).toHaveBeenCalledWith('c1', undefined);

		await delegator.updateNote('n1', { title: 'Updated' });
		expect(inner.updateNote).toHaveBeenCalledWith('n1', { title: 'Updated' }, undefined);

		await delegator.deleteNote('n1');
		expect(inner.deleteNote).toHaveBeenCalledWith('n1');

		await delegator.getNoteBacklinks('n1');
		expect(inner.getNoteBacklinks).toHaveBeenCalledWith('n1');

		await delegator.getNoteAttachments('n1');
		expect(inner.getNoteAttachments).toHaveBeenCalledWith('n1');

		const file = new File(['test'], 'test.txt');
		await delegator.uploadAttachment('n1', file);
		expect(inner.uploadAttachment).toHaveBeenCalledWith('n1', file);

		await delegator.deleteAttachment('a1');
		expect(inner.deleteAttachment).toHaveBeenCalledWith('a1');

		await delegator.getNoteTimeEntries('n1');
		expect(inner.getNoteTimeEntries).toHaveBeenCalledWith('n1');

		await delegator.linkNoteTimeEntry('n1', 'te1', 'heading-1');
		expect(inner.linkNoteTimeEntry).toHaveBeenCalledWith('n1', 'te1', 'heading-1');

		await delegator.unlinkNoteTimeEntry('n1', 'te1');
		expect(inner.unlinkNoteTimeEntry).toHaveBeenCalledWith('n1', 'te1');

		await delegator.getWeeklyTimeEntries(['2026-02-02']);
		expect(inner.getWeeklyTimeEntries).toHaveBeenCalledWith(['2026-02-02']);

		await delegator.createTimeEntry({ date: '2026-02-03', durationMinutes: 60, contractId: 'c1' });
		expect(inner.createTimeEntry).toHaveBeenCalledWith({
			date: '2026-02-03',
			durationMinutes: 60,
			contractId: 'c1'
		});

		await delegator.updateTimeEntry('te1', { durationMinutes: 90 });
		expect(inner.updateTimeEntry).toHaveBeenCalledWith('te1', { durationMinutes: 90 });

		await delegator.deleteTimeEntry('te1');
		expect(inner.deleteTimeEntry).toHaveBeenCalledWith('te1');

		await delegator.updateWeeklyStatus(2026, 6, 'submitted');
		expect(inner.updateWeeklyStatus).toHaveBeenCalledWith(2026, 6, 'submitted');

		await delegator.getTimerStatus();
		expect(inner.getTimerStatus).toHaveBeenCalledOnce();

		await delegator.startTimer('c1');
		expect(inner.startTimer).toHaveBeenCalledWith('c1', undefined);

		await delegator.stopTimer();
		expect(inner.stopTimer).toHaveBeenCalledOnce();

		await delegator.saveTimer({
			entryId: 'e1',
			contractId: 'c1',
			deliverableId: 'd1',
			workTypeId: 'wt1',
			description: 'Work'
		});
		expect(inner.saveTimer).toHaveBeenCalledWith({
			entryId: 'e1',
			contractId: 'c1',
			deliverableId: 'd1',
			workTypeId: 'wt1',
			description: 'Work'
		});

		await delegator.discardTimer('e1');
		expect(inner.discardTimer).toHaveBeenCalledWith('e1', undefined);

		await delegator.resumeTimer({ confirmed: true });
		expect(inner.resumeTimer).toHaveBeenCalledWith({ confirmed: true });

		await delegator.getDeliverables('c1');
		expect(inner.getDeliverables).toHaveBeenCalledWith('c1');

		await delegator.getWorkTypes('d1');
		expect(inner.getWorkTypes).toHaveBeenCalledWith('d1');
	});

	it('setDelegate swaps the active implementation', async () => {
		const serviceA = createMockDataService('A');
		const serviceB = createMockDataService('B');
		const delegator = new DelegatingDataService(serviceA);

		// Calls go to service A initially
		await delegator.getClients();
		expect(serviceA.getClients).toHaveBeenCalledOnce();
		expect(serviceB.getClients).not.toHaveBeenCalled();

		// Swap to service B
		delegator.setDelegate(serviceB);

		// Now calls go to service B
		await delegator.getClients();
		expect(serviceB.getClients).toHaveBeenCalledOnce();
		// Service A should still only have the one earlier call
		expect(serviceA.getClients).toHaveBeenCalledOnce();
	});

	it('returns the value from the current delegate', async () => {
		const serviceA = createMockDataService('A');
		const serviceB = createMockDataService('B');
		const delegator = new DelegatingDataService(serviceA);

		const resultA = await delegator.getContractsByClient();
		expect(resultA).toEqual([{ id: 'A-c1' }]);

		delegator.setDelegate(serviceB);

		const resultB = await delegator.getContractsByClient();
		expect(resultB).toEqual([{ id: 'B-c1' }]);
	});
});

// ===========================================================================
// Interface completeness (runtime check)
// ===========================================================================

describe('DataService interface completeness', () => {
	/**
	 * All methods defined in the DataService interface.
	 * This acts as a compile-time + runtime check that implementations
	 * cover every method.
	 */
	const expectedMethods: (keyof DataService)[] = [
		'getContractsByClient',
		'getContracts',
		'createContract',
		'getClients',
		'reorderClients',
		'getNotesForContract',
		'getNotesForClient',
		'getAllNotes',
		'setNotePinned',
		'getNoteById',
		'createNote',
		'updateNote',
		'deleteNote',
		'restoreNote',
		'getNoteBacklinks',
		'searchNotes',
		'getNoteTitles',
		'getNoteAttachments',
		'uploadAttachment',
		'deleteAttachment',
		'getNoteTimeEntries',
		'linkNoteTimeEntry',
		'unlinkNoteTimeEntry',
		'getWeeklyTimeEntries',
		'createTimeEntry',
		'updateTimeEntry',
		'deleteTimeEntry',
		'updateWeeklyStatus',
		'getTimerStatus',
		'startTimer',
		'adjustTimerStart',
		'stopTimer',
		'saveTimer',
		'discardTimer',
		'splitTimer',
		'resumeTimer',
		'getDeliverables',
		'getWorkTypes'
	];

	it('FetchDataService implements all DataService methods', () => {
		const instance = new FetchDataService();
		for (const methodName of expectedMethods) {
			expect(typeof instance[methodName]).toBe('function');
		}
	});

	it('DelegatingDataService implements all DataService methods', () => {
		const inner = new FetchDataService();
		const instance = new DelegatingDataService(inner);
		for (const methodName of expectedMethods) {
			expect(typeof instance[methodName]).toBe('function');
		}
	});

	it('FetchDataService has no extra public methods beyond DataService', () => {
		const instance = new FetchDataService();
		const prototype = Object.getPrototypeOf(instance);
		const publicMethods = Object.getOwnPropertyNames(prototype).filter(
			(name) => name !== 'constructor' && typeof prototype[name] === 'function'
		);
		// Every public method should be in the expected list
		for (const methodName of publicMethods) {
			expect(expectedMethods).toContain(methodName);
		}
	});

	it('DelegatingDataService only adds setDelegate beyond DataService methods', () => {
		const inner = new FetchDataService();
		const instance = new DelegatingDataService(inner);
		const prototype = Object.getPrototypeOf(instance);
		const publicMethods = Object.getOwnPropertyNames(prototype).filter(
			(name) => name !== 'constructor' && typeof prototype[name] === 'function'
		);
		const allowedExtras = ['setDelegate'];
		for (const methodName of publicMethods) {
			const isExpected = expectedMethods.includes(methodName as keyof DataService);
			const isAllowedExtra = allowedExtras.includes(methodName);
			expect(isExpected || isAllowedExtra).toBe(true);
		}
	});
});
