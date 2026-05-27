/**
 * Tests for PowerSyncDataService.
 *
 * Mocks the PowerSync database (get, getAll, execute) and verifies
 * that each DataService method delegates correctly to the query/mutation
 * modules and inline SQL queries.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @powersync/web (only the type is needed, but vitest needs the module)
vi.mock('@powersync/web', () => ({}));

// Mock the query modules
vi.mock('./queries-read', () => ({
	queryContractsByClient: vi.fn(),
	queryContracts: vi.fn(),
	queryClients: vi.fn(),
	queryNotesForContract: vi.fn(),
	queryNoteById: vi.fn(),
	queryNoteBacklinks: vi.fn(),
	queryNoteAttachments: vi.fn(),
	queryNoteTimeEntries: vi.fn()
}));

vi.mock('./queries-time', () => ({
	queryTimerStatus: vi.fn(),
	queryDeliverables: vi.fn(),
	queryWorkTypes: vi.fn()
}));

// Mock the mutation module
vi.mock('./mutations', () => ({
	createContract: vi.fn(),
	createNote: vi.fn(),
	updateNote: vi.fn(),
	deleteNote: vi.fn(),
	deleteAttachment: vi.fn(),
	unlinkNoteTimeEntry: vi.fn(),
	createTimeEntry: vi.fn(),
	updateTimeEntry: vi.fn(),
	deleteTimeEntry: vi.fn(),
	updateWeeklyStatus: vi.fn(),
	startTimer: vi.fn(),
	stopTimer: vi.fn(),
	saveTimer: vi.fn(),
	discardTimer: vi.fn()
}));

import { PowerSyncDataService } from './powersync-data-service';
import type { DataService } from '$lib/services/data-service';
import {
	queryContractsByClient,
	queryContracts,
	queryClients,
	queryNotesForContract,
	queryNoteById,
	queryNoteBacklinks,
	queryNoteAttachments,
	queryNoteTimeEntries
} from './queries-read';
import { queryTimerStatus, queryDeliverables, queryWorkTypes } from './queries-time';
import {
	createContract as mutateCreateContract,
	createNote as mutateCreateNote,
	updateNote as mutateUpdateNote,
	deleteNote as mutateDeleteNote,
	deleteAttachment as mutateDeleteAttachment,
	unlinkNoteTimeEntry as mutateUnlinkNoteTimeEntry,
	createTimeEntry as mutateCreateTimeEntry,
	updateTimeEntry as mutateUpdateTimeEntry,
	deleteTimeEntry as mutateDeleteTimeEntry,
	updateWeeklyStatus as mutateUpdateWeeklyStatus,
	startTimer as mutateStartTimer,
	stopTimer as mutateStopTimer,
	saveTimer as mutateSaveTimer,
	discardTimer as mutateDiscardTimer
} from './mutations';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a mock PowerSync database with get, getAll, and execute methods.
 */
function createMockDatabase() {
	return {
		get: vi.fn(),
		getAll: vi.fn(),
		execute: vi.fn()
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let mockDatabase: ReturnType<typeof createMockDatabase>;
let service: PowerSyncDataService;

beforeEach(() => {
	vi.clearAllMocks();
	mockDatabase = createMockDatabase();
	service = new PowerSyncDataService(mockDatabase as never);
});

describe('PowerSyncDataService', () => {
	// ── Clients ───────────────────────────────────────────────

	describe('getClients', () => {
		it('delegates to queryClients and returns results', async () => {
			const mockClients = [
				{ id: 'cl-1', name: 'Acme Corp', shortCode: 'AC' },
				{ id: 'cl-2', name: 'Beta Inc', shortCode: 'BI' }
			];
			vi.mocked(queryClients).mockResolvedValueOnce(mockClients);

			const result = await service.getClients();

			expect(queryClients).toHaveBeenCalledWith(mockDatabase);
			expect(result).toEqual(mockClients);
		});
	});

	// ── Contracts ─────────────────────────────────────────────

	describe('getContracts', () => {
		it('delegates to queryContracts and maps results', async () => {
			const mockContracts = [
				{
					id: 'c-1',
					name: 'Contract A',
					isActive: true,
					clientId: 'cl-1',
					clientName: 'Acme Corp',
					clientShortCode: 'AC',
					clientColorIndex: 0
				}
			];
			vi.mocked(queryContracts).mockResolvedValueOnce(mockContracts);

			const result = await service.getContracts();

			expect(queryContracts).toHaveBeenCalledWith(mockDatabase);
			expect(result).toEqual(mockContracts);
		});
	});

	describe('getContractsByClient', () => {
		it('delegates to queryContractsByClient with note count', async () => {
			const mockContracts = [
				{
					id: 'c-1',
					name: 'Contract A',
					isActive: true,
					clientId: 'cl-1',
					clientName: 'Acme Corp',
					clientShortCode: 'AC',
					clientEmoji: null,
					clientColorIndex: 0,
					noteCount: 5
				}
			];
			vi.mocked(queryContractsByClient).mockResolvedValueOnce(mockContracts);

			const result = await service.getContractsByClient();

			expect(queryContractsByClient).toHaveBeenCalledWith(mockDatabase);
			expect(result).toEqual(mockContracts);
		});
	});

	// ── Notes ─────────────────────────────────────────────────

	describe('getNoteById', () => {
		it('delegates to queryNoteById and returns a NoteDetail', async () => {
			const mockNote = {
				id: 'AC.20260501.001',
				title: 'Meeting Notes',
				content: 'Discussed project timeline',
				contentJson: null,
				contractId: 'c-1',
				wordCount: 3,
				isPinned: false,
				createdAt: '2026-05-01T10:00:00Z',
				updatedAt: '2026-05-01T10:00:00Z'
			};
			vi.mocked(queryNoteById).mockResolvedValueOnce(mockNote);

			const result = await service.getNoteById('AC.20260501.001');

			expect(queryNoteById).toHaveBeenCalledWith(mockDatabase, 'AC.20260501.001');
			expect(result).toEqual(mockNote);
		});
	});

	describe('getNotesForContract', () => {
		it('delegates to queryNotesForContract which calls extractPreviewLines', async () => {
			const mockNotes = [
				{
					id: 'AC.20260501.001',
					contractId: 'c-1',
					isPinned: false,
					createdAt: '2026-05-01T10:00:00Z',
					updatedAt: '2026-05-01T10:00:00Z',
					firstLine: 'Meeting Notes',
					secondLine: 'Action items discussed'
				}
			];
			vi.mocked(queryNotesForContract).mockResolvedValueOnce(mockNotes);

			const result = await service.getNotesForContract('c-1');

			expect(queryNotesForContract).toHaveBeenCalledWith(mockDatabase, 'c-1');
			expect(result).toEqual(mockNotes);
			expect(result[0].firstLine).toBe('Meeting Notes');
			expect(result[0].secondLine).toBe('Action items discussed');
		});
	});

	describe('createNote', () => {
		it('delegates to mutateCreateNote with contractId', async () => {
			const mockNote = {
				id: 'AC.20260526.001',
				contractId: 'c-1',
				isPinned: false,
				createdAt: '2026-05-26T10:00:00Z',
				updatedAt: '2026-05-26T10:00:00Z',
				firstLine: '',
				secondLine: ''
			};
			vi.mocked(mutateCreateNote).mockResolvedValueOnce(mockNote);

			const result = await service.createNote('c-1');

			expect(mutateCreateNote).toHaveBeenCalledWith(mockDatabase, 'c-1');
			expect(result).toEqual(mockNote);
			// The note ID follows the short_code pattern
			expect(result.id).toMatch(/^[A-Z]+\.\d{8}\.\d{3}$/);
		});
	});

	describe('updateNote', () => {
		it('delegates to mutateUpdateNote with dynamic data', async () => {
			const updatedNote = {
				id: 'AC.20260501.001',
				title: 'Updated Title',
				content: 'Updated content here',
				contentJson: null,
				contractId: 'c-1',
				wordCount: 3,
				isPinned: true,
				createdAt: '2026-05-01T10:00:00Z',
				updatedAt: '2026-05-26T10:00:00Z'
			};
			vi.mocked(mutateUpdateNote).mockResolvedValueOnce(updatedNote);

			const result = await service.updateNote('AC.20260501.001', {
				title: 'Updated Title',
				isPinned: true
			});

			expect(mutateUpdateNote).toHaveBeenCalledWith(mockDatabase, 'AC.20260501.001', {
				title: 'Updated Title',
				isPinned: true
			});
			expect(result).toEqual(updatedNote);
		});
	});

	describe('deleteNote', () => {
		it('delegates to mutateDeleteNote', async () => {
			vi.mocked(mutateDeleteNote).mockResolvedValueOnce(undefined);

			await service.deleteNote('AC.20260501.001');

			expect(mutateDeleteNote).toHaveBeenCalledWith(mockDatabase, 'AC.20260501.001');
		});
	});

	// ── Time Entries ──────────────────────────────────────────

	describe('createTimeEntry', () => {
		it('delegates to mutateCreateTimeEntry without user_id', async () => {
			vi.mocked(mutateCreateTimeEntry).mockResolvedValueOnce({ id: 'te-new' });

			const input = {
				date: '2026-05-26',
				durationMinutes: 60,
				contractId: 'c-1',
				description: 'Development work'
			};
			const result = await service.createTimeEntry(input);

			expect(mutateCreateTimeEntry).toHaveBeenCalledWith(mockDatabase, input);
			expect(result).toEqual({ id: 'te-new' });
		});
	});

	// ── Timer ─────────────────────────────────────────────────

	describe('getTimerStatus', () => {
		it('wraps queryTimerStatus result in { timer: ... }', async () => {
			const draftEntry = {
				id: 'te-draft',
				startTime: '10:30:00',
				endTime: null,
				durationMinutes: 0
			};
			vi.mocked(queryTimerStatus).mockResolvedValueOnce(draftEntry);

			const result = await service.getTimerStatus();

			expect(queryTimerStatus).toHaveBeenCalledWith(mockDatabase);
			expect(result).toEqual({ timer: draftEntry });
		});

		it('returns { timer: null } when no draft entry exists', async () => {
			vi.mocked(queryTimerStatus).mockResolvedValueOnce(null);

			const result = await service.getTimerStatus();

			expect(result).toEqual({ timer: null });
		});
	});

	// ── Deliverables & Work Types ─────────────────────────────

	describe('getDeliverables', () => {
		it('delegates to queryDeliverables filtered by contractId', async () => {
			const mockDeliverables = [
				{ id: 'd-1', name: 'Feature Development' },
				{ id: 'd-2', name: 'Bug Fixes' }
			];
			vi.mocked(queryDeliverables).mockResolvedValueOnce(mockDeliverables);

			const result = await service.getDeliverables('c-1');

			expect(queryDeliverables).toHaveBeenCalledWith(mockDatabase, 'c-1');
			expect(result).toEqual(mockDeliverables);
		});
	});

	describe('getWorkTypes', () => {
		it('delegates to queryWorkTypes filtered by deliverableId', async () => {
			const mockWorkTypes = [
				{ id: 'wt-1', name: 'Coding' },
				{ id: 'wt-2', name: 'Code Review' }
			];
			vi.mocked(queryWorkTypes).mockResolvedValueOnce(mockWorkTypes);

			const result = await service.getWorkTypes('d-1');

			expect(queryWorkTypes).toHaveBeenCalledWith(mockDatabase, 'd-1');
			expect(result).toEqual(mockWorkTypes);
		});
	});

	// ── Inline queries (getWeeklyTimeEntries, getWeekSummaries) ──

	describe('getWeeklyTimeEntries', () => {
		it('builds WeekData with days grouped by date', async () => {
			// Mock the main time entry query
			mockDatabase.getAll.mockImplementation((sql: string) => {
				if (sql.includes('FROM time_entries te')) {
					return Promise.resolve([
						{
							id: 'te-1',
							start_time: '09:00:00',
							end_time: '10:30:00',
							duration_minutes: 90,
							contract_id: 'c-1',
							contract_name: 'Contract A',
							client_name: 'Acme Corp',
							client_short_code: 'AC',
							deliverable_name: 'Feature Dev',
							work_type_name: 'Coding',
							description: 'Worked on tests',
							date: '2026-05-25'
						}
					]);
				}
				// Weekly status query
				if (sql.includes('FROM weekly_statuses')) {
					return Promise.resolve([{ status: 'Submitted' }]);
				}
				return Promise.resolve([]);
			});

			const result = await service.getWeeklyTimeEntries(['2026-05-25']);

			expect(result).toHaveLength(1);
			const weekData = result[0];
			expect(weekData.weekStart).toBe('2026-05-25');
			expect(weekData.days).toHaveLength(7);
			expect(weekData.status).toBe('Submitted');

			// The entry for 2026-05-25 (Monday) should have 1 entry
			const mondayData = weekData.days.find((day) => day.date === '2026-05-25');
			expect(mondayData).toBeDefined();
			expect(mondayData!.entries).toHaveLength(1);
			expect(mondayData!.entries[0].contractName).toBe('Contract A');
			expect(mondayData!.totalMinutes).toBe(90);
			expect(weekData.weeklyTotalMinutes).toBe(90);
		});
	});

	describe('getWeekSummaries', () => {
		it('returns week summaries with totals and status', async () => {
			// Mock the total duration query
			mockDatabase.get.mockResolvedValue({ total: 480 });

			// Mock the weekly status query
			mockDatabase.getAll.mockResolvedValue([{ status: 'Approved' }]);

			const result = await service.getWeekSummaries(1, '2026-05-25');

			expect(result).toHaveLength(1);
			expect(result[0].totalMinutes).toBe(480);
			expect(result[0].status).toBe('Approved');
			expect(result[0].weekStart).toBeDefined();
			expect(result[0].year).toBeDefined();
			expect(result[0].weekNumber).toBeDefined();
		});

		it('defaults status to Unsubmitted when no status row exists', async () => {
			mockDatabase.get.mockResolvedValue({ total: 0 });
			mockDatabase.getAll.mockResolvedValue([]);

			const result = await service.getWeekSummaries(1, '2026-05-25');

			expect(result[0].status).toBe('Unsubmitted');
		});

		it('handles null total when no time entries exist', async () => {
			mockDatabase.get.mockResolvedValue({ total: null });
			mockDatabase.getAll.mockResolvedValue([]);

			const result = await service.getWeekSummaries(1, '2026-05-25');

			expect(result[0].totalMinutes).toBe(0);
		});
	});

	// ── Remaining delegated methods ───────────────────────────

	describe('delegated methods', () => {
		it('createContract delegates correctly', async () => {
			vi.mocked(mutateCreateContract).mockResolvedValueOnce({ id: 'c-new' });

			const result = await service.createContract({ clientId: 'cl-1', name: 'New Contract' });

			expect(mutateCreateContract).toHaveBeenCalledWith(mockDatabase, {
				clientId: 'cl-1',
				name: 'New Contract'
			});
			expect(result).toEqual({ id: 'c-new' });
		});

		it('getNoteBacklinks delegates correctly', async () => {
			const mockBacklinks = [
				{ sourceNoteId: 'n-2', noteTitle: 'Other Note', headingAnchor: null }
			];
			vi.mocked(queryNoteBacklinks).mockResolvedValueOnce(mockBacklinks);

			const result = await service.getNoteBacklinks('n-1');

			expect(queryNoteBacklinks).toHaveBeenCalledWith(mockDatabase, 'n-1');
			expect(result).toEqual(mockBacklinks);
		});

		it('getNoteAttachments delegates correctly', async () => {
			const mockAttachments = [
				{
					id: 'a-1',
					filename: 'screenshot.png',
					mimeType: 'image/png',
					sizeBytes: 2048,
					createdAt: '2026-05-26T10:00:00Z'
				}
			];
			vi.mocked(queryNoteAttachments).mockResolvedValueOnce(mockAttachments);

			const result = await service.getNoteAttachments('n-1');

			expect(queryNoteAttachments).toHaveBeenCalledWith(mockDatabase, 'n-1');
			expect(result).toEqual(mockAttachments);
		});

		it('deleteAttachment delegates correctly', async () => {
			vi.mocked(mutateDeleteAttachment).mockResolvedValueOnce(undefined);

			await service.deleteAttachment('a-1');

			expect(mutateDeleteAttachment).toHaveBeenCalledWith(mockDatabase, 'a-1');
		});

		it('getNoteTimeEntries delegates and enriches correctly', async () => {
			const mockLinks = [{ noteId: 'n-1', timeEntryId: 'te-1', headingAnchor: null }];
			vi.mocked(queryNoteTimeEntries).mockResolvedValueOnce(mockLinks);
			mockDatabase.getAll.mockResolvedValueOnce([
				{ date: '2026-01-01', description: 'Test work', duration_minutes: 60, contract_name: 'Project A', client_name: 'Client X', client_color_index: 2 }
			]);

			const result = await service.getNoteTimeEntries('n-1');

			expect(queryNoteTimeEntries).toHaveBeenCalledWith(mockDatabase, 'n-1');
			expect(result).toEqual([{
				timeEntryId: 'te-1',
				noteId: 'n-1',
				headingAnchor: null,
				date: '2026-01-01',
				description: 'Test work',
				durationMinutes: 60,
				contractName: 'Project A',
				clientName: 'Client X',
				clientColorIndex: 2
			}]);
		});

		it('linkNoteTimeEntry inserts a link record', async () => {
			mockDatabase.execute.mockResolvedValueOnce(undefined);

			await service.linkNoteTimeEntry('n-1', 'te-1', 'design-review');

			expect(mockDatabase.execute).toHaveBeenCalledWith(
				expect.stringContaining('INSERT OR IGNORE INTO note_time_entry_link'),
				['n-1', 'te-1', 'design-review']
			);
		});

		it('unlinkNoteTimeEntry delegates correctly', async () => {
			vi.mocked(mutateUnlinkNoteTimeEntry).mockResolvedValueOnce(undefined);

			await service.unlinkNoteTimeEntry('n-1', 'te-1');

			expect(mutateUnlinkNoteTimeEntry).toHaveBeenCalledWith(mockDatabase, 'n-1', 'te-1');
		});

		it('updateTimeEntry delegates correctly', async () => {
			vi.mocked(mutateUpdateTimeEntry).mockResolvedValueOnce(undefined);

			await service.updateTimeEntry('te-1', { durationMinutes: 120 });

			expect(mutateUpdateTimeEntry).toHaveBeenCalledWith(mockDatabase, 'te-1', {
				durationMinutes: 120
			});
		});

		it('deleteTimeEntry delegates correctly', async () => {
			vi.mocked(mutateDeleteTimeEntry).mockResolvedValueOnce(undefined);

			await service.deleteTimeEntry('te-1');

			expect(mutateDeleteTimeEntry).toHaveBeenCalledWith(mockDatabase, 'te-1');
		});

		it('updateWeeklyStatus delegates correctly', async () => {
			vi.mocked(mutateUpdateWeeklyStatus).mockResolvedValueOnce(undefined);

			await service.updateWeeklyStatus(2026, 22, 'Submitted');

			expect(mutateUpdateWeeklyStatus).toHaveBeenCalledWith(mockDatabase, 2026, 22, 'Submitted');
		});

		it('startTimer delegates correctly', async () => {
			const timerEntry = {
				id: 'te-timer',
				startTime: '14:00:00',
				endTime: null,
				durationMinutes: 0
			};
			vi.mocked(mutateStartTimer).mockResolvedValueOnce(timerEntry);

			const result = await service.startTimer('c-1');

			expect(mutateStartTimer).toHaveBeenCalledWith(mockDatabase, 'c-1');
			expect(result).toEqual(timerEntry);
		});

		it('stopTimer delegates correctly', async () => {
			const stoppedTimer = {
				id: 'te-timer',
				startTime: '14:00:00',
				endTime: '15:30:00',
				durationMinutes: 90
			};
			vi.mocked(mutateStopTimer).mockResolvedValueOnce(stoppedTimer);

			const result = await service.stopTimer();

			expect(mutateStopTimer).toHaveBeenCalledWith(mockDatabase);
			expect(result).toEqual(stoppedTimer);
		});

		it('saveTimer delegates correctly', async () => {
			vi.mocked(mutateSaveTimer).mockResolvedValueOnce(undefined);

			const saveInput = {
				entryId: 'te-timer',
				contractId: 'c-1',
				deliverableId: 'd-1',
				workTypeId: 'wt-1',
				description: 'Coding work'
			};
			await service.saveTimer(saveInput);

			expect(mutateSaveTimer).toHaveBeenCalledWith(mockDatabase, saveInput);
		});

		it('discardTimer delegates correctly', async () => {
			vi.mocked(mutateDiscardTimer).mockResolvedValueOnce(undefined);

			await service.discardTimer('te-timer');

			expect(mutateDiscardTimer).toHaveBeenCalledWith(mockDatabase, 'te-timer');
		});
	});

	// ── uploadAttachment (inline fetch, not delegated) ────────

	describe('uploadAttachment', () => {
		it('POSTs FormData to the REST API', async () => {
			const mockResponse = {
				ok: true,
				json: () => Promise.resolve({ id: 'att-new' })
			};
			vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(mockResponse));

			const file = new File(['test content'], 'document.pdf', { type: 'application/pdf' });
			const result = await service.uploadAttachment('n-1', file);

			expect(fetch).toHaveBeenCalledWith('/api/notes/n-1/attachments', {
				method: 'POST',
				body: expect.any(FormData)
			});
			expect(result).toEqual({ id: 'att-new' });

			vi.unstubAllGlobals();
		});

		it('throws on non-OK response', async () => {
			const mockResponse = {
				ok: false,
				status: 413,
				text: () => Promise.resolve('File too large')
			};
			vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(mockResponse));

			const file = new File(['big content'], 'huge.bin', { type: 'application/octet-stream' });
			await expect(service.uploadAttachment('n-1', file)).rejects.toThrow(
				/Upload attachment failed \(413\)/
			);

			vi.unstubAllGlobals();
		});
	});

	// ── Interface completeness ────────────────────────────────

	describe('interface completeness', () => {
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
			'linkNoteTimeEntry',
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

		it('PowerSyncDataService implements all DataService methods', () => {
			for (const methodName of expectedMethods) {
				expect(typeof service[methodName]).toBe('function');
			}
		});

		it('PowerSyncDataService has no extra public methods beyond DataService', () => {
			const prototype = Object.getPrototypeOf(service);
			const publicMethods = Object.getOwnPropertyNames(prototype).filter(
				(name) => name !== 'constructor' && typeof prototype[name] === 'function'
			);
			// Allow private methods (prefixed with nothing since JS doesn't enforce)
			// but all should either be in expectedMethods or be private helpers
			for (const methodName of publicMethods) {
				const isDataServiceMethod = expectedMethods.includes(methodName as keyof DataService);
				// buildWeekData is a private helper — it's on the prototype but not public API
				const isPrivateHelper = methodName === 'buildWeekData';
				expect(isDataServiceMethod || isPrivateHelper).toBe(true);
			}
		});
	});
});
