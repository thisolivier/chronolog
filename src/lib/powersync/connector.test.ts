/**
 * Tests for ChronologConnector (PowerSync backend connector).
 *
 * Mocks the fetch helpers and @powersync/web to verify that
 * fetchCredentials() and uploadData() behave correctly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @powersync/web before any imports that use it
vi.mock('@powersync/web', () => ({
	UpdateType: { PUT: 1, PATCH: 2, DELETE: 3 }
}));

// Mock fetch helpers
vi.mock('$lib/services/fetch-helpers', () => ({
	fetchJson: vi.fn(),
	postJson: vi.fn(),
	putJson: vi.fn(),
	deleteRequest: vi.fn()
}));

import { ChronologConnector } from './connector';
import { fetchJson, postJson, putJson, deleteRequest } from '$lib/services/fetch-helpers';
import { UpdateType } from '@powersync/web';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a mock database object with a getCrudBatch method.
 */
function createMockDatabase(batches: Array<{
	crud: Array<{ table: string; op: (typeof UpdateType)[keyof typeof UpdateType]; id: string; opData?: Record<string, unknown> }>;
	haveMore: boolean;
} | null>) {
	let callIndex = 0;
	return {
		getCrudBatch: vi.fn().mockImplementation(() => {
			const batch = batches[callIndex];
			callIndex++;
			if (!batch) return Promise.resolve(null);
			return Promise.resolve({
				...batch,
				complete: vi.fn().mockResolvedValue(undefined)
			});
		})
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const mockedFetchJson = vi.mocked(fetchJson);
const mockedPostJson = vi.mocked(postJson);
const mockedPutJson = vi.mocked(putJson);
const mockedDeleteRequest = vi.mocked(deleteRequest);

let connector: ChronologConnector;

beforeEach(() => {
	vi.clearAllMocks();
	connector = new ChronologConnector();
});

describe('ChronologConnector', () => {
	// ── fetchCredentials ──────────────────────────────────────

	describe('fetchCredentials', () => {
		it('returns credentials with token and endpoint on success', async () => {
			mockedFetchJson.mockResolvedValueOnce({
				token: 'jwt-token-123',
				expiresAt: '2026-06-01T00:00:00Z'
			});

			const result = await connector.fetchCredentials();

			expect(mockedFetchJson).toHaveBeenCalledWith('/api/powersync/token');
			expect(result).toEqual({
				endpoint: 'http://localhost:8080',
				token: 'jwt-token-123',
				expiresAt: new Date('2026-06-01T00:00:00Z')
			});
		});

		it('returns null on 401 error', async () => {
			mockedFetchJson.mockRejectedValueOnce(
				new Error('GET /api/powersync/token failed (401): Unauthorized')
			);

			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			const result = await connector.fetchCredentials();

			expect(result).toBeNull();
			expect(warnSpy).toHaveBeenCalledWith(
				'PowerSync: user not authenticated, pausing sync'
			);

			warnSpy.mockRestore();
		});

		it('re-throws non-401 errors', async () => {
			const serverError = new Error('GET /api/powersync/token failed (500): Internal Server Error');
			mockedFetchJson.mockRejectedValueOnce(serverError);

			await expect(connector.fetchCredentials()).rejects.toThrow(
				'GET /api/powersync/token failed (500): Internal Server Error'
			);
		});
	});

	// ── uploadData ────────────────────────────────────────────

	describe('uploadData', () => {
		it('processes PUT entries (creates via POST)', async () => {
			const mockDatabase = createMockDatabase([
				{
					crud: [
						{
							table: 'notes',
							op: UpdateType.PUT,
							id: 'note-1',
							opData: { title: 'My Note', content: 'Hello' }
						}
					],
					haveMore: false
				}
			]);

			mockedPostJson.mockResolvedValueOnce({});

			await connector.uploadData(mockDatabase as never);

			expect(mockedPostJson).toHaveBeenCalledWith('/api/notes', {
				id: 'note-1',
				title: 'My Note',
				content: 'Hello'
			});
		});

		it('processes PATCH entries (updates via PUT)', async () => {
			const mockDatabase = createMockDatabase([
				{
					crud: [
						{
							table: 'time_entries',
							op: UpdateType.PATCH,
							id: 'te-1',
							opData: { duration_minutes: 90 }
						}
					],
					haveMore: false
				}
			]);

			mockedPutJson.mockResolvedValueOnce({});

			await connector.uploadData(mockDatabase as never);

			expect(mockedPutJson).toHaveBeenCalledWith('/api/time-entries/te-1', {
				id: 'te-1',
				duration_minutes: 90
			});
		});

		it('processes DELETE entries', async () => {
			const mockDatabase = createMockDatabase([
				{
					crud: [
						{
							table: 'notes',
							op: UpdateType.DELETE,
							id: 'note-1'
						}
					],
					haveMore: false
				}
			]);

			mockedDeleteRequest.mockResolvedValueOnce(undefined as never);

			await connector.uploadData(mockDatabase as never);

			expect(mockedDeleteRequest).toHaveBeenCalledWith('/api/notes/note-1');
		});

		it('skips unknown tables with a warning', async () => {
			const mockDatabase = createMockDatabase([
				{
					crud: [
						{
							table: 'unknown_table',
							op: UpdateType.PUT,
							id: 'x-1',
							opData: { foo: 'bar' }
						}
					],
					haveMore: false
				}
			]);

			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			await connector.uploadData(mockDatabase as never);

			expect(warnSpy).toHaveBeenCalledWith(
				'PowerSync uploadData: no API config for table "unknown_table", skipping',
				{ op: UpdateType.PUT, id: 'x-1' }
			);
			expect(mockedPostJson).not.toHaveBeenCalled();
			expect(mockedPutJson).not.toHaveBeenCalled();
			expect(mockedDeleteRequest).not.toHaveBeenCalled();

			warnSpy.mockRestore();
		});

		it('skips unsupported operations (e.g., PATCH on clients)', async () => {
			const mockDatabase = createMockDatabase([
				{
					crud: [
						{
							table: 'clients',
							op: UpdateType.PATCH,
							id: 'cl-1',
							opData: { name: 'Updated Client' }
						}
					],
					haveMore: false
				}
			]);

			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			await connector.uploadData(mockDatabase as never);

			expect(warnSpy).toHaveBeenCalledWith(
				'PowerSync: PATCH not supported for "clients", skipping'
			);
			expect(mockedPutJson).not.toHaveBeenCalled();

			warnSpy.mockRestore();
		});

		it('calls batch.complete() after processing', async () => {
			const mockDatabase = createMockDatabase([
				{
					crud: [
						{
							table: 'notes',
							op: UpdateType.PUT,
							id: 'note-1',
							opData: { title: 'Test' }
						}
					],
					haveMore: false
				}
			]);

			mockedPostJson.mockResolvedValueOnce({});

			await connector.uploadData(mockDatabase as never);

			// getCrudBatch was called once, get the batch it returned
			const returnedBatch = await mockDatabase.getCrudBatch.mock.results[0].value;
			expect(returnedBatch.complete).toHaveBeenCalledOnce();
		});

		it('does nothing when no batch is available', async () => {
			const mockDatabase = createMockDatabase([null]);

			await connector.uploadData(mockDatabase as never);

			expect(mockedPostJson).not.toHaveBeenCalled();
			expect(mockedPutJson).not.toHaveBeenCalled();
			expect(mockedDeleteRequest).not.toHaveBeenCalled();
		});

		it('drains multiple batches when haveMore is true', async () => {
			const mockDatabase = createMockDatabase([
				{
					crud: [
						{ table: 'notes', op: UpdateType.PUT, id: 'note-1', opData: { title: 'First' } }
					],
					haveMore: true
				},
				{
					crud: [
						{ table: 'notes', op: UpdateType.PUT, id: 'note-2', opData: { title: 'Second' } }
					],
					haveMore: false
				}
			]);

			mockedPostJson.mockResolvedValue({});

			await connector.uploadData(mockDatabase as never);

			expect(mockDatabase.getCrudBatch).toHaveBeenCalledTimes(2);
			expect(mockedPostJson).toHaveBeenCalledTimes(2);
			expect(mockedPostJson).toHaveBeenCalledWith('/api/notes', {
				id: 'note-1',
				title: 'First'
			});
			expect(mockedPostJson).toHaveBeenCalledWith('/api/notes', {
				id: 'note-2',
				title: 'Second'
			});
		});
	});
});
