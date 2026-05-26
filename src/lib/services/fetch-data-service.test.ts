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
	NoteTimeEntryLink,
	WeekData,
	WeekSummary,
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
		it('calls GET /api/contracts-by-client and unwraps .contracts', async () => {
			const contracts: ContractsByClientResult[] = [
				{
					id: 'c1',
					name: 'Contract A',
					isActive: true,
					clientId: 'cl1',
					clientName: 'Client A',
					clientShortCode: 'CA',
					clientEmoji: null,
					noteCount: 3
				}
			];
			mockFetch.mockResolvedValueOnce(mockJsonResponse({ contracts }));

			const result = await service.getContractsByClient();

			const [url, options] = getLastFetchCall(mockFetch);
			expect(url).toBe('/api/contracts-by-client');
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
					clientShortCode: 'CA'
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
			expect(getLastFetchBody(mockFetch)).toEqual({ contractId: 'c1' });
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

	describe('deleteNote', () => {
		it('calls DELETE /api/notes/:id', async () => {
			mockFetch.mockResolvedValueOnce(mockJsonResponse(undefined));

			await service.deleteNote('n1');

			const [url, options] = getLastFetchCall(mockFetch);
			expect(url).toBe('/api/notes/n1');
			expect(options?.method).toBe('DELETE');
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
			mockFetch.mockResolvedValueOnce(mockJsonResponse({ id: 'a-new' }));

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
			const timeEntries: NoteTimeEntryLink[] = [
				{ noteId: 'n1', timeEntryId: 'te1', headingAnchor: null }
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

	describe('getWeekSummaries', () => {
		it('calls GET /api/weeks?count=N and unwraps .weeks', async () => {
			const weeks: WeekSummary[] = [
				{
					weekStart: '2026-02-02',
					year: 2026,
					weekNumber: 6,
					totalMinutes: 2400,
					status: 'submitted'
				}
			];
			mockFetch.mockResolvedValueOnce(mockJsonResponse({ weeks }));

			const result = await service.getWeekSummaries(4);

			const [url] = getLastFetchCall(mockFetch);
			expect(url).toBe('/api/weeks?count=4');
			expect(result).toEqual(weeks);
		});

		it('appends &before= when before parameter is provided', async () => {
			mockFetch.mockResolvedValueOnce(mockJsonResponse({ weeks: [] }));

			await service.getWeekSummaries(4, '2026-02-01');

			const [url] = getLastFetchCall(mockFetch);
			expect(url).toBe('/api/weeks?count=4&before=2026-02-01');
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
			expect(getLastFetchBody(mockFetch)).toEqual({ contractId: 'c1' });
			expect(result).toEqual(timerEntry);
		});

		it('fetches contracts and uses first active one when no contractId given', async () => {
			const contracts: ContractOption[] = [
				{
					id: 'c-inactive',
					name: 'Old',
					isActive: false,
					clientId: 'cl1',
					clientName: 'Client',
					clientShortCode: 'CL'
				},
				{
					id: 'c-active',
					name: 'Active',
					isActive: true,
					clientId: 'cl1',
					clientName: 'Client',
					clientShortCode: 'CL'
				}
			];
			const timerEntry: TimerEntry = {
				id: 'timer-2',
				startTime: '2026-02-03T10:00:00Z',
				endTime: null,
				durationMinutes: 0
			};

			// First call: getContracts -> GET /api/contracts
			mockFetch.mockResolvedValueOnce(mockJsonResponse(contracts));
			// Second call: POST /api/timer/start
			mockFetch.mockResolvedValueOnce(mockJsonResponse(timerEntry));

			const result = await service.startTimer();

			expect(mockFetch).toHaveBeenCalledTimes(2);
			// Second call should use the first active contract
			const [url, options] = [
				mockFetch.mock.calls[1][0] as string,
				mockFetch.mock.calls[1][1] as RequestInit
			];
			expect(url).toBe('/api/timer/start');
			expect(options.method).toBe('POST');
			const body = JSON.parse(options.body as string);
			expect(body).toEqual({ contractId: 'c-active' });
			expect(result).toEqual(timerEntry);
		});

		it('throws when no active contracts available and no contractId given', async () => {
			const contracts: ContractOption[] = [
				{
					id: 'c1',
					name: 'Inactive',
					isActive: false,
					clientId: 'cl1',
					clientName: 'Client',
					clientShortCode: 'CL'
				}
			];
			mockFetch.mockResolvedValueOnce(mockJsonResponse(contracts));

			await expect(service.startTimer()).rejects.toThrow(
				'No active contracts available to start timer'
			);
		});
	});

	describe('stopTimer', () => {
		it('calls POST /api/timer/stop with empty body', async () => {
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
			expect(getLastFetchBody(mockFetch)).toEqual({});
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

	// ── Deliverables & Work Types ─────────────────────────────

	describe('getDeliverables', () => {
		it('calls GET /api/deliverables?contractId=... and returns the array', async () => {
			const deliverables: DeliverableOption[] = [
				{ id: 'd1', name: 'Deliverable A' }
			];
			mockFetch.mockResolvedValueOnce(mockJsonResponse(deliverables));

			const result = await service.getDeliverables('c1');

			const [url] = getLastFetchCall(mockFetch);
			expect(url).toBe('/api/deliverables?contractId=c1');
			expect(result).toEqual(deliverables);
		});
	});

	describe('getWorkTypes', () => {
		it('calls GET /api/work-types?deliverableId=... and returns the array', async () => {
			const workTypes: WorkTypeOption[] = [{ id: 'wt1', name: 'Development' }];
			mockFetch.mockResolvedValueOnce(mockJsonResponse(workTypes));

			const result = await service.getWorkTypes('d1');

			const [url] = getLastFetchCall(mockFetch);
			expect(url).toBe('/api/work-types?deliverableId=d1');
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
			unlinkNoteTimeEntry: vi.fn().mockResolvedValue(undefined),
			getWeeklyTimeEntries: vi.fn().mockResolvedValue([]),
			getWeekSummaries: vi.fn().mockResolvedValue([]),
			createTimeEntry: vi.fn().mockResolvedValue({ id: `${label}-te` }),
			updateTimeEntry: vi.fn().mockResolvedValue(undefined),
			deleteTimeEntry: vi.fn().mockResolvedValue(undefined),
			updateWeeklyStatus: vi.fn().mockResolvedValue(undefined),
			getTimerStatus: vi.fn().mockResolvedValue({ timer: null }),
			startTimer: vi.fn().mockResolvedValue({ id: `${label}-timer` }),
			stopTimer: vi.fn().mockResolvedValue({ id: `${label}-timer-stop` }),
			saveTimer: vi.fn().mockResolvedValue(undefined),
			discardTimer: vi.fn().mockResolvedValue(undefined),
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
		expect(inner.createNote).toHaveBeenCalledWith('c1');

		await delegator.updateNote('n1', { title: 'Updated' });
		expect(inner.updateNote).toHaveBeenCalledWith('n1', { title: 'Updated' });

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

		await delegator.unlinkNoteTimeEntry('n1', 'te1');
		expect(inner.unlinkNoteTimeEntry).toHaveBeenCalledWith('n1', 'te1');

		await delegator.getWeeklyTimeEntries(['2026-02-02']);
		expect(inner.getWeeklyTimeEntries).toHaveBeenCalledWith(['2026-02-02']);

		await delegator.getWeekSummaries(4, '2026-02-01');
		expect(inner.getWeekSummaries).toHaveBeenCalledWith(4, '2026-02-01');

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
		expect(inner.startTimer).toHaveBeenCalledWith('c1');

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
		expect(inner.discardTimer).toHaveBeenCalledWith('e1');

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
		'getNotesForContract',
		'getNoteById',
		'createNote',
		'updateNote',
		'deleteNote',
		'getNoteBacklinks',
		'getNoteAttachments',
		'uploadAttachment',
		'deleteAttachment',
		'getNoteTimeEntries',
		'unlinkNoteTimeEntry',
		'getWeeklyTimeEntries',
		'getWeekSummaries',
		'createTimeEntry',
		'updateTimeEntry',
		'deleteTimeEntry',
		'updateWeeklyStatus',
		'getTimerStatus',
		'startTimer',
		'stopTimer',
		'saveTimer',
		'discardTimer',
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
